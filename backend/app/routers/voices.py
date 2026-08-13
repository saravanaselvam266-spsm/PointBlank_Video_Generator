import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import User, DoctorProfile, Voice, get_next_pb_id
from app.schemas import VoiceCreate, VoiceResponse
from app.dependencies.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/voices", tags=["Saved Voices"])


@router.post("", response_model=VoiceResponse, status_code=status.HTTP_201_CREATED)
def create_voice(
    req: VoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save a Voice for Doctor context.
    Enforces strict Doctor + User ownership isolation.
    """
    # 1. Verify doctor exists and belongs to current user
    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == req.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found.")

    if current_user.role != "ADMIN" and doctor.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to doctor profile.")

    # 2. Generate PB-VCE-xxxx ID
    pb_vce_id = get_next_pb_id(db, 'pb_voice_id_seq', 'PB-VCE')

    new_voice = Voice(
        voice_id=pb_vce_id,
        user_id=current_user.id,
        doctor_id=doctor.id,
        name=req.name.strip(),
        voice_type=req.voice_type or "ai_voice",
        heygen_voice_id=req.heygen_voice_id.strip(),
        language=req.language or "English",
        gender=req.gender,
        accent=req.accent,
        preview_url=req.preview_url,
        source_metadata_json=req.source_metadata_json or {},
        is_deleted=False
    )

    db.add(new_voice)
    db.commit()
    db.refresh(new_voice)

    logger.info(f"Saved Voice Created: {pb_vce_id} ('{new_voice.name}') for Doctor={doctor.doctor_name}")

    res = VoiceResponse.model_validate(new_voice)
    res.doctor_name = doctor.doctor_name
    return res


@router.get("", response_model=List[VoiceResponse])
def list_voices(
    doctor_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List active saved voices for current user (optionally filtered by doctor_id).
    Strict backend doctor isolation.
    """
    query = db.query(Voice).filter(Voice.is_deleted == False)

    if current_user.role != "ADMIN":
        query = query.filter(Voice.user_id == current_user.id)

    if doctor_id:
        query = query.filter(Voice.doctor_id == doctor_id)

    voices = query.order_by(Voice.created_at.desc()).all()

    res_list = []
    for v in voices:
        v_res = VoiceResponse.model_validate(v)
        if v.doctor:
            v_res.doctor_name = v.doctor.doctor_name
        res_list.append(v_res)

    return res_list


@router.get("/{id}", response_model=VoiceResponse)
def get_voice_details(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get details for a specific saved voice."""
    v = db.query(Voice).filter(Voice.id == id, Voice.is_deleted == False).first()
    if not v:
        raise HTTPException(status_code=404, detail="Voice record not found.")

    if current_user.role != "ADMIN" and v.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to Voice record.")

    res = VoiceResponse.model_validate(v)
    if v.doctor:
        res.doctor_name = v.doctor.doctor_name
    return res


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_voice(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft delete a saved Voice (preserves generated video references)."""
    v = db.query(Voice).filter(Voice.id == id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Voice record not found.")

    if current_user.role != "ADMIN" and v.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to Voice record.")

    v.is_deleted = True
    db.commit()
    return None
