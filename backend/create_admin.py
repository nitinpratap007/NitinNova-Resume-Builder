from models import SessionLocal, User
from werkzeug.security import generate_password_hash

if __name__ == '__main__':
    db = SessionLocal()
    try:
        email = input('Admin email: ').strip()
        name = input('Admin name: ').strip()
        password = input('Admin password: ').strip()

        if not email or not password:
            print('Email and password are required.')
            raise SystemExit(1)

        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f'Admin already exists with email: {email}')
        else:
            admin = User(
                name=name or 'Admin',
                email=email,
                password_hash=generate_password_hash(password),
                is_admin=1
            )
            db.add(admin)
            db.commit()
            print(f'Admin created with ID: {admin.id}')
    finally:
        db.close()
