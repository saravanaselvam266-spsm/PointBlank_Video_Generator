from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import PublicVideoShare, Video, DoctorProfile
from app.schemas import PublicShareResponse
from app.config import settings
from app.services.media_resolve import resolve_video_playback_url, resolve_qr_image

router = APIRouter(prefix="/api/v1/public", tags=["Public Video & QR"])

@router.get("/watch/{public_token}", response_model=PublicShareResponse)
def get_public_video(public_token: str, db: Session = Depends(get_db)):
    """
    Serves public video watch metadata securely via 256-bit cryptographic public_token.
    Zero internal HeyGen IDs, database UUIDs, or API keys are exposed.
    Prefers PointBlank's own Azure-backed copy of the video/QR over the
    provider's raw CDN URL whenever it has been mirrored.
    """
    share = db.query(PublicVideoShare).filter(PublicVideoShare.public_token == public_token).first()
    if not share:
        raise HTTPException(status_code=404, detail="Public video link not found or expired")

    video = db.query(Video).filter(Video.id == share.video_id).first()
    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == share.doctor_id).first()

    if not video or not doctor:
        raise HTTPException(status_code=404, detail="Associated video or doctor record not found")

    return PublicShareResponse(
        public_token=share.public_token,
        public_url=share.public_url,
        qr_image=resolve_qr_image(share),
        doctor_name=doctor.doctor_name,
        specialization=doctor.specialization,
        script=video.script,
        video_url=resolve_video_playback_url(video),
        thumbnail_url=video.thumbnail_url,
        created_at=video.created_at
    )
