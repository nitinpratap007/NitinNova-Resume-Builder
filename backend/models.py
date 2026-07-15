from sqlalchemy import Column, Integer, String, Text, create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///resumes.db")

Base = declarative_base()

class Resume(Base):
    __tablename__ = "resumes"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=True)
    name = Column(String(200))
    email = Column(String(200))
    education = Column(Text)
    skills = Column(Text)
    projects = Column(Text)
    polished = Column(Text)
    template = Column(String(100), nullable=True)
    template_mode = Column(String(50), nullable=True)
    sections = Column(Text, nullable=True)
    bg_color = Column(String(20), nullable=True)
    photo_shape = Column(String(20), nullable=True)
    photo = Column(Text, nullable=True)

class Template(Base):
    __tablename__ = "templates"
    id = Column(Integer, primary_key=True)
    name = Column(String(200))
    design_json = Column(Text)


class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    name = Column(String(200))
    email = Column(String(200), unique=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    is_admin = Column(Integer, default=0)


class DeveloperInfo(Base):
    __tablename__ = 'developer_info'
    id = Column(Integer, primary_key=True)
    name = Column(String(200))
    bio = Column(Text)
    email = Column(String(200), nullable=True)
    github = Column(String(200), nullable=True)
    instagram = Column(String(200), nullable=True)
    linkedin = Column(String(200), nullable=True)
    contact = Column(Text)
    phone = Column(String(50), nullable=True)
    youtube = Column(String(200), nullable=True)
    portfolio = Column(String(300), nullable=True)
    project_name = Column(String(300), nullable=True)
    project_link = Column(String(300), nullable=True)


class AppSettings(Base):
    __tablename__ = 'app_settings'
    id = Column(Integer, primary_key=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text, nullable=True)


class Invite(Base):
    __tablename__ = 'invites'
    id = Column(Integer, primary_key=True)
    token = Column(String(200), unique=True, nullable=False)
    created_by = Column(Integer, nullable=True)
    used_by = Column(Integer, nullable=True)
    created_at = Column(String(50))
    used_at = Column(String(50), nullable=True)


class Referral(Base):
    __tablename__ = 'referrals'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    token = Column(String(200), unique=True, nullable=False)
    created_at = Column(String(50))
    used_by = Column(Integer, nullable=True)
    used_at = Column(String(50), nullable=True)


class Feedback(Base):
    __tablename__ = 'feedback'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    subject = Column(String(200))
    message = Column(Text)
    created_at = Column(String(50))


class RefreshToken(Base):
    __tablename__ = 'refresh_tokens'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    token_hash = Column(String(300), nullable=False)
    expires_at = Column(String(50), nullable=False)
    revoked = Column(Integer, default=0)
    created_at = Column(String(50), nullable=False)

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        if engine.dialect.name == 'sqlite':
            resume_cols = [row[1] for row in conn.execute(text("PRAGMA table_info('resumes')"))]
            if resume_cols and 'template' not in resume_cols:
                conn.execute(text('ALTER TABLE resumes ADD COLUMN template VARCHAR(100)'))
            if resume_cols and 'template_mode' not in resume_cols:
                conn.execute(text('ALTER TABLE resumes ADD COLUMN template_mode VARCHAR(50)'))
            if resume_cols and 'sections' not in resume_cols:
                conn.execute(text('ALTER TABLE resumes ADD COLUMN sections TEXT'))
            if resume_cols and 'bg_color' not in resume_cols:
                conn.execute(text('ALTER TABLE resumes ADD COLUMN bg_color VARCHAR(20)'))
            if resume_cols and 'photo' not in resume_cols:
                conn.execute(text('ALTER TABLE resumes ADD COLUMN photo TEXT'))
            if resume_cols and 'photo_shape' not in resume_cols:
                conn.execute(text('ALTER TABLE resumes ADD COLUMN photo_shape VARCHAR(20)'))

            dev_cols = [row[1] for row in conn.execute(text("PRAGMA table_info('developer_info')"))]
            if dev_cols and 'email' not in dev_cols:
                conn.execute(text('ALTER TABLE developer_info ADD COLUMN email VARCHAR(200)'))
            if dev_cols and 'github' not in dev_cols:
                conn.execute(text('ALTER TABLE developer_info ADD COLUMN github VARCHAR(200)'))
            if dev_cols and 'instagram' not in dev_cols:
                conn.execute(text('ALTER TABLE developer_info ADD COLUMN instagram VARCHAR(200)'))
            if dev_cols and 'linkedin' not in dev_cols:
                conn.execute(text('ALTER TABLE developer_info ADD COLUMN linkedin VARCHAR(200)'))
            if dev_cols and 'contact' not in dev_cols:
                conn.execute(text('ALTER TABLE developer_info ADD COLUMN contact TEXT'))
            if dev_cols and 'phone' not in dev_cols:
                conn.execute(text('ALTER TABLE developer_info ADD COLUMN phone VARCHAR(50)'))
            if dev_cols and 'youtube' not in dev_cols:
                conn.execute(text('ALTER TABLE developer_info ADD COLUMN youtube VARCHAR(200)'))
            if dev_cols and 'portfolio' not in dev_cols:
                conn.execute(text('ALTER TABLE developer_info ADD COLUMN portfolio VARCHAR(300)'))
            if dev_cols and 'project_name' not in dev_cols:
                conn.execute(text('ALTER TABLE developer_info ADD COLUMN project_name VARCHAR(300)'))
            if dev_cols and 'project_link' not in dev_cols:
                conn.execute(text('ALTER TABLE developer_info ADD COLUMN project_link VARCHAR(300)'))
