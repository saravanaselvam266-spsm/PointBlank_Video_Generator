import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import User, DoctorProfile, Video, AvatarScenario, Voice, get_next_pb_id, utc_now
from app.schemas import VideoGenerateRequest, VideoResponse
from app.dependencies.auth import get_current_user
from app.services.heygen_service import heygen_service
from app.services.storage_service import storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/videos", tags=["Videos"])


@router.post("/generate", response_model=VideoResponse, status_code=status.HTTP_201_CREATED)
async def generate_video(
    req: VideoGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit a new HeyGen AI video generation job.
    Supports Doctor Avatar Scenarios (PB-AVT-xxxx) and Saved Voices (PB-VCE-xxxx).
    Enforces strict Doctor + User ownership isolation.
    """
    # 1. Verify doctor profile exists & belongs to current user
    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == req.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Selected doctor profile not found.")

    if current_user.role != "ADMIN" and doctor.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to doctor profile.")

    # 2. Resolve Avatar Scenario & Voice records if IDs are provided
    target_scenario = None
    if req.avatar_scenario_id:
        target_scenario = db.query(AvatarScenario).filter(
            (AvatarScenario.id == req.avatar_scenario_id) | (AvatarScenario.avatar_scenario_id == req.avatar_scenario_id)
        ).first()
        if not target_scenario:
            raise HTTPException(status_code=404, detail="Selected Avatar Scenario not found.")
        if current_user.role != "ADMIN" and target_scenario.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied to Avatar Scenario.")
        if target_scenario.doctor_id != doctor.id:
            raise HTTPException(status_code=400, detail="Avatar Scenario does not belong to the selected Doctor.")

    target_voice = None
    if req.voice_id:
        target_voice = db.query(Voice).filter(
            (Voice.id == req.voice_id) | (Voice.voice_id == req.voice_id)
        ).first()
        if not target_voice:
            raise HTTPException(status_code=404, detail="Selected Voice record not found.")
        if current_user.role != "ADMIN" and target_voice.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied to Voice record.")
        if target_voice.doctor_id != doctor.id:
            raise HTTPException(status_code=400, detail="Voice record does not belong to the selected Doctor.")

    # 3. Resolve exact stored HeyGen resource identifiers (NEVER transformed or hardcoded)
    if target_scenario:
        resolved_avatar_type = target_scenario.avatar_type
        resolved_avatar_id = target_scenario.heygen_avatar_id
        resolved_talking_photo = target_scenario.heygen_talking_photo_id
        resolved_group_id = target_scenario.heygen_avatar_group_id
        scenario_db_id = target_scenario.id
    else:
        resolved_avatar_type = req.avatar_type or "public"
        resolved_avatar_id = req.heygen_avatar_id or doctor.heygen_avatar_id
        resolved_talking_photo = req.heygen_talking_photo_id or doctor.heygen_talking_photo_id
        resolved_group_id = doctor.heygen_avatar_group_id
        scenario_db_id = None

    if target_voice:
        resolved_voice_id = target_voice.heygen_voice_id
        voice_db_id = target_voice.id
    else:
        resolved_voice_id = req.heygen_voice_id or doctor.heygen_voice_id or "f38a635bee7a4d1f9b0a654a31d050d2"
        voice_db_id = None

    is_photo = (resolved_avatar_type == "photo" or bool(resolved_talking_photo))
    avatar_resource_type = "photo_avatar" if is_photo else "studio_avatar"
    target_heygen_id = resolved_talking_photo if is_photo else resolved_avatar_id

    if not target_heygen_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected Avatar Scenario has no valid HeyGen avatar or talking photo ID. Please select another avatar."
        )

    resolved_settings = req.settings or {}
    if target_scenario:
        # Merge scenario settings defaults
        resolved_settings = {
            "aspect_ratio": target_scenario.aspect_ratio or "16:9",
            "background_type": target_scenario.background_type or "color",
            "background_value": target_scenario.background_value or "#FAFAFA",
            "position": target_scenario.position or "center",
            "scale": target_scenario.scale or "1.0",
            "framing": target_scenario.framing or "medium",
            "captions": False,
            "speed": 1.0,
            **resolved_settings
        }
    else:
        resolved_settings = {
            "aspect_ratio": "16:9",
            "captions": False,
            "background_color": "#FAFAFA",
            "speed": 1.0,
            **resolved_settings
        }

    engine_name = resolved_settings.get("engine", "avatar_iv" if resolved_avatar_type == "avatar_iv" else "v2")

    # 4. Pre-validate HeyGen ID against live catalog before sending
    available_avatar_ids = set()
    try:
        v2_dict = await heygen_service.get_avatars()
        if isinstance(v2_dict, dict):
            for av in v2_dict.get("avatars", []):
                if av.get("avatar_id"):
                    available_avatar_ids.add(av["avatar_id"])
            for tp in v2_dict.get("talking_photos", []):
                if tp.get("talking_photo_id"):
                    available_avatar_ids.add(tp["talking_photo_id"])
        
        try:
            v3_list = await heygen_service.get_avatars_v3()
            if isinstance(v3_list, list):
                for av in v3_list:
                    if av.get("id"):
                        available_avatar_ids.add(av["id"])
                    if av.get("avatar_id"):
                        available_avatar_ids.add(av["avatar_id"])
        except Exception:
            pass
    except Exception as fetch_err:
        logger.warning(f"Failed to fetch live catalog for pre-validation: {fetch_err}")

    if available_avatar_ids and target_heygen_id not in available_avatar_ids:
        logger.warning(f"Avatar validation failed: ID '{target_heygen_id}' not in live catalog.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected HeyGen avatar is no longer available. Refresh the Avatar Library and select another avatar."
        )

    # 5. Create Video record in PENDING state
    pb_video_id = get_next_pb_id(db, 'pb_video_id_seq', 'PB-VID')

    new_video = Video(
        video_id=pb_video_id,
        user_id=current_user.id,
        doctor_id=doctor.id,
        avatar_scenario_id=scenario_db_id,
        voice_id=voice_db_id,
        avatar_type=avatar_resource_type,
        heygen_avatar_id=resolved_avatar_id,
        heygen_talking_photo_id=resolved_talking_photo,
        heygen_avatar_group_id=resolved_group_id,
        heygen_voice_id=resolved_voice_id,
        script=req.script.strip(),
        settings_json={**resolved_settings, "engine": engine_name},
        status="PENDING"
    )

    db.add(new_video)
    db.commit()
    db.refresh(new_video)

    logger.info(
        f"Video Record Created: {pb_video_id} | Doctor={doctor.doctor_name} | "
        f"AvatarScenario={target_scenario.name if target_scenario else 'Inline'} | "
        f"Voice={target_voice.name if target_voice else resolved_voice_id}"
    )

    # 6. Submit real payload to HeyGen API
    try:
        aspect_ratio = resolved_settings.get("aspect_ratio", "16:9")
        captions = bool(resolved_settings.get("captions", False))
        background_color = resolved_settings.get("background_value") or resolved_settings.get("background_color") or "#FAFAFA"
        if not background_color.startswith("#"):
            background_color = "#FAFAFA"
        speed = float(resolved_settings.get("speed", 1.0))
        heygen_video_id = None

        if engine_name == "avatar_iv":
            try:
                heygen_video_id = await heygen_service.generate_video_v3(
                    script=new_video.script,
                    heygen_voice_id=resolved_voice_id,
                    avatar_id=target_heygen_id,
                    engine="avatar_iv",
                    aspect_ratio=aspect_ratio
                )
            except Exception as v3_err:
                logger.warning(f"V3 generate_video_v3 failed ({v3_err}), falling back to V2 endpoint...")
                heygen_video_id = None

        if not heygen_video_id:
            heygen_video_id = await heygen_service.generate_video(
                script=new_video.script,
                heygen_voice_id=resolved_voice_id,
                avatar_type=avatar_resource_type,
                heygen_avatar_id=resolved_avatar_id,
                heygen_talking_photo_id=resolved_talking_photo,
                aspect_ratio=aspect_ratio,
                captions=captions,
                background_color=background_color,
                speed=speed
            )

        if not heygen_video_id:
            raise RuntimeError("HeyGen API did not return a valid video_id.")

        new_video.heygen_video_id = heygen_video_id
        new_video.status = "PROCESSING"
        db.commit()
        db.refresh(new_video)

        logger.info(f"HeyGen Job Submitted Successfully! pb_video_id={pb_video_id} | heygen_video_id={heygen_video_id}")

    except Exception as exc:
        err_msg = str(exc)
        logger.error(f"HeyGen submission failed for {pb_video_id}: {err_msg}")
        new_video.status = "FAILED"
        new_video.error_message = err_msg
        db.commit()

        if "INSUFFICIENT_CREDITS" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="HeyGen API account has insufficient credits. Please top up credits on your HeyGen account dashboard."
            )
        elif "AVATAR_NOT_FOUND" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected HeyGen avatar is no longer available. Refresh the Avatar Library and select another avatar."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"HeyGen Integration Error: {err_msg}"
            )

    res = VideoResponse.model_validate(new_video)
    res.doctor_name = doctor.doctor_name
    if target_scenario:
        res.scenario_name = target_scenario.name
    if target_voice:
        res.voice_name = target_voice.name
    return res


@router.get("/{id}/status", response_model=VideoResponse)
async def get_video_status(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Poll HeyGen for current video status. Updates DB record on completion/failure.
    """
    video = db.query(Video).filter(Video.id == id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video record not found.")

    if current_user.role != "ADMIN" and video.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to video record.")

    # Poll HeyGen if still processing
    if video.status in ("PENDING", "PROCESSING") and video.heygen_video_id:
        try:
            status_data = await heygen_service.get_video_status_v3(video.heygen_video_id)
            h_status = status_data.get("status", "").upper()

            if h_status == "COMPLETED":
                video.status = "COMPLETED"
                video.video_url = status_data.get("video_url")
                video.thumbnail_url = status_data.get("thumbnail_url")
                video.completed_at = utc_now()

                # Download & store locally for permanent access
                if video.video_url:
                    try:
                        storage_result = await storage_service.download_and_store_video(
                            video.video_url, str(video.id)
                        )
                        video.storage_key = storage_result.get("storage_key")
                        logger.info(f"Video {id} stored permanently at {video.storage_key}")
                    except Exception as st_err:
                        logger.warning(f"Storage download failed for {id}: {st_err}")

                db.commit()
                db.refresh(video)

            elif h_status == "FAILED":
                video.status = "FAILED"
                video.error_message = status_data.get("error_message") or "HeyGen rendering failed."
                db.commit()
                db.refresh(video)

        except Exception as poll_err:
            logger.warning(f"Status poll error for video {id}: {poll_err}")

    res = VideoResponse.model_validate(video)
    if video.doctor:
        res.doctor_name = video.doctor.doctor_name
    if video.avatar_scenario:
        res.scenario_name = video.avatar_scenario.name
    if video.saved_voice:
        res.voice_name = video.saved_voice.name
    return res


@router.get("", response_model=List[VideoResponse])
def list_videos(
    doctor_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all videos for the authenticated user (optionally filtered by doctor_id)."""
    query = db.query(Video)
    if current_user.role != "ADMIN":
        query = query.filter(Video.user_id == current_user.id)

    if doctor_id:
        query = query.filter(Video.doctor_id == doctor_id)

    videos = query.order_by(Video.created_at.desc()).all()

    res_list = []
    for v in videos:
        v_res = VideoResponse.model_validate(v)
        if v.doctor:
            v_res.doctor_name = v.doctor.doctor_name
        if v.avatar_scenario:
            v_res.scenario_name = v.avatar_scenario.name
        if v.saved_voice:
            v_res.voice_name = v.saved_voice.name
        res_list.append(v_res)

    return res_list


@router.get("/{id}", response_model=VideoResponse)
def get_video_details(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get full details for a single video record."""
    video = db.query(Video).filter(Video.id == id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video record not found.")

    if current_user.role != "ADMIN" and video.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to video record.")

    res = VideoResponse.model_validate(video)
    if video.doctor:
        res.doctor_name = video.doctor.doctor_name
    if video.avatar_scenario:
        res.scenario_name = video.avatar_scenario.name
    if video.saved_voice:
        res.voice_name = video.saved_voice.name
    return res
