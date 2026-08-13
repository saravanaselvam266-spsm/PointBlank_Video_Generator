import sys
from app.database import SessionLocal
from app.models import User, get_next_pb_id
from app.services.auth_service import hash_password
from app.config import settings

def create_initial_admin():
    db = SessionLocal()
    try:
        admin_email = settings.INITIAL_ADMIN_EMAIL.lower().strip()
        existing = db.query(User).filter(User.email == admin_email).first()

        if existing:
            print(f"Admin user '{admin_email}' already exists (ID: {existing.user_id}).")
            return existing

        pb_user_id = get_next_pb_id(db, 'pb_user_id_seq', 'PB-USR')
        hashed_pw = hash_password(settings.INITIAL_ADMIN_PASSWORD)

        admin = User(
            user_id=pb_user_id,
            email=admin_email,
            full_name=settings.INITIAL_ADMIN_NAME,
            hashed_password=hashed_pw,
            role="ADMIN",
            is_active=True
        )

        db.add(admin)
        db.commit()
        db.refresh(admin)

        print(f"Initial Admin user created successfully: ID {admin.user_id}, Email {admin.email}")
        return admin

    except Exception as e:
        db.rollback()
        print(f"Error creating initial admin: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    create_initial_admin()
