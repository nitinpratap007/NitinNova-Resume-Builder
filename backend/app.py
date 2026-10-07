import os
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from models import init_db, SessionLocal, Resume
from ai_module import polish_bullets
from sqlalchemy.exc import SQLAlchemyError
import io
import json
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import jwt
from functools import wraps
from datetime import datetime, timedelta
import secrets
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import generate_password_hash, check_password_hash
from models import User, DeveloperInfo, AppSettings, Invite, RefreshToken, Referral, Feedback

app = Flask(__name__)
CORS(app)
SECRET = os.environ.get('JWT_SECRET', 'change_this_secret')

limiter = Limiter(key_func=get_remote_address, default_limits=["200 per day", "50 per hour"])
limiter.init_app(app)

init_db()

def create_token(user_id, is_admin=False):
    exp = datetime.utcnow() + timedelta(minutes=15)
    # RFC 7519 requires "sub" to be a string; newer PyJWT (>= 2.10) rejects
    # integer subjects, which silently broke every authenticated endpoint.
    payload = {'sub': str(user_id), 'admin': bool(is_admin), 'exp': exp}
    return jwt.encode(payload, SECRET, algorithm='HS256')

def create_refresh_token(user_id, minutes=60*24*7):
    secret = secrets.token_urlsafe(32)
    token_hash = generate_password_hash(secret)
    expires = datetime.utcnow() + timedelta(minutes=minutes)
    db = SessionLocal()
    rt = RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires.isoformat(), revoked=0, created_at=datetime.utcnow().isoformat())
    db.add(rt); db.commit(); db.refresh(rt)
    db.close()
    return f"{rt.id}:{secret}"

def revoke_refresh_token_by_id(rt_id):
    db = SessionLocal()
    rt = db.query(RefreshToken).filter(RefreshToken.id == rt_id).first()
    if rt:
        rt.revoked = 1
        db.commit()
    db.close()

def decode_token(token):
    try:
        return jwt.decode(token, SECRET, algorithms=['HS256'])
    except Exception:
        return None


def subject_id(payload):
    """Return the JWT subject ("sub") as an int — the DB user_id columns are
    INTEGER. Works whether the token carries a string (RFC 7519) or legacy int
    subject, so ownership checks keep comparing ints to ints."""
    if not payload:
        return None
    try:
        return int(payload.get('sub'))
    except (TypeError, ValueError):
        return None

def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'ok': False, 'error': 'Missing token'}), 401
        token = auth.split(' ',1)[1]
        data = decode_token(token)
        if not data:
            return jsonify({'ok': False, 'error': 'Invalid token'}), 401
        request.user = data
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'ok': False, 'error': 'Missing token'}), 401
        token = auth.split(' ',1)[1]
        data = decode_token(token)
        if not data or not data.get('admin'):
            return jsonify({'ok': False, 'error': 'Admin required'}), 403
        request.user = data
        return f(*args, **kwargs)
    return decorated

@app.route('/generate-resume', methods=['POST'])
def generate_resume():
    data = request.json or {}
    polished = polish_bullets(data)
    polished['photo'] = data.get('photo', '')
    polished['sections'] = data.get('sections', [])
    polished['bgColor'] = data.get('bgColor', '#eef2ff')
    polished['photoShape'] = data.get('photoShape', 'circle')
    return jsonify({'ok': True, 'polished': polished})

