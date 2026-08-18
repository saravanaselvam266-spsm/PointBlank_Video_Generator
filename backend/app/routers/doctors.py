from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Dict, List

from app.database import get_db
from app.models import User, DoctorProfile, AvatarScenario, Voice, Video, get_next_pb_id
from app.schemas import (
    DoctorCreateRequest,
    DoctorResponse,
    DoctorProfileResponse,
    AvatarScenarioResponse,
    VoiceResponse,
    VideoResponse,
)
from app.dependencies.auth import get_current_user
from app.services.media_resolve import (
    resolve_avatar_photo_url,
    resolve_avatar_thumbnail_url,
    resolve_voice_preview_url,
    resolve_voice_source_preview_url,
    resolve_video_playback_url,
    resolve_video_thumbnail_url,
)

router = APIRouter(prefix="/api/v1/doctors", tags=["Doctors"])

RECENT_VIDEOS_LIMIT = 8


def _counts_for_doctor_ids(db: Session, doctor_ids: List[str]) -> Dict[str, Dict[str, int]]:
    """
    One aggregate COUNT query per media type for the WHOLE batch of doctor_ids
    (never one query per doctor) — avoids the N+1 pattern that previously did
    `len(doc.videos)` inside a per-doctor loop.
    """
    if not doctor_ids:
        return {}

    avatar_rows = (
        db.query(AvatarScenario.doctor_id, func.count(AvatarScenario.id))
        .filter(AvatarScenario.doctor_id.in_(doctor_ids), AvatarScenario.is_deleted == False)
        .group_by(AvatarScenario.doctor_id)
        .all()
    )
    voice_rows = (
        db.query(Voice.doctor_id, func.count(Voice.id))
        .filter(Voice.doctor_id.in_(doctor_ids), Voice.is_deleted == False)
        .group_by(Voice.doctor_id)
        .all()
    )
    video_rows = (
        db.query(Video.doctor_id, func.count(Video.id))
        .filter(Video.doctor_id.in_(doctor_ids), Video.is_deleted == False)
        .group_by(Video.doctor_id)
        .all()
    )

    avatar_counts = {doc_id: cnt for doc_id, cnt in avatar_rows}
    voice_counts = {doc_id: cnt for doc_id, cnt in voice_rows}
    video_counts = {doc_id: cnt for doc_id, cnt in video_rows}

    return {
        doc_id: {
            "scenario_count": avatar_counts.get(doc_id, 0),
            "voice_count": voice_counts.get(doc_id, 0),
            "video_count": video_counts.get(doc_id, 0),
        }
        for doc_id in doctor_ids
    }


def _apply_counts(res: DoctorResponse, doc_id: str, counts: Dict[str, Dict[str, int]]) -> DoctorResponse:
    c = counts.get(doc_id, {"scenario_count": 0, "voice_count": 0, "video_count": 0})
    res.scenario_count = c["scenario_count"]
    res.voice_count = c["voice_count"]
    res.video_count = c["video_count"]
    return res


@router.post("", response_model=DoctorResponse, status_code=status.HTTP_201_CREATED)
def create_doctor(
    doc_req: DoctorCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pb_doc_id = get_next_pb_id(db, 'pb_doctor_id_seq', 'PB-DOC')

    new_doc = DoctorProfile(
        doctor_id=pb_doc_id,
        user_id=current_user.id, # Server-scoped ownership
        doctor_name=doc_req.doctor_name.strip(),
        specialization=doc_req.specialization.strip(),
        avatar_type=doc_req.avatar_type,
        heygen_avatar_id=doc_req.heygen_avatar_id,
        heygen_talking_photo_id=doc_req.heygen_talking_photo_id,
        heygen_voice_id=doc_req.heygen_voice_id
    )

    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    res = DoctorResponse.model_validate(new_doc)
    res.video_count = 0
    res.scenario_count = 0
    res.voice_count = 0
    return res

@router.get("", response_model=List[DoctorResponse])
def list_doctors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "ADMIN":
        doctors = db.query(DoctorProfile).order_by(DoctorProfile.created_at.desc()).all()
    else:
        doctors = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).order_by(DoctorProfile.created_at.desc()).all()

    counts = _counts_for_doctor_ids(db, [doc.id for doc in doctors])

    res_list = []
    for doc in doctors:
        d_res = DoctorResponse.model_validate(doc)
        _apply_counts(d_res, doc.id, counts)
        res_list.append(d_res)

    return res_list

