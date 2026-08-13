import os
import sqlite3
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import User, DoctorProfile, Video, PublicVideoShare
from app.scripts.create_admin import create_initial_admin

SQLITE_DB_PATH = r"c:\Users\SaravanaPerumalSelva\OneDrive - Systech Solutions, Inc\SaravanaPerumal\CompanyProjects\Point_Blank_NewVersion\backend\pointblank.db"

def import_sqlite_data():
    if not os.path.exists(SQLITE_DB_PATH):
        print(f"SQLite DB not found at {SQLITE_DB_PATH}, skipping import.")
        return

    admin = create_initial_admin()
    db: Session = SessionLocal()

    try:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # 1. Doctors
        cursor.execute("SELECT * FROM doctors")
        doc_rows = cursor.fetchall()
        print(f"Found {len(doc_rows)} doctor records in SQLite.")

        doc_id_map = {}
        for d in doc_rows:
            existing = db.query(DoctorProfile).filter(DoctorProfile.id == d["id"]).first()
            if not existing:
                new_doc = DoctorProfile(
                    id=d["id"],
                    doctor_id=d["doctor_id"],
                    user_id=admin.id,
                    doctor_name=d["name"],
                    specialization=d["specialization"],
                    avatar_type=d["avatar_type"] or "public",
                    heygen_avatar_id=d["heygen_avatar_id"],
                    heygen_talking_photo_id=d["heygen_talking_photo_id"],
                    heygen_voice_id=d["heygen_voice_id"]
                )
                db.add(new_doc)
                doc_id_map[d["id"]] = new_doc
                print(f"Imported Doctor: {d['name']} ({d['doctor_id']})")
            else:
                doc_id_map[d["id"]] = existing

        db.commit()

        # 2. Videos
        cursor.execute("SELECT * FROM videos")
        vid_rows = cursor.fetchall()
        print(f"Found {len(vid_rows)} video records in SQLite.")

        for v in vid_rows:
            existing = db.query(Video).filter(Video.id == v["id"]).first()
            if not existing:
                import json
                settings_json = json.loads(v["settings"]) if v["settings"] else {}
                new_vid = Video(
                    id=v["id"],
                    video_id=v["video_id"],
                    user_id=admin.id,
                    doctor_id=v["doctor_id"],
                    heygen_video_id=v["heygen_video_id"],
                    avatar_type=v["avatar_type"] or "public",
                    heygen_avatar_id=v["heygen_avatar_id"],
                    heygen_talking_photo_id=v["heygen_talking_photo_id"],
                    heygen_voice_id=v["heygen_voice_id"],
                    script=v["script"],
                    settings_json=settings_json,
                    status=v["status"],
                    video_url=v["video_url"],
                    thumbnail_url=v["thumbnail_url"],
                    storage_key=v["storage_path"],
                    error_message=v["error_message"]
                )
                db.add(new_vid)
                print(f"Imported Video: {v['video_id']} (HeyGen ID: {v['heygen_video_id']})")

        db.commit()

        print("SQLite data import completed successfully!")
        conn.close()

    except Exception as e:
        db.rollback()
        print(f"Error importing SQLite data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    import_sqlite_data()
