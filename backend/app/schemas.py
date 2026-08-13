from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

# --- AUTH SCHEMAS ---
class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class UserResponse(BaseModel):
    id: str
    user_id: str
    email: EmailStr
    full_name: str
    role: str
    avatar_url: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

class UserPasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str

# --- DOCTOR SCHEMAS ---
class DoctorCreateRequest(BaseModel):
    doctor_name: str
    specialization: str
    avatar_type: str = "public" # 'public', 'photo'
    heygen_avatar_id: Optional[str] = None
    heygen_talking_photo_id: Optional[str] = None
    heygen_voice_id: Optional[str] = None

class DoctorResponse(BaseModel):
    id: str
    doctor_id: str
    user_id: str
    doctor_name: str
    specialization: str
    photo_url: Optional[str] = None
    avatar_type: str
    heygen_avatar_id: Optional[str] = None
    heygen_talking_photo_id: Optional[str] = None
    heygen_voice_id: Optional[str] = None
    video_count: Optional[int] = 0
    scenario_count: Optional[int] = 0
    voice_count: Optional[int] = 0
    created_at: datetime

    class Config:
        from_attributes = True

class PhotoAvatarUploadResponse(BaseModel):
    talking_photo_id: str
    status: Optional[str] = "READY"
    message: Optional[str] = None

# --- AVATAR LOOK SCHEMAS ---
class AvatarLookResponse(BaseModel):
    id: str
    look_id: str
    name: str
    description: str
    preview_image_url: Optional[str] = None
    clothing_style: Optional[str] = None
    background_type: Optional[str] = None
    background_value: Optional[str] = None
    lighting_style: Optional[str] = None
    camera_framing: Optional[str] = None
    body_position: Optional[str] = None
    subject_position: Optional[str] = None
    scale: Optional[str] = None
    crop_style: Optional[str] = None
    aspect_ratio: Optional[str] = None
    transformation_prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    provider_config_json: Optional[Dict[str, Any]] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- PHOTO QUALITY & PREPARATION SCHEMAS ---
class PhotoQualityChecks(BaseModel):
    resolution: str = "GOOD" # "GOOD", "LOW"
    face_detected: bool = True
    face_count: int = 1
    face_position: str = "GOOD" # "GOOD", "OFF_CENTER"
    brightness: str = "GOOD" # "GOOD", "LOW", "HIGH"
    blur: str = "GOOD" # "GOOD", "BLURRY"
    orientation: str = "GOOD"

class PhotoPrepareResponse(BaseModel):
    quality_status: str # "GOOD", "NEEDS_IMPROVEMENT", "POOR"
    checks: PhotoQualityChecks
    recommendations: List[str] = []
    original_photo_url: str
    prepared_photo_url: Optional[str] = None
    is_transformation_configured: bool = False
    transformation_message: Optional[str] = None
    scenario_id: Optional[str] = None

# --- AVATAR SCENARIO SCHEMAS ---
class AvatarScenarioCreate(BaseModel):
    doctor_id: str
    look_id: Optional[str] = None
    name: str
    avatar_type: str = "photo" # 'photo', 'public', 'avatar_iv'
    photo_url: Optional[str] = None
    original_photo_url: Optional[str] = None
    prepared_photo_url: Optional[str] = None
    background_type: Optional[str] = "color"
    background_value: Optional[str] = "#FAFAFA"
    position: Optional[str] = "center"
    scale: Optional[str] = "1.0"
    framing: Optional[str] = "medium"
    aspect_ratio: Optional[str] = "16:9"
    heygen_avatar_id: Optional[str] = None
    heygen_talking_photo_id: Optional[str] = None
    heygen_avatar_group_id: Optional[str] = None
    creation_status: Optional[str] = "DRAFT"
    metadata_json: Optional[Dict[str, Any]] = None

