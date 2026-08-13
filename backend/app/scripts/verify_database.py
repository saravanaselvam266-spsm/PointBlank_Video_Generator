from sqlalchemy import text
from app.database import engine, SessionLocal
from app.models import User, DoctorProfile, Video, PublicVideoShare

def verify_database():
    print("=== POINTBLANK POSTGRESQL VERIFICATION ===")
    
    # 1. Connection check
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1")).scalar()
        print(f"1. Database Connection (SELECT 1): {'OK' if result == 1 else 'FAILED'}")

    # 2. Query core tables
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        doctor_count = db.query(DoctorProfile).count()
        video_count = db.query(Video).count()
        share_count = db.query(PublicVideoShare).count()

        print(f"2. Core Tables Check:")
        print(f"   - Users Table: {user_count} records (OK)")
        print(f"   - Doctors Table: {doctor_count} records (OK)")
        print(f"   - Videos Table: {video_count} records (OK)")
        print(f"   - Public Video Shares Table: {share_count} records (OK)")

        # 3. Sequences check
        with engine.connect() as conn:
            seqs = ["pb_user_id_seq", "pb_doctor_id_seq", "pb_video_id_seq", "pb_qr_id_seq"]
            print("3. PostgreSQL Sequences Check:")
            for seq in seqs:
                curr = conn.execute(text(f"SELECT last_value FROM {seq}")).scalar()
                print(f"   - Sequence '{seq}': Current Value = {curr} (OK)")

        print("\n=== POSTGRESQL DATABASE VERIFICATION COMPLETE: ALL SYSTEMS GO! ===")

    except Exception as e:
        print(f"Verification error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    verify_database()
