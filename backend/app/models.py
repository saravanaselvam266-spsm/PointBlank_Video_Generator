import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Boolean, Sequence, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

# PostgreSQL Sequences for Concurrency-Safe Business IDs
user_id_seq = Sequence('pb_user_id_seq', start=1)
doctor_id_seq = Sequence('pb_doctor_id_seq', start=1)
avatar_scenario_id_seq = Sequence('pb_avatar_scenario_id_seq', start=1)
voice_id_seq = Sequence('pb_voice_id_seq', start=1)
video_id_seq = Sequence('pb_video_id_seq', start=1)
qr_id_seq = Sequence('pb_qr_id_seq', start=1)
look_id_seq = Sequence('pb_look_id_seq', start=1)

def get_next_pb_id(db_session, seq_name: str, prefix: str) -> str:
    """
    Concurrency-safe business ID generator using PostgreSQL sequence with automatic collision protection.
    Handles missing sequence auto-creation and guarantees session transaction rollback on errors.
    """
    table_map = {
        'pb_user_id_seq': ('users', 'user_id'),
        'pb_doctor_id_seq': ('doctors', 'doctor_id'),
        'pb_avatar_scenario_id_seq': ('avatar_scenarios', 'avatar_scenario_id'),
        'pb_voice_id_seq': ('voices', 'voice_id'),
        'pb_video_id_seq': ('videos', 'video_id'),
        'pb_qr_id_seq': ('public_video_shares', 'qr_id'),
        'pb_look_id_seq': ('avatar_looks', 'look_id'),
    }

    try:
        val = db_session.execute(text(f"SELECT nextval('{seq_name}')")).scalar()
    except Exception:
        db_session.rollback()
        try:
            db_session.execute(text(f"CREATE SEQUENCE IF NOT EXISTS {seq_name} START WITH 1"))
            db_session.commit()
            val = db_session.execute(text(f"SELECT nextval('{seq_name}')")).scalar()
        except Exception:
            db_session.rollback()
            return f"{prefix}-{str(uuid.uuid4())[:6].upper()}"

    try:
        candidate_id = f"{prefix}-{val:06d}"

        if seq_name in table_map:
            table_name, col_name = table_map[seq_name]
            exists = db_session.execute(
                text(f"SELECT 1 FROM {table_name} WHERE {col_name} = :cid"),
                {"cid": candidate_id}
            ).scalar()

            if exists:
                max_num = db_session.execute(
                    text(f"SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace({col_name}, '[^0-9]', '', 'g'), '') AS INTEGER)), 0) FROM {table_name}")
                ).scalar()
                new_val = db_session.execute(
                    text(f"SELECT setval('{seq_name}', {max_num + 1})")
                ).scalar()
                candidate_id = f"{prefix}-{new_val:06d}"

        return candidate_id
    except Exception:
        db_session.rollback()
        return f"{prefix}-{str(uuid.uuid4())[:6].upper()}"

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(50), unique=True, nullable=False, index=True) # PB-USR-000001
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(Text, nullable=False)
    role = Column(String(50), nullable=False, default="USER", index=True) # 'ADMIN', 'DOCTOR', 'USER'
    avatar_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    doctors = relationship("DoctorProfile", back_populates="user", cascade="all, delete-orphan")
    avatar_scenarios = relationship("AvatarScenario", back_populates="user", cascade="all, delete-orphan")
    saved_voices = relationship("Voice", back_populates="user", cascade="all, delete-orphan")
    videos = relationship("Video", back_populates="user", cascade="all, delete-orphan")

class DoctorProfile(Base):
    __tablename__ = "doctors"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    doctor_id = Column(String(50), unique=True, nullable=False, index=True) # Format: PB-DOC-000001
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_name = Column(String(255), nullable=False)
    specialization = Column(String(255), nullable=False)
    photo_url = Column(Text, nullable=True)
    avatar_type = Column(String(50), default="public") # 'public', 'photo', 'instant'
    
    heygen_avatar_id = Column(String(255), nullable=True, index=True)
    heygen_talking_photo_id = Column(String(255), nullable=True, index=True)
    heygen_avatar_group_id = Column(String(255), nullable=True, index=True)
    heygen_voice_id = Column(String(255), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="doctors")
    avatar_scenarios = relationship("AvatarScenario", back_populates="doctor", cascade="all, delete-orphan")
    saved_voices = relationship("Voice", back_populates="doctor", cascade="all, delete-orphan")
    videos = relationship("Video", back_populates="doctor", cascade="all, delete-orphan")