class AvatarScenarioUpdate(BaseModel):
    name: Optional[str] = None
    look_id: Optional[str] = None
    background_type: Optional[str] = None
    background_value: Optional[str] = None
    position: Optional[str] = None
    scale: Optional[str] = None
    framing: Optional[str] = None
    aspect_ratio: Optional[str] = None
    creation_status: Optional[str] = None
    creation_error: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None

class AvatarScenarioResponse(BaseModel):
    id: str
    avatar_scenario_id: str
    user_id: str
    doctor_id: str
    look_id: Optional[str] = None
    name: str
    avatar_type: str
    photo_url: Optional[str] = None
    original_photo_url: Optional[str] = None
    prepared_photo_url: Optional[str] = None
    background_type: Optional[str] = None
    background_value: Optional[str] = None
    position: Optional[str] = None
    scale: Optional[str] = None
    framing: Optional[str] = None
    aspect_ratio: Optional[str] = None
    heygen_base_look_id: Optional[str] = None
    heygen_look_id: Optional[str] = None
    heygen_avatar_id: Optional[str] = None
    heygen_talking_photo_id: Optional[str] = None
    heygen_avatar_group_id: Optional[str] = None
    heygen_preview_image_url: Optional[str] = None
    creation_status: str = "DRAFT"
    creation_error: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime
    doctor_name: Optional[str] = None
    look_name: Optional[str] = None


    class Config:
        from_attributes = True


# --- VOICE SCHEMAS ---
class VoiceCreate(BaseModel):
    doctor_id: str
    name: str
    voice_type: str = "ai_voice" # 'ai_voice', 'cloned', 'uploaded'
    heygen_voice_id: str
    language: Optional[str] = "English"
    gender: Optional[str] = None
    accent: Optional[str] = None
    preview_url: Optional[str] = None
    source_metadata_json: Optional[Dict[str, Any]] = None

class VoiceResponse(BaseModel):
    id: str
    voice_id: str
    user_id: str
    doctor_id: str
    name: str
    voice_type: str
    heygen_voice_id: str
    language: Optional[str] = None
    gender: Optional[str] = None
    accent: Optional[str] = None
    preview_url: Optional[str] = None
    source_metadata_json: Optional[Dict[str, Any]] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime
    doctor_name: Optional[str] = None

    class Config:
        from_attributes = True

# --- VIDEO SCHEMAS ---
class VideoGenerateRequest(BaseModel):
    doctor_id: str
    avatar_scenario_id: Optional[str] = None
    voice_id: Optional[str] = None
    avatar_type: Optional[str] = "public" # 'public', 'photo', 'avatar_iv'
    heygen_avatar_id: Optional[str] = None
    heygen_talking_photo_id: Optional[str] = None
    heygen_voice_id: Optional[str] = None
    script: str
    settings: Dict[str, Any] = Field(default_factory=dict)

class VideoResponse(BaseModel):
    id: str
    video_id: str
    user_id: str
    doctor_id: str
    avatar_scenario_id: Optional[str] = None
    voice_id: Optional[str] = None
    heygen_video_id: Optional[str] = None
    avatar_type: str
    heygen_avatar_id: Optional[str] = None
    heygen_talking_photo_id: Optional[str] = None
    heygen_voice_id: str
    script: str
    settings_json: Dict[str, Any]
    status: str
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    storage_key: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    doctor_name: Optional[str] = None
    scenario_name: Optional[str] = None
    voice_name: Optional[str] = None

    class Config:
        from_attributes = True

# --- DASHBOARD SCHEMAS ---
class DashboardSummaryResponse(BaseModel):
    total_doctors: int
    total_scenarios: int = 0
    total_voices: int = 0
    total_videos: int
    processing_videos: int
    completed_videos: int
    recent_videos: List[VideoResponse]

# --- PUBLIC SHARE SCHEMAS ---
class PublicShareResponse(BaseModel):
    qr_id: Optional[str] = None
    public_token: str
    public_url: Optional[str] = None
    qr_image: Optional[str] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    script: Optional[str] = None
    doctor_name: Optional[str] = None
    specialization: Optional[str] = None
    created_at: Optional[datetime] = None