@router.get("/{id}", response_model=DoctorResponse)
def get_doctor(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = db.query(DoctorProfile).filter(DoctorProfile.id == id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor profile not found.")

    if current_user.role != "ADMIN" and doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to this doctor profile.")

    counts = _counts_for_doctor_ids(db, [doc.id])
    d_res = DoctorResponse.model_validate(doc)
    _apply_counts(d_res, doc.id, counts)
    return d_res


@router.get("/{id}/profile", response_model=DoctorProfileResponse)
def get_doctor_profile(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Combined Doctor Profile: doctor metadata + their avatars, voices, and most
    recent videos in ONE request. Exactly 4 targeted queries total (doctor,
    avatars, voices, recent videos) regardless of how much media the doctor
    has — no per-item queries. All media URLs are resolved to fresh, short-lived
    Azure SAS links at response time only; nothing is written back to the DB.
    """
    doc = db.query(DoctorProfile).filter(DoctorProfile.id == id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor profile not found.")

    if current_user.role != "ADMIN" and doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to this doctor profile.")

    scenarios = (
        db.query(AvatarScenario)
        .filter(AvatarScenario.doctor_id == doc.id, AvatarScenario.is_deleted == False)
        .order_by(AvatarScenario.created_at.desc())
        .all()
    )
    voices = (
        db.query(Voice)
        .filter(Voice.doctor_id == doc.id, Voice.is_deleted == False)
        .order_by(Voice.created_at.desc())
        .all()
    )
    recent_videos = (
        db.query(Video)
        .filter(Video.doctor_id == doc.id, Video.is_deleted == False)
        .order_by(Video.created_at.desc())
        .limit(RECENT_VIDEOS_LIMIT)
        .all()
    )

    counts = _counts_for_doctor_ids(db, [doc.id])
    doc_res = DoctorResponse.model_validate(doc)
    _apply_counts(doc_res, doc.id, counts)

    avatar_res_list = []
    for sc in scenarios:
        sc_res = AvatarScenarioResponse.model_validate(sc)
        if sc.look:
            sc_res.look_name = sc.look.name
        sc_res.doctor_name = doc.doctor_name
        sc_res.photo_url = resolve_avatar_photo_url(sc)
        sc_res.thumbnail_url = resolve_avatar_thumbnail_url(sc)
        avatar_res_list.append(sc_res)

    voice_res_list = []
    for v in voices:
        v_res = VoiceResponse.model_validate(v)
        v_res.doctor_name = doc.doctor_name
        v_res.preview_url = resolve_voice_preview_url(v)
        v_res.source_preview_url = resolve_voice_source_preview_url(v)
        voice_res_list.append(v_res)

    video_res_list = []
    for vid in recent_videos:
        vid_res = VideoResponse.model_validate(vid)
        vid_res.doctor_name = doc.doctor_name
        if vid.avatar_scenario:
            vid_res.scenario_name = vid.avatar_scenario.name
        if vid.saved_voice:
            vid_res.voice_name = vid.saved_voice.name
        vid_res.video_url = resolve_video_playback_url(vid)
        vid_res.thumbnail_url = resolve_video_thumbnail_url(vid)
        video_res_list.append(vid_res)

    return DoctorProfileResponse(
        doctor=doc_res,
        avatars=avatar_res_list,
        voices=voice_res_list,
        recent_videos=video_res_list,
    )
