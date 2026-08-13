from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import PublicVideoShare, Video, DoctorProfile
from app.schemas import PublicShareResponse
from app.config import settings

router = APIRouter(prefix="/api/v1/public", tags=["Public Video & QR"])

@router.get("/watch/{public_token}", response_model=PublicShareResponse)
def get_public_video(public_token: str, db: Session = Depends(get_db)):
    """
    Serves public video watch metadata securely via 256-bit cryptographic public_token.
    Zero internal HeyGen IDs, database UUIDs, or API keys are exposed.
    Serves video playback from PointBlank permanent storage.
    """
    share = db.query(PublicVideoShare).filter(PublicVideoShare.public_token == public_token).first()
    if not share:
        raise HTTPException(status_code=404, detail="Public video link not found or expired")

    video = db.query(Video).filter(Video.id == share.video_id).first()
    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == share.doctor_id).first()

    if not video or not doctor:
        raise HTTPException(status_code=404, detail="Associated video or doctor record not found")

    # Serve permanent video URL if stored locally
    playback_url = video.video_url
    if video.storage_key:
        playback_url = f"http://localhost:8000/{video.storage_key}"

    return PublicShareResponse(
        public_token=share.public_token,
        public_url=share.public_url,
        qr_image=share.qr_image,
        doctor_name=doctor.doctor_name,
        specialization=doctor.specialization,
        script=video.script,
        video_url=playback_url,
        thumbnail_url=video.thumbnail_url,
        created_at=video.created_at
    )
