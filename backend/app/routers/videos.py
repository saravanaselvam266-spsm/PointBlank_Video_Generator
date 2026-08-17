import base64
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.config import settings
from app.database import get_db
from app.models import User, DoctorProfile, Video, AvatarScenario, Voice, PublicVideoShare, get_next_pb_id, utc_now
from app.schemas import VideoGenerateRequest, VideoResponse, VideoShareResponse
from app.dependencies.auth import get_current_user
from app.services.heygen_service import heygen_service
from app.services.azure_blob import azure_blob_service
from app.services.qr_service import qr_service
from app.services.media_resolve import resolve_video_playback_url, resolve_qr_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/videos", tags=["Videos"])

AZURE_STORAGE_UPLOAD_FAILED_DETAIL = (
    "Video generation completed, but storing the video in Azure failed. Please retry the storage operation."
)


def _apply_video_response_extras(res: VideoResponse, video: Video) -> VideoResponse:
    """Shared post-model_validate enrichment: related names + Azure-preferred playback URL."""
    if video.doctor:
        res.doctor_name = video.doctor.doctor_name
    if video.avatar_scenario:
        res.scenario_name = video.avatar_scenario.name
    if video.saved_voice:
        res.voice_name = video.saved_voice.name
    res.video_url = resolve_video_playback_url(video)
    return res