@app.route('/generate-cover-letter', methods=['POST'])
def generate_cover_letter():
    data = request.json or {}
    name = data.get('name', 'Applicant')
    email = data.get('email', '')
    phone = data.get('phone', '')
    skills = (data.get('skills') or '').split('\n')
    skills = [s.strip() for s in skills if s.strip()]
    projects = (data.get('projects') or '').split('\n')
    projects = [p.strip() for p in projects if p.strip()]
    education = data.get('education', '')
    job_desc = data.get('jobDescription', '')
    style = data.get('style', 'professional')

    top_skills = ', '.join(skills[:5]) or 'my technical skills'
    first_project = projects[0] if projects else 'my recent projects'

    templates = {
        'professional': {
            'greeting': 'Dear Hiring Manager,',
            'opening': f'I am writing to express my strong interest in the position at your organization. With a proven track record in software development and a passion for delivering high-quality solutions, I am confident that my skills and experience align well with your team\'s goals.',
            'body': f'Throughout my career, I have honed my expertise in {top_skills}. My experience includes working on projects such as {first_project}, where I demonstrated my ability to deliver impactful results. My educational background in {education or "Computer Science"} has provided me with a solid foundation.',
            'closing': 'I would welcome the opportunity to discuss how my skills and enthusiasm can contribute to your team\'s success. Thank you for considering my application. I look forward to the possibility of contributing to your organization.',
        },
        'creative': {
            'greeting': 'Dear Creative Team,',
            'opening': 'I\'m excited to apply for this opportunity — it feels like the perfect intersection of my skills and passions. I thrive in environments where creativity meets technology.',
            'body': f'My toolkit includes {top_skills}, and I\'ve put them to work on exciting projects like {first_project}. I believe great work happens at the intersection of innovation and execution.',
            'closing': 'I\'d love the chance to share more about my work and learn about your vision. Let\'s create something remarkable together. Thank you for your time and consideration.',
        },
        'technical': {
            'greeting': 'Dear Technical Hiring Team,',
            'opening': f'I am writing to express my interest in the technical role at your company. My hands-on experience with {top_skills} makes me a strong candidate for this position.',
            'body': f'In my previous work, I have successfully delivered solutions involving {first_project}. My technical proficiencies span across {top_skills}, and I bring a methodical approach to problem-solving.',
            'closing': 'I am confident that my technical skills and dedication to quality engineering would make me a valuable addition to your team. Thank you for your consideration.',
        },
        'entry-level': {
            'greeting': 'Dear Hiring Manager,',
            'opening': 'As a recent graduate eager to begin my professional career, I am thrilled to apply for this position. My academic background and project experience have prepared me to make meaningful contributions.',
            'body': f'During my studies in {education or "Computer Science"}, I developed strong skills in {top_skills}. My hands-on experience includes working on {first_project}, which gave me practical insight into real-world development workflows.',
            'closing': 'I would be grateful for the opportunity to discuss how my fresh perspective and technical foundation can benefit your team. Thank you for considering my application.',
        },
    }

    t = templates.get(style, templates['professional'])

    job_mention = ''
    if job_desc:
        safe_desc = job_desc[:200].replace('\n', ' ')
        job_mention = f'\n\nI noticed that your posting emphasizes {safe_desc}, and I believe my background aligns well with these requirements.'

    today = datetime.now().strftime('%B %d, %Y')
    letter = f"""{today}

{name}
{email}{' | ' + phone if phone else ''}

{t['greeting']}

{t['opening']}{job_mention}

{t['body']}

{t['closing']}

Sincerely,
{name}"""

    return jsonify({'ok': True, 'letter': letter})


@app.route('/auth/signup', methods=['POST'])
@limiter.limit("10 per minute")
def signup():
    data = request.json or {}
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')
    referral_token = data.get('referral')
    if not email or not password:
        return jsonify({'ok': False, 'error': 'email and password required'}), 400
    db = SessionLocal()
    if db.query(User).filter(User.email == email).first():
        db.close()
        return jsonify({'ok': False, 'error': 'exists'}), 400
    u = User(name=name, email=email, password_hash=generate_password_hash(password), is_admin=0)
    db.add(u); db.commit(); db.refresh(u)
    if referral_token:
        ref = db.query(Referral).filter(Referral.token == referral_token, Referral.used_by == None).first()
        if ref:
            ref.used_by = u.id
            ref.used_at = datetime.utcnow().isoformat()
            db.commit()
    db.close()
    access = create_token(u.id, is_admin=False)
    refresh = create_refresh_token(u.id)
    return jsonify({'ok': True, 'token': access, 'refresh': refresh})