class AvatarLook(Base):
    __tablename__ = "avatar_looks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    look_id = Column(String(50), unique=True, nullable=False, index=True) # Format: PB-LOOK-000001
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    preview_image_url = Column(Text, nullable=True)
    clothing_style = Column(String(100), nullable=True)
    background_type = Column(String(50), nullable=True)
    background_value = Column(String(500), nullable=True)
    lighting_style = Column(String(100), nullable=True)
    camera_framing = Column(String(100), nullable=True)
    body_position = Column(String(100), nullable=True)
    subject_position = Column(String(100), nullable=True)
    scale = Column(String(50), nullable=True)
    crop_style = Column(String(100), nullable=True)
    aspect_ratio = Column(String(50), nullable=True)
    transformation_prompt = Column(Text, nullable=True)
    negative_prompt = Column(Text, nullable=True)
    provider_config_json = Column(JSONB, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    avatar_scenarios = relationship("AvatarScenario", back_populates="look")

class AvatarScenario(Base):
    __tablename__ = "avatar_scenarios"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    avatar_scenario_id = Column(String(50), unique=True, nullable=False, index=True) # Format: PB-AVT-000001
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id = Column(String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True)
    look_id = Column(String(36), ForeignKey("avatar_looks.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False) # e.g., "Dr. Saravana — Clinic Standing"
    avatar_type = Column(String(50), nullable=False, default="public") # 'photo', 'public', 'avatar_iv'
    photo_url = Column(Text, nullable=True)
    original_photo_url = Column(Text, nullable=True)
    prepared_photo_url = Column(Text, nullable=True)
    
    background_type = Column(String(50), default="color") # 'color', 'clinic', 'office', 'studio', 'custom_url'
    background_value = Column(String(500), default="#FAFAFA")
    position = Column(String(50), default="center") # 'center', 'left', 'right', 'standing', 'sitting'
    scale = Column(String(50), default="1.0")
    framing = Column(String(50), default="medium")
    aspect_ratio = Column(String(50), default="16:9") # '16:9', '9:16', '1:1'
    
    heygen_base_look_id = Column(String(255), nullable=True, index=True)
    heygen_look_id = Column(String(255), nullable=True, index=True)
    heygen_avatar_id = Column(String(255), nullable=True, index=True)
    heygen_talking_photo_id = Column(String(255), nullable=True, index=True)
    heygen_avatar_group_id = Column(String(255), nullable=True, index=True)
    heygen_preview_image_url = Column(Text, nullable=True)
    creation_status = Column(String(50), default="DRAFT", nullable=False, index=True) # 'DRAFT', 'BASE_CREATING', 'BASE_READY', 'LOOK_SUBMITTED', 'LOOK_PROCESSING', 'READY', 'FAILED', 'DELETED'
    creation_error = Column(Text, nullable=True)

    # Azure Blob mirror of the FINAL generated avatar image (the actual asset
    # shown in the Avatar Library), e.g. avatars/PB-DOC-000001/PB-AVT-000001/final.png.
    # azure_preview_blob_name currently points at the same blob — HeyGen returns
    # one avatar image per look, there is no separate higher-res "final" render.
    azure_blob_name = Column(Text, nullable=True)
    azure_preview_blob_name = Column(Text, nullable=True)
    # Azure Blob mirror of the doctor's original uploaded photo, e.g.
    # doctors/PB-DOC-000001/photos/PB-AVT-000001.jpg
    original_photo_azure_blob_name = Column(Text, nullable=True)
    avatar_storage_status = Column(String(50), default="pending", nullable=False, index=True) # pending, uploading, uploaded, failed

    metadata_json = Column(JSONB, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="avatar_scenarios")
    doctor = relationship("DoctorProfile", back_populates="avatar_scenarios")
    look = relationship("AvatarLook", back_populates="avatar_scenarios")
    videos = relationship("Video", back_populates="avatar_scenario")

class Voice(Base):
    __tablename__ = "voices"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    voice_id = Column(String(50), unique=True, nullable=False, index=True) # Format: PB-VCE-000001
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id = Column(String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False) # e.g., "Dr. Saravana Professional Voice"
    voice_type = Column(String(50), nullable=False, default="ai_voice") # 'ai_voice', 'cloned', 'uploaded'
    
    heygen_voice_id = Column(String(255), nullable=False, index=True)
    language = Column(String(100), nullable=True)
    gender = Column(String(50), nullable=True)
    accent = Column(String(100), nullable=True)
    preview_url = Column(String(500), nullable=True)
    source_metadata_json = Column(JSONB, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)

    # Azure Blob mirror of the voice preview audio, e.g.
    # voices/PB-DOC-000001/PB-VCE-000001/preview.mp3. Storage-only — no
    # voice-cloning provider integration exists in this codebase today.
    azure_blob_name = Column(Text, nullable=True)
    voice_storage_status = Column(String(50), default="pending", nullable=False) # pending, uploading, uploaded, failed

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="saved_voices")
    doctor = relationship("DoctorProfile", back_populates="saved_voices")
    videos = relationship("Video", back_populates="saved_voice")

class Video(Base):
    __tablename__ = "videos"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    video_id = Column(String(50), unique=True, nullable=False, index=True) # Format: PB-VID-000001
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id = Column(String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True)
    avatar_scenario_id = Column(String(36), ForeignKey("avatar_scenarios.id", ondelete="SET NULL"), nullable=True, index=True)
    voice_id = Column(String(36), ForeignKey("voices.id", ondelete="SET NULL"), nullable=True, index=True)
    heygen_video_id = Column(String(255), unique=True, nullable=True, index=True) # Official HeyGen Video Job ID
    
    video_type = Column(String(50), default="doctor_video")
    avatar_type = Column(String(50), nullable=False, default="public") # 'public', 'photo'
    heygen_avatar_id = Column(String(255), nullable=True)
    heygen_talking_photo_id = Column(String(255), nullable=True)
    heygen_avatar_group_id = Column(String(255), nullable=True)
    heygen_voice_id = Column(String(255), nullable=False)
    
    script = Column(Text, nullable=False)
    settings_json = Column(JSONB, nullable=False) # aspect_ratio, resolution, captions, background
    status = Column(String(50), default="PENDING", index=True) # PENDING, PROCESSING, COMPLETED, FAILED
    
    video_url = Column(Text, nullable=True) # HeyGen CDN URL
    thumbnail_url = Column(Text, nullable=True)
    storage_key = Column(Text, nullable=True) # Permanent PointBlank Storage Key
    azure_blob_name = Column(Text, nullable=True) # Azure Blob path, e.g. videos/PB-DOC-000001/PB-VID-000001.mp4
    storage_status = Column(String(50), default="pending", index=True) # pending, uploading, uploaded, failed
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="videos")
    doctor = relationship("DoctorProfile", back_populates="videos")
    avatar_scenario = relationship("AvatarScenario", back_populates="videos")
    saved_voice = relationship("Voice", back_populates="videos")
    shares = relationship("PublicVideoShare", back_populates="video", cascade="all, delete-orphan")

class PublicVideoShare(Base):
    __tablename__ = "public_video_shares"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    qr_id = Column(String(50), unique=True, nullable=False, index=True) # Format: PB-QR-000001
    video_id = Column(String(36), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id = Column(String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True)
    
    public_token = Column(String(64), unique=True, nullable=False, index=True) # Secure 256-bit Token
    public_url = Column(Text, nullable=False) # http://localhost:5250/watch/<public_token>
    qr_image = Column(Text, nullable=False) # Base64 Data URI fallback (small, always populated)
    qr_blob_name = Column(Text, nullable=True) # Azure Blob path, e.g. qr/PB-DOC-000001/PB-VID-000001.png — primary serving path once uploaded

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    video = relationship("Video", back_populates="shares")