def _ensure_public_share(video: Video, db: Session) -> PublicVideoShare:
    """
    Get-or-create the public share (token + QR) for a COMPLETED video. Reuses
    the existing PublicVideoShare model and qr_service — no duplicate sharing
    system. The QR PNG is mirrored to Azure Blob Storage at
    qr/{doctor_id}/{video_id}.png; qr_image keeps a small base64 fallback of
    the SAME bytes for resilience, never a second QR render.
    """
    existing = db.query(PublicVideoShare).filter(PublicVideoShare.video_id == video.id).first()
    if existing:
        return existing

    if video.status != "COMPLETED":
        raise ValueError("Cannot create a public share before the video has completed.")

    doctor_business_id = video.doctor.doctor_id if video.doctor else video.doctor_id
    public_token = qr_service.generate_public_token()
    public_url = f"{settings.PUBLIC_BASE_URL}/watch/{public_token}"
    png_bytes = qr_service.generate_qr_png_bytes(public_url)
    qr_image_fallback = f"data:image/png;base64,{base64.b64encode(png_bytes).decode('utf-8')}"

    qr_blob_name = None
    try:
        blob_name = f"qr/{doctor_business_id}/{video.video_id}.png"
        azure_blob_service.upload_bytes(blob_name, png_bytes, content_type="image/png")
        qr_blob_name = blob_name
    except Exception as exc:
        logger.warning(f"QR Azure mirror failed for video {video.video_id}: {exc}")

    pb_qr_id = get_next_pb_id(db, 'pb_qr_id_seq', 'PB-QR')
    share = PublicVideoShare(
        qr_id=pb_qr_id,
        video_id=video.id,
        doctor_id=video.doctor_id,
        public_token=public_token,
        public_url=public_url,
        qr_image=qr_image_fallback,
        qr_blob_name=qr_blob_name
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    logger.info(f"Public share created for video {video.video_id}: qr_id={pb_qr_id}, qr_blob_name={qr_blob_name or 'none (base64 fallback only)'}")
    return share


async def _store_completed_video_in_azure(video: Video, db: Session) -> None:
    """
    HeyGen Completed -> Download -> Azure Blob -> PostgreSQL reference.

    Idempotent: if the blob already exists (e.g. this is a retry, or the status
    poll ran twice), the video is never re-downloaded/re-uploaded — only the DB
    reference is (re)confirmed. A failure here only ever updates storage_status;
    it must never flip video.status away from COMPLETED, since HeyGen generation
    itself already succeeded.
    """
    if not video.video_url:
        raise RuntimeError("No HeyGen video_url available to store.")

    doctor_business_id = video.doctor.doctor_id if video.doctor else video.doctor_id
    blob_name = f"videos/{doctor_business_id}/{video.video_id}.mp4"

    if azure_blob_service.blob_exists(blob_name):
        video.azure_blob_name = blob_name
        video.storage_status = "uploaded"
        db.commit()
        logger.info(f"Video {video.video_id} already present in Azure at '{blob_name}' — skipped re-upload.")
        return

    video.storage_status = "uploading"
    db.commit()

    try:
        async with httpx.AsyncClient(timeout=180.0, follow_redirects=True) as client:
            res = await client.get(video.video_url)
            if res.status_code != 200:
                raise RuntimeError(f"Failed to download completed video from HeyGen CDN ({res.status_code}).")
            video_bytes = res.content

        azure_blob_service.upload_bytes(blob_name, video_bytes, content_type="video/mp4")

        video.azure_blob_name = blob_name
        video.storage_status = "uploaded"
        db.commit()
        logger.info(f"Video {video.video_id} stored in Azure Blob at '{blob_name}' ({len(video_bytes)} bytes).")
    except Exception:
        video.storage_status = "failed"
        db.commit()
        raise

# Default Avatar IV motion instruction for PointBlank's healthcare Photo Avatars.
# Only applied to the avatar_iv engine (Photo Avatars) — never to Studio (v2) avatars.
DEFAULT_DOCTOR_MOTION_PROMPT = (
    "Natural professional doctor presentation gestures while speaking. Use subtle hand "
    "gestures to emphasize important points, natural head movement, relaxed shoulders, "
    "realistic posture shifts, occasional open-hand gestures, and calm conversational body "
    "language. Keep movements controlled, professional, realistic, and appropriate for a "
    "healthcare consultation. Do not make exaggerated or distracting movements."
)
DEFAULT_AVATAR_IV_EXPRESSIVENESS = "medium"


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

    # Photo Avatars default to the Avatar IV engine (natural body/hand motion). Studio (v2)
    # avatars keep the v2 engine unless explicitly overridden via settings.engine.
    engine_name = resolved_settings.get("engine", "avatar_iv" if is_photo else "v2")

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
                motion_prompt = resolved_settings.get("motion_prompt") or DEFAULT_DOCTOR_MOTION_PROMPT
                expressiveness = resolved_settings.get("expressiveness") or DEFAULT_AVATAR_IV_EXPRESSIVENESS
                heygen_video_id = await heygen_service.generate_video_v3(
                    script=new_video.script,
                    heygen_voice_id=resolved_voice_id,
                    avatar_id=target_heygen_id,
                    engine="avatar_iv",
                    aspect_ratio=aspect_ratio,
                    motion_prompt=motion_prompt,
                    expressiveness=expressiveness
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

    res = _apply_video_response_extras(VideoResponse.model_validate(new_video), new_video)
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
                db.commit()
                db.refresh(video)

                # HeyGen succeeded — now store the completed video in Azure Blob
                # Storage. A failure here must NOT flip the video away from
                # COMPLETED; only storage_status reflects the Azure outcome.
                if video.video_url:
                    try:
                        await _store_completed_video_in_azure(video, db)
                    except Exception as st_err:
                        logger.warning(f"Azure storage failed for video {id}: {st_err}")
                    db.refresh(video)

                # Also create the public share (token + QR, mirrored to Azure)
                # now that the video is complete, so it's ready the instant the
                # Result screen asks for it. Never blocks the status response.
                try:
                    _ensure_public_share(video, db)
                except Exception as share_err:
                    logger.warning(f"Public share creation failed for video {id}: {share_err}")

            elif h_status == "FAILED":
                video.status = "FAILED"
                video.error_message = status_data.get("error_message") or "HeyGen rendering failed."
                db.commit()
                db.refresh(video)

        except Exception as poll_err:
            logger.warning(f"Status poll error for video {id}: {poll_err}")

    res = _apply_video_response_extras(VideoResponse.model_validate(video), video)
    return res


@router.post("/{id}/storage/retry", response_model=VideoResponse)
async def retry_video_storage(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retries storing an already-completed HeyGen video in Azure Blob Storage.
    Only valid once HeyGen generation itself has succeeded. Idempotent — if the
    blob already exists, this just re-confirms the DB reference rather than
    re-uploading.
    """
    video = db.query(Video).filter(Video.id == id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video record not found.")

    if current_user.role != "ADMIN" and video.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to video record.")

    if video.status != "COMPLETED" or not video.video_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Video generation must complete successfully before storage can be retried."
        )

    try:
        await _store_completed_video_in_azure(video, db)
    except Exception as exc:
        logger.error(f"Azure storage retry failed for video {id}: {exc}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=AZURE_STORAGE_UPLOAD_FAILED_DETAIL)

    db.refresh(video)
    res = _apply_video_response_extras(VideoResponse.model_validate(video), video)
    return res


@router.get("/{id}/download")
async def get_video_download_url(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns a short-lived Azure SAS URL for the completed video so the frontend
    can download/stream it directly from Azure — the backend never proxies the
    file bytes itself, and the Azure AccountKey is never exposed to the client.
    """
    video = db.query(Video).filter(Video.id == id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video record not found.")

    if current_user.role != "ADMIN" and video.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to video record.")

    if video.storage_status == "failed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=AZURE_STORAGE_UPLOAD_FAILED_DETAIL
        )
    if video.storage_status != "uploaded" or not video.azure_blob_name:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Video is still being stored. Please try again shortly."
        )

    try:
        download_url = azure_blob_service.generate_download_sas_url(video.azure_blob_name)
    except Exception as exc:
        logger.error(f"Azure SAS URL generation failed for video {id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to generate a download link for the stored video. Please try again."
        )

    return {"download_url": download_url, "expires_in_minutes": 15}


@router.get("/{id}/share", response_model=VideoShareResponse)
def get_video_share(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get-or-create the public share link + QR code for a completed video, for
    the video's OWNER to display on their own Result screen. Distinct from
    GET /public/watch/{token}, which is the unauthenticated page anyone with
    the link can open. Ownership is checked here; the public route trusts the
    256-bit token instead.
    """
    video = db.query(Video).filter(Video.id == id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video record not found.")

    if current_user.role != "ADMIN" and video.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to video record.")

    try:
        share = _ensure_public_share(video, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return VideoShareResponse(
        qr_id=share.qr_id,
        public_token=share.public_token,
        public_url=share.public_url,
        qr_image=resolve_qr_image(share)
    )


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

    res_list = [_apply_video_response_extras(VideoResponse.model_validate(v), v) for v in videos]
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

    res = _apply_video_response_extras(VideoResponse.model_validate(video), video)
    return res