@app.route('/auth/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    data = request.json or {}
    email = data.get('email')
    password = data.get('password')
    db = SessionLocal()
    u = db.query(User).filter(User.email == email).first()
    db.close()
    if not u or not check_password_hash(u.password_hash, password):
        return jsonify({'ok': False, 'error': 'invalid'}), 400
    access = create_token(u.id, is_admin=bool(u.is_admin))
    refresh = create_refresh_token(u.id)
    return jsonify({'ok': True, 'token': access, 'refresh': refresh, 'is_admin': bool(u.is_admin)})


@app.route('/auth/admin/signup', methods=['POST'])
def admin_signup():
    return jsonify({'ok': False, 'error': 'Admin signup is disabled.'}), 403


@app.route('/auth/admin/login', methods=['POST'])
@limiter.limit("5 per minute")
def admin_login():
    data = request.json or {}
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')
    invite_token = data.get('invite')
    if not email or not password or not invite_token:
        return jsonify({'ok': False, 'error': 'email,password,invite required'}), 400
    db = SessionLocal()
    inv = db.query(Invite).filter(Invite.token == invite_token).first()
    if not inv:
        db.close()
        return jsonify({'ok': False, 'error': 'invalid invite'}), 400
    if inv.used_by:
        db.close()
        return jsonify({'ok': False, 'error': 'invite already used'}), 400
    if db.query(User).filter(User.email == email).first():
        db.close()
        return jsonify({'ok': False, 'error': 'exists'}), 400
    u = User(name=name, email=email, password_hash=generate_password_hash(password), is_admin=1)
    db.add(u); db.commit(); db.refresh(u)
    inv.used_by = u.id
    inv.used_at = datetime.utcnow().isoformat()
    db.commit()
    db.close()
    access = create_token(u.id, is_admin=True)
    refresh = create_refresh_token(u.id)
    return jsonify({'ok': True, 'token': access, 'refresh': refresh})


@app.route('/invites', methods=['POST'])
@admin_required
def create_invite():
    db = SessionLocal()
    token = secrets.token_urlsafe(16)
    created_by = subject_id(request.user)
    inv = Invite(token=token, created_by=created_by, used_by=None, created_at=datetime.utcnow().isoformat())
    db.add(inv); db.commit(); db.refresh(inv); db.close()
    return jsonify({'ok': True, 'invite': token})


@app.route('/invites', methods=['GET'])
@admin_required
def list_invites():
    db = SessionLocal()
    rows = db.query(Invite).all()
    out = [{'id': r.id, 'token': r.token, 'created_by': r.created_by, 'used_by': r.used_by, 'created_at': r.created_at, 'used_at': r.used_at} for r in rows]
    db.close()
    return jsonify({'ok': True, 'invites': out})


@app.route('/referrals', methods=['POST'])
@auth_required
def create_referral():
    db = SessionLocal()
    token = secrets.token_urlsafe(16)
    user_id = subject_id(request.user)
    r = Referral(user_id=user_id, token=token, created_at=datetime.utcnow().isoformat(), used_by=None, used_at=None)
    db.add(r); db.commit(); db.refresh(r); db.close()
    return jsonify({'ok': True, 'token': token})

@app.route('/referrals', methods=['GET'])
@auth_required
def list_referrals():
    user_id = subject_id(request.user)
    db = SessionLocal()
    rows = db.query(Referral).filter(Referral.user_id == user_id).all()
    out = [{'id': r.id, 'token': r.token, 'created_at': r.created_at, 'used_by': r.used_by, 'used_at': r.used_at} for r in rows]
    db.close()
    return jsonify({'ok': True, 'referrals': out})

@app.route('/feedback', methods=['POST'])
@auth_required
def submit_feedback():
    data = request.json or {}
    user_id = subject_id(request.user)
    subject = data.get('subject', '')
    message = data.get('message', '')
    db = SessionLocal()
    fb = Feedback(user_id=user_id, subject=subject, message=message, created_at=datetime.utcnow().isoformat())
    db.add(fb); db.commit(); db.close()
    return jsonify({'ok': True})

@app.route('/feedbacks', methods=['GET'])
@admin_required
def list_feedbacks():
    db = SessionLocal()
    rows = db.query(Feedback).all()
    out = [{'id': r.id, 'user_id': r.user_id, 'subject': r.subject, 'message': r.message, 'created_at': r.created_at} for r in rows]
    db.close()
    return jsonify({'ok': True, 'feedbacks': out})

@app.route('/auth/refresh', methods=['POST'])
def refresh_token_endpoint():
    data = request.json or {}
    token = data.get('refresh')
    if not token:
        return jsonify({'ok': False, 'error': 'refresh required'}), 400
    try:
        rt_id_str, secret = token.split(':',1)
        rt_id = int(rt_id_str)
    except Exception:
        return jsonify({'ok': False, 'error': 'invalid format'}), 400
    db = SessionLocal()
    rt = db.query(RefreshToken).filter(RefreshToken.id == rt_id).first()
    if not rt:
        db.close()
        return jsonify({'ok': False, 'error': 'invalid'}), 400
    if rt.revoked:
        db.close()
        return jsonify({'ok': False, 'error': 'revoked'}), 400
    if datetime.fromisoformat(rt.expires_at) < datetime.utcnow():
        db.close()
        return jsonify({'ok': False, 'error': 'expired'}), 400
    if not check_password_hash(rt.token_hash, secret):
        db.close()
        return jsonify({'ok': False, 'error': 'invalid'}), 400
    rt.revoked = 1
    db.commit()
    user_id = rt.user_id
    db.close()
    new_refresh = create_refresh_token(user_id)
    access = create_token(user_id, is_admin=False)
    return jsonify({'ok': True, 'token': access, 'refresh': new_refresh})


@app.route('/auth/logout', methods=['POST'])
def logout():
    data = request.json or {}
    token = data.get('refresh')
    if not token:
        return jsonify({'ok': False, 'error': 'refresh required'}), 400
    try:
        rt_id_str, secret = token.split(':',1)
        rt_id = int(rt_id_str)
    except Exception:
        return jsonify({'ok': False, 'error': 'invalid format'}), 400
    revoke_refresh_token_by_id(rt_id)
    return jsonify({'ok': True})

@app.route('/developer', methods=['GET'])
def get_developer():
    db = SessionLocal()
    info = db.query(DeveloperInfo).first()
    db.close()
    if not info:
        return jsonify({'ok': True, 'developer': {'name': '', 'bio': '', 'email': '', 'github': '', 'instagram': '', 'linkedin': '', 'contact': '', 'phone': '', 'youtube': '', 'portfolio': '', 'projectName': '', 'projectLink': ''}})
    return jsonify({'ok': True, 'developer': {
        'name': info.name or '', 'bio': info.bio or '', 'email': info.email or '',
        'github': info.github or '', 'instagram': info.instagram or '', 'linkedin': info.linkedin or '',
        'contact': info.contact or '', 'phone': info.phone or '', 'youtube': info.youtube or '',
        'portfolio': info.portfolio or '', 'projectName': info.project_name or '', 'projectLink': info.project_link or ''
    }})


@app.route('/developer', methods=['POST'])
@admin_required
def set_developer():
    data = request.json or {}
    db = SessionLocal()
    info = db.query(DeveloperInfo).first()
    if not info:
        info = DeveloperInfo(
            name=data.get('name', ''), bio=data.get('bio', ''), email=data.get('email', ''),
            github=data.get('github', ''), instagram=data.get('instagram', ''), linkedin=data.get('linkedin', ''),
            contact=data.get('contact', ''), phone=data.get('phone', ''), youtube=data.get('youtube', ''),
            portfolio=data.get('portfolio', ''), project_name=data.get('projectName', ''), project_link=data.get('projectLink', '')
        )
        db.add(info)
    else:
        info.name = data.get('name', info.name)
        info.bio = data.get('bio', info.bio)
        info.email = data.get('email', info.email)
        info.github = data.get('github', info.github)
        info.instagram = data.get('instagram', info.instagram)
        info.linkedin = data.get('linkedin', info.linkedin)
        info.contact = data.get('contact', info.contact)
        info.phone = data.get('phone', info.phone)
        info.youtube = data.get('youtube', info.youtube)
        info.portfolio = data.get('portfolio', info.portfolio)
        info.project_name = data.get('projectName', info.project_name)
        info.project_link = data.get('projectLink', info.project_link)
    db.commit()
    db.close()
    return jsonify({'ok': True})


def get_setting(db, key, default=''):
    row = db.query(AppSettings).filter(AppSettings.key == key).first()
    return row.value if row else default

def set_setting(db, key, value):
    row = db.query(AppSettings).filter(AppSettings.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AppSettings(key=key, value=value))


@app.route('/api/admin-settings', methods=['GET'])
def get_admin_settings():
    db = SessionLocal()
    settings = {
        'appName': get_setting(db, 'appName', 'NitinNova'),
        'appTagline': get_setting(db, 'appTagline', 'CareerCraft by Nitin Pratap'),
        'footerText': get_setting(db, 'footerText', 'Built by Nitin Pratap'),
        'primaryColor': get_setting(db, 'primaryColor', '#6366f1'),
        'showGuestLogin': get_setting(db, 'showGuestLogin', 'false'),
        'showShareButton': get_setting(db, 'showShareButton', 'true'),
    }
    db.close()
    return jsonify({'ok': True, 'settings': settings})


@app.route('/api/admin-settings', methods=['POST'])
@admin_required
def set_admin_settings():
    data = request.json or {}
    db = SessionLocal()
    for key in ['appName', 'appTagline', 'footerText', 'primaryColor', 'showGuestLogin', 'showShareButton']:
        if key in data:
            val = data[key]
            if isinstance(val, bool):
                val = 'true' if val else 'false'
            set_setting(db, key, val)
    db.commit()
    db.close()
    return jsonify({'ok': True})


@app.route('/my/resumes', methods=['GET'])
@auth_required
def my_resumes():
    user_id = subject_id(request.user)
    db = SessionLocal()
    rows = db.query(Resume).filter(Resume.user_id == user_id).all()
    db.close()
    out = [{'id': r.id, 'name': r.name, 'email': r.email, 'education': r.education, 'template': r.template, 'templateMode': r.template_mode} for r in rows]
    return jsonify({'ok': True, 'resumes': out})


@app.route('/resumes/<int:resume_id>', methods=['GET'])
@auth_required
def get_resume(resume_id):
    """Return a resume's full state so the client can render/download it with
    the SAME frontend pipeline as the live preview (single source of truth).
    No PDF generation happens server-side."""
    user_id = subject_id(request.user)
    db = SessionLocal()
    r = db.query(Resume).filter(Resume.id == resume_id).first()
    db.close()
    if not r:
        return jsonify({'ok': False, 'error': 'Not found'}), 404
    if r.user_id is not None and r.user_id != user_id and not request.user.get('admin'):
        return jsonify({'ok': False, 'error': 'Forbidden'}), 403

    sections = []
    try:
        sections = json.loads(r.sections) if r.sections else []
    except Exception:
        sections = []

    polished_values = {}
    if r.polished:
        try:
            polished_values = json.loads(r.polished)
            if isinstance(polished_values, str):
                polished_values = json.loads(polished_values)
        except Exception:
            polished_values = {}

    return jsonify({'ok': True, 'resume': {
        'id': r.id,
        'name': r.name or '',
        'email': r.email or '',
        'education': r.education or '',
        'skills': r.skills or '',
        'projects': r.projects or '',
        'template': r.template or 'photo-profile',
        'templateMode': r.template_mode or 'online',
        'sections': sections,
        'bgColor': r.bg_color or '#eef2ff',
        'photoShape': r.photo_shape or 'circle',
        'photo': r.photo or '',
        'polished': polished_values,
    }})


@app.route('/resumes/<int:resume_id>', methods=['PUT'])
@auth_required
def update_resume(resume_id):
    user_id = subject_id(request.user)
    data = request.json or {}
    db = SessionLocal()
    r = db.query(Resume).filter(Resume.id == resume_id).first()
    if not r:
        db.close()
        return jsonify({'ok': False, 'error': 'Not found'}), 404
    if r.user_id != user_id and not request.user.get('admin'):
        db.close()
        return jsonify({'ok': False, 'error': 'Forbidden'}), 403
    r.name = data.get('name', r.name)
    r.email = data.get('email', r.email)
    r.education = data.get('education', r.education)
    r.skills = data.get('skills', r.skills)
    r.projects = data.get('projects', r.projects)
    r.polished = data.get('polished', r.polished)
    if data.get('sections') is not None:
        r.sections = json.dumps(data.get('sections'))
    if data.get('bgColor') is not None:
        r.bg_color = data.get('bgColor')
    if data.get('photoShape') is not None:
        r.photo_shape = data.get('photoShape')
    db.commit()
    db.close()
    return jsonify({'ok': True})


@app.route('/resumes/<int:resume_id>', methods=['DELETE'])
@auth_required
def delete_resume(resume_id):
    user_id = subject_id(request.user)
    db = SessionLocal()
    r = db.query(Resume).filter(Resume.id == resume_id).first()
    if not r:
        db.close()
        return jsonify({'ok': False, 'error': 'Not found'}), 404
    if r.user_id != user_id and not request.user.get('admin'):
        db.close()
        return jsonify({'ok': False, 'error': 'Forbidden'}), 403
    db.delete(r)
    db.commit()
    db.close()
    return jsonify({'ok': True})

@app.route('/save-resume', methods=['POST'])
def save_resume():
    data = request.json or {}
    db = SessionLocal()
    try:
        auth = request.headers.get('Authorization', '')
        user_id = None
        if auth.startswith('Bearer '):
            token = auth.split(' ',1)[1]
            decoded = decode_token(token)
            if decoded:
                user_id = subject_id(decoded)

        polished_payload = data.get('polished')
        if isinstance(polished_payload, dict):
            polished_payload = json.dumps(polished_payload)
        elif polished_payload is None:
            polished_payload = json.dumps({})

        r = Resume(
            user_id=user_id, name=data.get('name'), email=data.get('email'),
            education=data.get('education'), skills=data.get('skills'),
            projects=data.get('projects'), polished=polished_payload,
            template=data.get('template'), template_mode=data.get('templateMode'),
            sections=json.dumps(data.get('sections') or []),
            bg_color=data.get('bgColor'), photo_shape=data.get('photoShape'),
            photo=data.get('photo')
        )
        db.add(r)
        db.commit()
        db.refresh(r)
        return jsonify({'ok': True, 'id': r.id})
    except SQLAlchemyError as e:
        db.rollback()
        return jsonify({'ok': False, 'error': str(e)})
    finally:
        db.close()

@app.route('/download/<int:resume_id>', methods=['GET'])
def download_resume(resume_id):
    db = SessionLocal()
    r = db.query(Resume).filter(Resume.id == resume_id).first()
    db.close()
    if not r:
        return jsonify({'ok': False, 'error': 'Not found'}), 404

    if r.user_id is not None:
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'ok': False, 'error': 'Auth required'}), 401
        token = auth.split(' ',1)[1]
        data = decode_token(token)
        if not data:
            return jsonify({'ok': False, 'error': 'Invalid token'}), 401
        if subject_id(data) != r.user_id and not data.get('admin'):
            return jsonify({'ok': False, 'error': 'Forbidden'}), 403

    sections = []
    try:
        sections = json.loads(r.sections) if r.sections else []
    except Exception:
        sections = []

    polished_values = {}
    if r.polished:
        try:
            polished_values = json.loads(r.polished)
            if isinstance(polished_values, str):
                polished_values = json.loads(polished_values)
        except Exception:
            polished_values = {}

    bullets = polished_values.get('bullets') or []
    if isinstance(bullets, str):
        bullets = bullets.split('\n')
    photo_shape = r.photo_shape or polished_values.get('photoShape', 'circle')

    template_id = r.template or 'photo-profile'
    layout_style = 'minimalist'
    if template_id in ['creative-gradient', 'dark-glass', 'bold-header', 'creative-portfolio']:
        layout_style = 'gradient-creative'
    elif template_id in ['photo-profile', 'warm-side', 'double-column']:
        layout_style = 'sidebar-profile'
    elif template_id in ['ats-clean', 'simple-ats', 'fresher-starter']:
        layout_style = 'ats'
    elif template_id in ['executive-pro', 'professional-elegant']:
        layout_style = 'executive'
    elif template_id in ['tech-stack', 'timeline-pro']:
        layout_style = 'tech'
    elif template_id in ['modern-minimal', 'classic-box']:
        layout_style = 'minimalist'

    bg_color = r.bg_color or '#6366f1'

    buf = io.BytesIO()
    p = canvas.Canvas(buf, pagesize=letter)
    width, height = letter

    current_page = [1]

    def draw_text_wrap(canvas_obj, text, x, y, wrap_width, font_name='Helvetica', font_size=10, line_height=13, limit_y=40):
        canvas_obj.setFont(font_name, font_size)
        canvas_obj.setFillColor('#1e293b')
        words = text.replace('\r\n', '\n').split(' ')
        lines = []
        current_line = []
        for word in words:
            if '\n' in word:
                parts = word.split('\n')
                for i_part, part in enumerate(parts):
                    if i_part > 0:
                        lines.append(' '.join(current_line))
                        current_line = []
                    current_line.append(part)
            else:
                current_line.append(word)
                test_str = ' '.join(current_line)
                if canvas_obj.stringWidth(test_str, font_name, font_size) > wrap_width:
                    current_line.pop()
                    lines.append(' '.join(current_line))
                    current_line = [word]
        if current_line:
            lines.append(' '.join(current_line))
        for line in lines:
            if y < limit_y:
                canvas_obj.showPage()
                y = height - 50
                current_page[0] += 1
                if layout_style == 'sidebar-profile':
                    canvas_obj.setFillColor('#f1f5f9')
                    canvas_obj.rect(0, 0, 190, height, fill=1, stroke=0)
                    canvas_obj.setFillColor('#1e293b')
            canvas_obj.drawString(x, y, line)
            y -= line_height
        return y

    def draw_section_hdr(canvas_obj, title, x, y, hdr_width, accent_color):
        y -= 12
        if y < 60:
            canvas_obj.showPage()
            y = height - 50
            current_page[0] += 1
            if layout_style == 'sidebar-profile':
                canvas_obj.setFillColor('#f1f5f9')
                canvas_obj.rect(0, 0, 190, height, fill=1, stroke=0)
        canvas_obj.setFillColor(accent_color)
        canvas_obj.roundRect(x, y - 2, 4, 14, 2, fill=1, stroke=0)
        canvas_obj.setFillColor('#0f172a')
        canvas_obj.setFont('Helvetica-Bold', 12)
        canvas_obj.drawString(x + 10, y, title)
        y -= 4
        canvas_obj.setStrokeColor('#e2e8f0')
        canvas_obj.setLineWidth(1)
        canvas_obj.line(x, y, x + hdr_width, y)
        y -= 12
        return y

    if layout_style == 'gradient-creative':
        p.setFillColor(bg_color)
        p.rect(0, height - 120, width, 120, fill=1, stroke=0)
        p.setFillColor('#ffffff')
        p.setFont('Helvetica-Bold', 24)
        p.drawString(40, height - 55, r.name or 'Untitled')
        p.setFont('Helvetica', 11)
        p.drawString(40, height - 75, r.email or '')

        if r.photo:
            try:
                from reportlab.lib.utils import ImageReader
                import base64
                from PIL import Image, ImageOps, ImageDraw
                header_data = r.photo.split(',', 1)[1]
                img_bytes = base64.b64decode(header_data)
                pil = Image.open(io.BytesIO(img_bytes)).convert('RGBA')
                size = (80, 80)
                pil = ImageOps.fit(pil, size, Image.LANCZOS)
                mask = Image.new('L', size, 0)
                draw = ImageDraw.Draw(mask)
                if photo_shape == 'circle':
                    draw.ellipse((0, 0, size[0], size[1]), fill=255)
                elif photo_shape == 'rounded':
                    draw.rounded_rectangle((0, 0, size[0], size[1]), radius=14, fill=255)
                else:
                    draw.rectangle((0, 0, size[0], size[1]), fill=255)
                pil.putalpha(mask)
                out_buf = io.BytesIO()
                pil.save(out_buf, format='PNG')
                out_buf.seek(0)
                img = ImageReader(out_buf)
                p.drawImage(img, width - 120, height - 100, width=80, height=80, mask='auto')
            except Exception:
                pass

        y = height - 160
        margin = 40
        content_width = width - margin * 2
        col_width = (content_width - 20) / 2

        backup_y = y
        y = draw_section_hdr(p, 'Education', margin, y, col_width, bg_color)
        y = draw_text_wrap(p, r.education or 'No education listed.', margin, y, col_width, font_size=9)
        end_col1_y = y
        y = backup_y
        y = draw_section_hdr(p, 'Skills', margin + col_width + 20, y, col_width, bg_color)
        skills_str = ', '.join([s.strip() for s in (r.skills or '').split('\n') if s.strip()])
        y = draw_text_wrap(p, skills_str or 'No skills listed.', margin + col_width + 20, y, col_width, font_size=9)
        y = min(end_col1_y, y) - 20

        y = draw_section_hdr(p, 'Projects & Experience', margin, y, content_width, bg_color)
        project_bullets = [b for b in bullets if not b.startswith('Technologies:')]
        if project_bullets:
            for bullet in project_bullets:
                y = draw_text_wrap(p, '• ' + bullet, margin + 8, y, content_width - 8, font_size=10)
                y -= 2
        elif r.projects:
            y = draw_text_wrap(p, r.projects, margin, y, content_width, font_size=10)
        else:
            y = draw_text_wrap(p, 'No projects listed.', margin, y, content_width, font_size=9)

        if sections:
            for sec in sections:
                y = draw_section_hdr(p, sec.get('title', 'Section'), margin, y, content_width, bg_color)
                y = draw_text_wrap(p, sec.get('content', '') or '', margin, y, content_width, font_size=10)

    elif layout_style == 'sidebar-profile':
        p.setFillColor('#f1f5f9')
        p.rect(0, 0, 190, height, fill=1, stroke=0)
        right_x = 210
        right_width = width - right_x - 40
        y = height - 60
        p.setFillColor('#0f172a')
        p.setFont('Helvetica-Bold', 24)
        p.drawString(right_x, y, r.name or 'Untitled')
        y -= 16
        p.setFont('Helvetica', 11)
        p.setFillColor('#475569')
        p.drawString(right_x, y, r.email or '')
        y -= 20

        side_y = height - 50
        if r.photo:
            try:
                from reportlab.lib.utils import ImageReader
                import base64
                from PIL import Image, ImageOps, ImageDraw
                header_data = r.photo.split(',', 1)[1]
                img_bytes = base64.b64decode(header_data)
                pil = Image.open(io.BytesIO(img_bytes)).convert('RGBA')
                size = (90, 90)
                pil = ImageOps.fit(pil, size, Image.LANCZOS)
                mask = Image.new('L', size, 0)
                draw = ImageDraw.Draw(mask)
                if photo_shape == 'circle':
                    draw.ellipse((0, 0, size[0], size[1]), fill=255)
                elif photo_shape == 'rounded':
                    draw.rounded_rectangle((0, 0, size[0], size[1]), radius=18, fill=255)
                else:
                    draw.rectangle((0, 0, size[0], size[1]), fill=255)
                pil.putalpha(mask)
                out_buf = io.BytesIO()
                pil.save(out_buf, format='PNG')
                out_buf.seek(0)
                img = ImageReader(out_buf)
                p.drawImage(img, 50, side_y - 90, width=90, height=90, mask='auto')
                side_y -= 110
            except Exception:
                side_y -= 10

        p.setFont('Helvetica-Bold', 11)
        p.setFillColor(bg_color)
        p.drawString(30, side_y, 'CONTACT')
        side_y -= 15
        p.setFont('Helvetica', 9)
        p.setFillColor('#334155')
        p.drawString(30, side_y, r.email or '')
        side_y -= 25

        p.setFont('Helvetica-Bold', 11)
        p.setFillColor(bg_color)
        p.drawString(30, side_y, 'EDUCATION')
        side_y -= 15
        for line in (r.education or 'No education listed.').split('\n'):
            p.setFont('Helvetica', 9)
            p.setFillColor('#334155')
            p.drawString(30, side_y, line.strip())
            side_y -= 12
        side_y -= 15

        p.setFont('Helvetica-Bold', 11)
        p.setFillColor(bg_color)
        p.drawString(30, side_y, 'SKILLS')
        side_y -= 15
        for skill in (r.skills or '').split('\n'):
            if skill.strip():
                p.setFont('Helvetica', 9)
                p.setFillColor('#334155')
                p.drawString(30, side_y, '• ' + skill.strip())
                side_y -= 12

        y = draw_section_hdr(p, 'Projects & Experience', right_x, y, right_width, bg_color)
        project_bullets = [b for b in bullets if not b.startswith('Technologies:')]
        if project_bullets:
            for bullet in project_bullets:
                y = draw_text_wrap(p, '• ' + bullet, right_x + 8, y, right_width - 8, font_size=10)
                y -= 2
        elif r.projects:
            y = draw_text_wrap(p, r.projects, right_x, y, right_width, font_size=10)
        else:
            y = draw_text_wrap(p, 'No projects listed.', right_x, y, right_width, font_size=9)

        if sections:
            for sec in sections:
                y = draw_section_hdr(p, sec.get('title', 'Section'), right_x, y, right_width, bg_color)
                y = draw_text_wrap(p, sec.get('content', '') or '', right_x, y, right_width, font_size=10)

    else:
        margin = 40
        content_width = width - margin * 2
        y = height - 50
        p.setFont('Helvetica-Bold', 26)
        p.setFillColor('#0f172a')
        p.drawString(margin, y, r.name or 'Untitled')
        y -= 16
        p.setFont('Helvetica', 11)
        p.setFillColor('#475569')
        p.drawString(margin, y, r.email or '')
        y -= 12

        p.setStrokeColor('#0f172a')
        p.setLineWidth(2)
        p.line(margin, y, width - margin, y)
        y -= 20

        col_width = (content_width - 20) / 2
        backup_y = y
        y = draw_section_hdr(p, 'Education', margin, y, col_width, bg_color)
        y = draw_text_wrap(p, r.education or 'No education listed.', margin, y, col_width, font_size=9)
        end_col1_y = y
        y = backup_y
        y = draw_section_hdr(p, 'Skills', margin + col_width + 20, y, col_width, bg_color)
        skills_str = ' • '.join([s.strip() for s in (r.skills or '').split('\n') if s.strip()])
        y = draw_text_wrap(p, skills_str or 'No skills listed.', margin + col_width + 20, y, col_width, font_size=9)
        y = min(end_col1_y, y) - 20

        y = draw_section_hdr(p, 'Projects & Experience', margin, y, content_width, bg_color)
        project_bullets = [b for b in bullets if not b.startswith('Technologies:')]
        if project_bullets:
            for bullet in project_bullets:
                y = draw_text_wrap(p, '• ' + bullet, margin + 8, y, content_width - 8, font_size=10)
                y -= 2
        elif r.projects:
            y = draw_text_wrap(p, r.projects, margin, y, content_width, font_size=10)
        else:
            y = draw_text_wrap(p, 'No projects listed.', margin, y, content_width, font_size=9)

        if sections:
            for sec in sections:
                y = draw_section_hdr(p, sec.get('title', 'Section'), margin, y, content_width, bg_color)
                y = draw_text_wrap(p, sec.get('content', '') or '', margin, y, content_width, font_size=10)

    p.save()
    buf.seek(0)
    return send_file(buf, as_attachment=True, download_name=f"resume_{resume_id}.pdf", mimetype='application/pdf')

if __name__ == '__main__':
    app.run(debug=True, port=int(os.environ.get('PORT', 5000)))
