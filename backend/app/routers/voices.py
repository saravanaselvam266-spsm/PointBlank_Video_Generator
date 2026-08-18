import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import User, DoctorProfile, Voice, get_next_pb_id
from app.schemas import VoiceCreate, VoiceResponse
from app.dependencies.auth import get_current_user
from app.services.azure_blob import azure_blob_service
from app.services.heygen_service import heygen_service
from app.services.media_utils import (
    sniff_audio_content_type,
    is_clonable_audio_content_type,
    MAX_VOICE_CLONE_UPLOAD_BYTES,
    MIN_VOICE_CLONE_UPLOAD_BYTES,
)
from app.services.media_resolve import (
    mirror_voice_preview_to_azure,
    resolve_voice_preview_url,
    mirror_voice_source_to_azure,
    resolve_voice_source_preview_url,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/voices", tags=["Saved Voices"])


def _safe_clone_error_message(exc: Exception) -> str:
    """Never surfaces raw provider JSON/errors to the frontend — clean PointBlank copy only."""
    msg = str(exc)
    if "INSUFFICIENT_CREDITS" in msg:
        return "Unable to create the doctor's voice right now. Please contact support."
    if "VOICE_CLONE_FORBIDDEN" in msg:
        return "Voice cloning is not enabled for this account. Please contact support."
    return "Unable to create the doctor's voice. Please try again."


async def _submit_voice_clone(voice: Voice, db: Session) -> None:
    """
    Shared clone-submission step used by both the initial upload and retry:
    reads the ALREADY-STORED original recording from Azure, uploads it to
    HeyGen's asset service, and submits the real POST /v3/voices/clone job.
    Never touches Azure itself — mirror_voice_source_to_azure already stored
    the original recording exactly once, before this is ever called.
    """
    try:
        audio_bytes = azure_blob_service.download_blob(voice.source_audio_blob_name)
        asset_info = await heygen_service.upload_audio_asset(
            audio_bytes,
            filename=voice.original_filename or f"{voice.voice_id}.bin",
            content_type=voice.source_content_type or "audio/mpeg",
        )
        voice_clone_id = await heygen_service.clone_voice(
            asset_id=asset_info["asset_id"],
            voice_name=voice.name,
            language=voice.language,
        )
        voice.heygen_voice_id = voice_clone_id
        voice.clone_status = "cloning"
        voice.clone_failure_reason = None
        db.commit()
        logger.info(f"Voice clone submitted for {voice.voice_id}: heygen voice_clone_id={voice_clone_id}")
    except Exception as exc:
        logger.error(f"Voice clone submission failed for {voice.voice_id}: {exc}")
        db.rollback()
        voice.clone_status = "failed"
        voice.clone_failure_reason = _safe_clone_error_message(exc)
        db.commit()


def _assign_default_if_needed(voice: Voice, db: Session) -> None:
    """First ready voice for a doctor becomes the auto-selected default in Create Video."""
    existing_default = db.query(Voice).filter(
        Voice.doctor_id == voice.doctor_id,
        Voice.is_deleted == False,
        Voice.is_default == True,
        Voice.id != voice.id,
    ).first()
    if not existing_default:
        voice.is_default = True
        db.commit()


@router.post("", response_model=VoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_voice(
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

    # Best-effort mirror of the provider-hosted preview sample to Azure Blob
    # Storage. Storage-only — never blocks saving the voice if it fails.
    if new_voice.preview_url:
        await mirror_voice_preview_to_azure(new_voice, new_voice.preview_url, db)

    res = VoiceResponse.model_validate(new_voice)
    res.doctor_name = doctor.doctor_name
    res.preview_url = resolve_voice_preview_url(new_voice)
    res.source_preview_url = resolve_voice_source_preview_url(new_voice)
    return res


@router.post("/upload", response_model=VoiceResponse, status_code=status.HTTP_201_CREATED)
async def upload_doctor_voice(
    doctor_id: str = Form(...),
    name: str = Form(...),
    language: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Full Doctor Original Voice flow: validate the uploaded recording, store the
    ORIGINAL audio in Azure Blob, then submit it to the real HeyGen voice-cloning
    API (POST /v3/voices/clone) so the returned provider voice_id can later be
    used unmodified in video generation. Never stores audio binaries in Postgres.
    """
    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found.")
    if current_user.role != "ADMIN" and doctor.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to doctor profile.")

    if not name.strip():
        raise HTTPException(status_code=400, detail="Please provide a name for this voice.")

    file_bytes = await file.read()
    if len(file_bytes) < MIN_VOICE_CLONE_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="This recording is too short or empty. Please upload a valid audio file.")
    if len(file_bytes) > MAX_VOICE_CLONE_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Audio file exceeds the 32MB limit. Please upload a shorter recording.")

    # Never trust the filename or the client-declared Content-Type — verify the
    # real format from the bytes themselves, then restrict to what the real
    # cloning API actually accepts (mp3/wav), not merely what we can play back.
    real_content_type = sniff_audio_content_type(file_bytes)
    if not real_content_type or not is_clonable_audio_content_type(real_content_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported audio format. Please upload a WAV or MP3 recording."
        )

    pb_vce_id = get_next_pb_id(db, 'pb_voice_id_seq', 'PB-VCE')

    new_voice = Voice(
        voice_id=pb_vce_id,
        user_id=current_user.id,
        doctor_id=doctor.id,
        name=name.strip(),
        voice_type="cloned",
        heygen_voice_id=None,
        language=language or None,
        clone_status="pending",
        is_deleted=False,
    )
    db.add(new_voice)
    db.commit()
    db.refresh(new_voice)

    logger.info(f"Doctor Original Voice upload started: {pb_vce_id} ('{new_voice.name}') for Doctor={doctor.doctor_name}")

    new_voice.original_filename = file.filename
    try:
        mirror_voice_source_to_azure(new_voice, file_bytes, real_content_type, db)
    except Exception as exc:
        logger.error(f"Azure upload failed for doctor voice {pb_vce_id}: {exc}")
        db.rollback()
        new_voice.clone_status = "failed"
        new_voice.clone_failure_reason = "We couldn't store this recording. Please try uploading again."
        db.commit()
        db.refresh(new_voice)
        res = VoiceResponse.model_validate(new_voice)
        res.doctor_name = doctor.doctor_name
        return res

    # Original audio safely stored — now submit the REAL voice-cloning job.
    # A failure here never deletes the stored recording; status flips to
    # 'failed' and the user can retry from the same original audio.
    await _submit_voice_clone(new_voice, db)

    db.refresh(new_voice)
    res = VoiceResponse.model_validate(new_voice)
    res.doctor_name = doctor.doctor_name
    res.source_preview_url = resolve_voice_source_preview_url(new_voice)
    return res


@router.get("/{id}/clone-status", response_model=VoiceResponse)
async def get_voice_clone_status(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Polls the real HeyGen voice clone job until it reports 'complete', flipping
    this Voice's clone_status to 'ready' only once the provider itself confirms
    the voice is usable — never shown as ready before that.
    """
    voice = db.query(Voice).filter(Voice.id == id, Voice.is_deleted == False).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice record not found.")
    if current_user.role != "ADMIN" and voice.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to Voice record.")

    if voice.clone_status == "cloning" and voice.heygen_voice_id:
        try:
            status_data = await heygen_service.get_voice_clone_status(voice.heygen_voice_id)
            if status_data["status"] == "complete":
                voice.clone_status = "ready"
                voice.clone_failure_reason = None
                db.commit()
                db.refresh(voice)
                _assign_default_if_needed(voice, db)
                db.refresh(voice)
            elif status_data["status"] == "failed":
                voice.clone_status = "failed"
                voice.clone_failure_reason = "Unable to create the doctor's voice. Please try again."
                db.commit()
                db.refresh(voice)
        except Exception as exc:
            logger.warning(f"Voice clone status poll error for {voice.voice_id}: {exc}")

    res = VoiceResponse.model_validate(voice)
    if voice.doctor:
        res.doctor_name = voice.doctor.doctor_name
    res.source_preview_url = resolve_voice_source_preview_url(voice)
    return res


@router.post("/{id}/retry", response_model=VoiceResponse)
async def retry_voice_clone(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retries cloning using the ORIGINAL recording already stored in Azure — the
    user never has to upload the same audio again.
    """
    voice = db.query(Voice).filter(Voice.id == id, Voice.is_deleted == False).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice record not found.")
    if current_user.role != "ADMIN" and voice.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to Voice record.")

    if not voice.source_audio_blob_name:
        raise HTTPException(status_code=400, detail="No original recording is available to retry. Please upload the voice again.")
    if voice.clone_status not in ("failed",):
        raise HTTPException(status_code=400, detail="This voice is already ready or currently being created.")

    voice.clone_status = "cloning"
    db.commit()

    await _submit_voice_clone(voice, db)

    db.refresh(voice)
    res = VoiceResponse.model_validate(voice)
    if voice.doctor:
        res.doctor_name = voice.doctor.doctor_name
    res.source_preview_url = resolve_voice_source_preview_url(voice)
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
        v_res.preview_url = resolve_voice_preview_url(v)
        v_res.source_preview_url = resolve_voice_source_preview_url(v)
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
    res.preview_url = resolve_voice_preview_url(v)
    res.source_preview_url = resolve_voice_source_preview_url(v)
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
