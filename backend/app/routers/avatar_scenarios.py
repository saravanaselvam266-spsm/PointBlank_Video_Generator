import os
import uuid
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from app.config import settings
from app.database import get_db
from app.models import User, DoctorProfile, AvatarScenario, AvatarLook, get_next_pb_id
from app.schemas import AvatarScenarioCreate, AvatarScenarioUpdate, AvatarScenarioResponse
from app.dependencies.auth import get_current_user
from app.services.heygen_service import heygen_service
from app.services.media_utils import sniff_image_content_type, extension_for_content_type
from app.services.media_resolve import mirror_avatar_preview_to_azure, mirror_original_photo_to_azure, resolve_avatar_photo_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/avatar-scenarios", tags=["Avatar Scenarios"])


def _detect_image_content_type(file_bytes: bytes) -> Optional[str]:
    """
    Determines the REAL image MIME type from the actual file bytes (magic-number
    signature), not the filename extension or a client-declared header. HeyGen's
    asset upload rejects requests where the declared Content-Type disagrees with
    the actual bytes, so this must be authoritative before every upload. Thin
    wrapper over the shared, provider-agnostic sniffer in media_utils.
    """
    return sniff_image_content_type(file_bytes)


def _is_raw_upload_content_type_mismatch(err_msg: str) -> bool:
    """
    Recognizes HeyGen's literal wording for a raw-bytes Content-Type mismatch
    (e.g. "Content type not match image/jpeg != image/png").

    Scope note: only call this where WE ourselves upload the user's raw image
    bytes (create_base_avatar's asset-upload step). `invalid_parameter` alone is
    HeyGen's generic error code for almost any bad request field, so matching on
    it broadly (a prior version of this function did) misclassifies unrelated
    errors — e.g. a bad prompt or an invalid reference-image URL during
    generate-look — as "please re-upload your photo", hiding the real cause.
    generate-look never uploads the user's photo bytes, so this same wording
    appearing there refers to a HeyGen-side reference image, not the user's
    upload — never call this from that handler.
    """
    lowered = err_msg.lower()
    return "content type not match" in lowered


def _extract_heygen_error_detail(err_msg: str) -> str:
    """
    Pulls the human-readable `message` out of a raw HeyGen error string like
    'HeyGen X API Error (400): {"error":{"code":"invalid_parameter",...,"message":"..."}}'
    (or the flatter asset-upload shape '{"code":400543,"message":"..."}') so the
    client sees HeyGen's actual explanation instead of the raw wrapped JSON.
    Falls back to the original string if it isn't parseable JSON.
    """
    import json
    brace_idx = err_msg.find("{")
    if brace_idx == -1:
        return err_msg
    try:
        payload = json.loads(err_msg[brace_idx:])
    except (json.JSONDecodeError, ValueError):
        return err_msg
    node = payload.get("error", payload) if isinstance(payload, dict) else {}
    if isinstance(node, dict) and node.get("message"):
        return str(node["message"])
    return err_msg


async def _normalize_reference_image_url(url: str) -> Optional[str]:
    """
    HeyGen's own POST /v3/avatars validates a `reference_images` URL's declared
    Content-Type against its actual bytes and rejects any mismatch with
    "Content type not match image/jpeg != image/png" — and at least one entry in
    HeyGen's own public Look Gallery is mislabeled this way (served at a .jpg URL
    with a `Content-Type: image/jpeg` header, while the underlying bytes are
    actually PNG), so passing that gallery URL straight through fails every time,
    independent of the user's own uploaded photo (confirmed by fetching the URL
    directly: header says image/jpeg, magic bytes are 89 50 4E 47 = PNG).

    We don't control that upstream asset's metadata. Since HeyGen's own asset
    service (used successfully for the user's own photo in create_base_avatar)
    always sets Content-Type from what WE pass it, re-uploading the reference
    image through that same pipeline — with the type verified against its real
    bytes via `_detect_image_content_type` — produces a fresh CDN URL where the
    declared and actual type always agree, regardless of which upstream Look
    asset is mislabeled. Returns None (caller skips this reference image) if the
    fetch/detection/re-upload fails for any reason — reference_images is optional.
    """
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                logger.warning(f"Reference image fetch returned HTTP {resp.status_code} for {url}; skipping this reference image.")
                return None
            content = resp.content
    except Exception as exc:
        logger.warning(f"Reference image fetch failed for {url}: {exc}; skipping this reference image.")
        return None

    real_content_type = _detect_image_content_type(content)
    if not real_content_type:
        logger.warning(f"Reference image at {url} is not a recognizable JPG/PNG/WEBP; skipping this reference image.")
        return None

    try:
        asset_info = await heygen_service.upload_asset_bytes(content, content_type=real_content_type)
    except Exception as exc:
        logger.warning(f"Reference image re-upload to HeyGen failed for {url}: {exc}; skipping this reference image.")
        return None

    normalized_url = asset_info.get("url")
    if not normalized_url:
        return None

    logger.info(
        f"Reference image normalized: original_url={url}, detected_content_type={real_content_type}, "
        f"normalized_url={normalized_url}"
    )
    return normalized_url


@router.post("/upload-photo")
async def upload_doctor_photo(
    file: UploadFile = File(...),
    doctor_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 1: Upload Doctor Photo.
    Saves image to uploads/original_photos/ and initializes AvatarScenario in status DRAFT.
    """
    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found.")
    if current_user.role != "ADMIN" and doctor.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to doctor profile.")

    declared_content_type = (file.content_type or "").lower()
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if declared_content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a portrait photo in JPG, PNG, or WEBP format."
        )

    file_bytes = await file.read()
    if len(file_bytes) > 15 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo file size exceeds 15MB limit."
        )

    # Never trust the filename/declared header alone — verify against the actual bytes.
    real_content_type = _detect_image_content_type(file_bytes)
    if not real_content_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to verify image format. Please upload a valid JPG, PNG, or WEBP photo."
        )

    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[real_content_type]
    filename = f"doctor_photo_{uuid.uuid4().hex[:10]}.{ext}"
    local_dir = os.path.join(settings.STORAGE_DIR, "original_photos")
    os.makedirs(local_dir, exist_ok=True)
    local_path = os.path.join(local_dir, filename)

    with open(local_path, "wb") as f:
        f.write(file_bytes)

    original_url = f"http://localhost:8000/uploads/original_photos/{filename}"

    pb_avt_id = get_next_pb_id(db, 'pb_avatar_scenario_id_seq', 'PB-AVT')
    new_scenario = AvatarScenario(
        avatar_scenario_id=pb_avt_id,
        user_id=current_user.id,
        doctor_id=doctor.id,
        name=f"{doctor.doctor_name} Avatar Scenario",
        avatar_type="photo",
        photo_url=original_url,
        original_photo_url=original_url,
        creation_status="DRAFT",
        is_deleted=False
    )

    db.add(new_scenario)
    db.commit()
    db.refresh(new_scenario)

    # Best-effort mirror of the doctor's original photo to Azure Blob Storage.
    # Local disk remains authoritative for create-base-avatar's read-back step
    # regardless of outcome here — this only affects the Azure Blob requirement.
    mirror_original_photo_to_azure(new_scenario, file_bytes, real_content_type, db)

    return {
        "scenario_id": new_scenario.id,
        "avatar_scenario_id": new_scenario.avatar_scenario_id,
        "original_photo_url": original_url,
        "doctor_name": doctor.doctor_name
    }


@router.post("/create-base-avatar")
async def create_base_avatar(
    scenario_id: str = Form(...),
    doctor_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 2: Creates Base Photo Avatar on HeyGen via POST /v3/avatars (type=photo).
    Stores real base_avatar_item.id (heygen_base_look_id) and sets status to BASE_PROCESSING.
    """
    scenario = db.query(AvatarScenario).filter(AvatarScenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Avatar Scenario record not found.")

    if current_user.role != "ADMIN" and scenario.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to Avatar Scenario.")

    if not scenario.original_photo_url:
        raise HTTPException(status_code=400, detail="Original photo missing. Please upload a doctor photo first.")

    filename = scenario.original_photo_url.split("/")[-1]
    local_path = os.path.join(settings.STORAGE_DIR, "original_photos", filename)

    if not os.path.exists(local_path):
        raise HTTPException(status_code=400, detail=f"Doctor photo file '{filename}' was not found on disk.")

    with open(local_path, "rb") as f:
        file_bytes = f.read()

    # Detect the REAL content type from the actual bytes — never hardcode this.
    # A mismatch here (declaring image/jpeg for bytes that are actually PNG/WEBP)
    # is exactly what HeyGen's asset upload rejects with a 400 content-type error.
    real_content_type = _detect_image_content_type(file_bytes)
    if not real_content_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stored photo '{filename}' is not a valid JPG, PNG, or WEBP image."
        )

    logger.info(
        f"create-base-avatar image diagnostics: scenario_id={scenario.avatar_scenario_id}, "
        f"filename={filename}, file_size_bytes={len(file_bytes)}, "
        f"signature_hex={file_bytes[:12].hex()}, detected_content_type={real_content_type}, "
        f"upload_content_type={real_content_type}"
    )

    scenario.creation_status = "BASE_CREATING"
    db.commit()

    try:
        # Step A1: Upload photo to HeyGen asset service (Content-Type matches actual bytes)
        asset_info = await heygen_service.upload_asset_bytes(file_bytes, content_type=real_content_type)
        photo_cdn_url = asset_info.get("url") or scenario.original_photo_url

        # Step A2: Call HeyGen POST /v3/avatars (type=photo)
        doctor_name = scenario.doctor.doctor_name if scenario.doctor else "Doctor"
        res = await heygen_service.create_base_photo_avatar(
            photo_url=photo_cdn_url,
            name=f"{doctor_name} Base Photo Avatar"
        )

        base_look_id = res["base_look_id"]
        group_id = res.get("group_id")

        scenario.heygen_base_look_id = base_look_id
        scenario.heygen_avatar_group_id = group_id
        scenario.creation_status = "BASE_PROCESSING"
        db.commit()
        db.refresh(scenario)

        logger.info(f"Base Photo Avatar Submitted: scenario_id={scenario.avatar_scenario_id}, base_look_id={base_look_id}")
        return {
            "success": True,
            "scenario_id": scenario.id,
            "base_look_id": base_look_id,
            "group_id": group_id,
            "status": "base_processing"
        }

    except Exception as exc:
        err_msg = str(exc)
        logger.error(
            f"Base Photo Avatar Creation Failed: scenario_id={scenario.avatar_scenario_id}, "
            f"filename={filename}, detected_content_type={real_content_type}, raw_heygen_error={err_msg}"
        )
        scenario.creation_status = "FAILED"
        scenario.creation_error = err_msg
        db.commit()

        # Only the raw-bytes upload step above sends the user's own photo, so a
        # Content-Type mismatch here genuinely means their upload was bad.
        if _is_raw_upload_content_type_mismatch(err_msg):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported image format. Please upload a supported image such as JPG, PNG, or WebP."
            )

        raise HTTPException(status_code=500, detail=f"Base Photo Avatar creation error: {_extract_heygen_error_detail(err_msg)}")


@router.post("/generate-look")
async def generate_look_for_avatar(
    scenario_id: str = Form(...),
    doctor_id: str = Form(...),
    look_id: Optional[str] = Form(None),
    heygen_look_id: Optional[str] = Form(None),
    heygen_look_name: Optional[str] = Form(None),
    heygen_look_preview_image_url: Optional[str] = Form(None),
    heygen_look_tags: Optional[str] = Form(None),
    heygen_look_avatar_type: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 3: Triggers HeyGen Look Generation via POST /v3/avatars (type=prompt).
    Guarded: MUST wait until base avatar reaches BASE_READY.

    Accepts either a real HeyGen public Avatar Look (heygen_look_* fields, the
    current Create Avatar workflow) or, for backward compatibility, a legacy
    PointBlank AvatarLook preset (look_id).
    """
    scenario = db.query(AvatarScenario).filter(AvatarScenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Avatar Scenario record not found.")

    if current_user.role != "ADMIN" and scenario.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to Avatar Scenario.")

    if not scenario.heygen_base_look_id:
        raise HTTPException(status_code=400, detail="Base HeyGen photo avatar is missing. Please create base photo avatar first.")

    # Guard Clause: Verify base photo avatar is completed and ready
    if scenario.creation_status not in ("BASE_READY", "LOOK_PROCESSING", "READY"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your base avatar is still being prepared by HeyGen. Please wait while we finish preparing it."
        )

    ref_images = []

    if heygen_look_name or heygen_look_id:
        # Real HeyGen public Avatar Look selected in Step 2 of Create Avatar.
        tag_list = [t.strip() for t in heygen_look_tags.split(",") if t.strip()] if heygen_look_tags else []
        tag_suffix = f" ({', '.join(tag_list)})" if tag_list else ""
        prompt_text = (
            f"A professional avatar look styled as '{heygen_look_name or 'Professional'}'{tag_suffix}. "
            f"Preserve facial identity, skin tone, facial features, and structure completely."
        )
        if heygen_look_preview_image_url and heygen_look_preview_image_url.startswith("http"):
            ref_images.append(heygen_look_preview_image_url)

        scenario.look_id = None
        scenario.name = f"{scenario.doctor.doctor_name} — {heygen_look_name or 'HeyGen Look'}"
        scenario.metadata_json = {
            "heygen_selected_look": {
                "id": heygen_look_id,
                "name": heygen_look_name,
                "preview_image_url": heygen_look_preview_image_url,
                "avatar_type": heygen_look_avatar_type,
                "tags": tag_list
            }
        }
    elif look_id:
        # Legacy PointBlank AvatarLook preset (backward compatibility).
        look = db.query(AvatarLook).filter(
            (AvatarLook.id == look_id) | (AvatarLook.look_id == look_id)
        ).first()
        if not look or not look.is_active:
            raise HTTPException(status_code=404, detail="Selected PointBlank Look preset not found.")

        prompt_text = look.transformation_prompt or f"Professional medical doctor portrait of {scenario.doctor.doctor_name}"
        if look.preview_image_url and look.preview_image_url.startswith("http"):
            ref_images.append(look.preview_image_url)

        scenario.look_id = look.id
        scenario.name = f"{scenario.doctor.doctor_name} — {look.name}"
        scenario.background_type = look.background_type or "clinic"
        scenario.background_value = look.background_value or "#FAFAFA"
        scenario.framing = look.camera_framing or "medium"
        scenario.aspect_ratio = look.aspect_ratio or "16:9"
    else:
        raise HTTPException(status_code=400, detail="Please select an avatar look before generating.")

    # Verify the exact Look/Doctor/Scenario identity the frontend selected before ever
    # calling HeyGen — this must always reflect the CURRENT request, never prior state.
    logger.info(
        f"generate-look request verified: doctor_id={doctor_id}, scenario_id={scenario.avatar_scenario_id}, "
        f"selected_look_id={heygen_look_id or look_id}, selected_look_name={heygen_look_name}, "
        f"selected_look_preview={heygen_look_preview_image_url}, base_look_id={scenario.heygen_base_look_id}"
    )

    scenario.creation_status = "LOOK_SUBMITTED"
    db.commit()

    # HeyGen's own public Look Gallery has at least one preview asset whose declared
    # Content-Type doesn't match its actual bytes (confirmed: a .jpg URL serving real
    # PNG bytes), which HeyGen's own /v3/avatars endpoint then rejects. We don't
    # control that upstream metadata, so re-upload each reference image through
    # HeyGen's asset service with a Content-Type verified against its real bytes —
    # the same sniff-then-declare approach already used for the user's own photo —
    # producing a URL where declared and actual type are guaranteed to agree.
    raw_ref_images = list(ref_images)
    ref_images = []
    for raw_url in raw_ref_images:
        normalized = await _normalize_reference_image_url(raw_url)
        if normalized:
            ref_images.append(normalized)

    logger.info(
        f"generate-look image diagnostics: scenario_id={scenario.avatar_scenario_id}, "
        f"base_look_id={scenario.heygen_base_look_id}, raw_reference_image_urls={raw_ref_images or 'none'}, "
        f"normalized_reference_image_urls={ref_images or 'none'} "
        f"(note: generate-look never uploads the user's own photo bytes — only base_look_id + these "
        f"reference URLs are sent, so a HeyGen Content-Type error here is about a reference image, "
        f"not the user's upload)"
    )

    try:
        res = await heygen_service.generate_avatar_look(
            base_look_id=scenario.heygen_base_look_id,
            prompt=prompt_text,
            name=scenario.name,
            reference_images=ref_images if len(ref_images) > 0 else None
        )

        generated_look_id = res["generated_look_id"]
        status_str = res.get("status", "processing")

        scenario.heygen_look_id = generated_look_id
        scenario.heygen_avatar_id = generated_look_id # Set for video generation compatibility
        scenario.heygen_talking_photo_id = generated_look_id
        if res.get("group_id"):
            scenario.heygen_avatar_group_id = res.get("group_id")

        if res.get("preview_image_url"):
            scenario.heygen_preview_image_url = res.get("preview_image_url")
            scenario.photo_url = res.get("preview_image_url")

        scenario.creation_status = "LOOK_PROCESSING" if status_str != "completed" else "READY"
        db.commit()
        db.refresh(scenario)

        logger.info(f"HeyGen Look Generation Submitted for {scenario.avatar_scenario_id}: generated_look_id={generated_look_id}, status={status_str}")

        # Look already completed synchronously — mirror the final avatar image
        # to Azure Blob Storage right away rather than waiting for the next
        # /status poll. Best-effort: never blocks returning the response.
        if scenario.creation_status == "READY" and scenario.heygen_preview_image_url:
            await mirror_avatar_preview_to_azure(scenario, scenario.heygen_preview_image_url, db)

        return {
            "success": True,
            "scenario_id": scenario.id,
            "heygen_look_id": generated_look_id,
            "status": "look_processing" if status_str != "completed" else "completed",
            "preview_image_url": scenario.heygen_preview_image_url
        }

    except Exception as exc:
        err_msg = str(exc)
        logger.error(
            f"HeyGen Look Generation Failed: scenario_id={scenario.avatar_scenario_id}, "
            f"base_look_id={scenario.heygen_base_look_id}, reference_image_urls={ref_images or 'none'}, "
            f"raw_heygen_error={err_msg}"
        )

        if "is not in a usable state" in err_msg:
            scenario.creation_status = "BASE_PROCESSING"
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your base avatar is still being prepared by HeyGen. Please wait while we finish preparing it."
            )

        scenario.creation_status = "FAILED"
        scenario.creation_error = err_msg
        db.commit()

        # generate-look never uploads the user's own photo bytes (only base_look_id
        # + optional HeyGen-hosted reference-image URLs are sent), so a failure here
        # is never "your uploaded photo is the wrong format" — expose HeyGen's real
        # reason instead of guessing at one.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"HeyGen Look Generation failed: {_extract_heygen_error_detail(err_msg)}"
        )


@router.get("/{id}/status")
async def check_avatar_look_status(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Unified Status Handler: Polls HeyGen GET /v3/avatars/looks/{look_id}.
    - Handles base avatar polling (creation_status in BASE_CREATING, BASE_PROCESSING).
    - Handles generated look polling (creation_status in LOOK_SUBMITTED, LOOK_PROCESSING).
    """
    scenario = db.query(AvatarScenario).filter(
        (AvatarScenario.id == id) | (AvatarScenario.avatar_scenario_id == id)
    ).first()

    if not scenario:
        raise HTTPException(status_code=404, detail="Avatar Scenario record not found.")

    if current_user.role != "ADMIN" and scenario.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to Avatar Scenario.")

    # A. Stage 1: Base Avatar Polling
    if scenario.creation_status in ("BASE_CREATING", "BASE_PROCESSING") and scenario.heygen_base_look_id:
        try:
            look_status = await heygen_service.get_avatar_look_status(scenario.heygen_base_look_id)
            base_st = look_status["status"]

            if base_st == "completed":
                scenario.creation_status = "BASE_READY"
                if look_status.get("preview_image_url"):
                    scenario.photo_url = look_status["preview_image_url"]
                db.commit()
                db.refresh(scenario)
                return {
                    "status": "base_ready",
                    "scenario_id": scenario.id,
                    "heygen_base_look_id": scenario.heygen_base_look_id,
                    "preview_image_url": scenario.photo_url or scenario.original_photo_url
                }
            elif base_st == "failed":
                scenario.creation_status = "FAILED"
                scenario.creation_error = look_status.get("error") or "HeyGen reported base avatar creation failure."
                db.commit()
                return {
                    "status": "failed",
                    "scenario_id": scenario.id,
                    "error": scenario.creation_error
                }
            else:
                return {
                    "status": "base_processing",
                    "scenario_id": scenario.id,
                    "heygen_base_look_id": scenario.heygen_base_look_id,
                    "preview_image_url": scenario.original_photo_url
                }
        except Exception as exc:
            db.rollback()
            logger.warning(f"Base look polling warning for '{scenario.avatar_scenario_id}': {exc}")
            return {
                "status": "base_processing",
                "scenario_id": scenario.id,
                "preview_image_url": scenario.original_photo_url
            }

    # B. Already Base Ready
    if scenario.creation_status == "BASE_READY":
        return {
            "status": "base_ready",
            "scenario_id": scenario.id,
            "heygen_base_look_id": scenario.heygen_base_look_id,
            "preview_image_url": scenario.photo_url or scenario.original_photo_url
        }

    # C. Stage 2: Generated Look Polling
    if scenario.creation_status in ("LOOK_SUBMITTED", "LOOK_PROCESSING") and scenario.heygen_look_id:
        try:
            look_status = await heygen_service.get_avatar_look_status(scenario.heygen_look_id)
            look_st = look_status["status"]

            if look_status.get("preview_image_url"):
                scenario.heygen_preview_image_url = look_status["preview_image_url"]
                scenario.photo_url = look_status["preview_image_url"]

            if look_st == "completed":
                scenario.creation_status = "READY"
                scenario.creation_error = None
                db.commit()
                db.refresh(scenario)

                # Mirror the final avatar image to Azure Blob Storage now that
                # the look is confirmed ready. Idempotent + best-effort.
                if scenario.heygen_preview_image_url:
                    await mirror_avatar_preview_to_azure(scenario, scenario.heygen_preview_image_url, db)

                res_obj = AvatarScenarioResponse.model_validate(scenario)
                if scenario.doctor:
                    res_obj.doctor_name = scenario.doctor.doctor_name
                if scenario.look:
                    res_obj.look_name = scenario.look.name
                res_obj.photo_url = resolve_avatar_photo_url(scenario)

                return {
                    "status": "completed",
                    "scenario_id": scenario.id,
                    "heygen_look_id": scenario.heygen_look_id,
                    "preview_image_url": res_obj.photo_url,
                    "scenario": res_obj
                }
            elif look_st == "failed":
                scenario.creation_status = "FAILED"
                scenario.creation_error = look_status.get("error") or "HeyGen reported look generation failure."
                db.commit()
                return {
                    "status": "failed",
                    "scenario_id": scenario.id,
                    "error": scenario.creation_error
                }
            else:
                return {
                    "status": "look_processing",
                    "scenario_id": scenario.id,
                    "heygen_look_id": scenario.heygen_look_id,
                    "preview_image_url": scenario.heygen_preview_image_url or scenario.original_photo_url
                }
        except Exception as exc:
            db.rollback()
            logger.warning(f"Generated look polling warning for '{scenario.avatar_scenario_id}': {exc}")
            return {
                "status": "look_processing",
                "scenario_id": scenario.id,
                "heygen_look_id": scenario.heygen_look_id,
                "preview_image_url": scenario.heygen_preview_image_url or scenario.original_photo_url
            }

    # D. Final Ready State
    if scenario.creation_status == "READY":
        # Backfill for scenarios that reached READY before Azure mirroring
        # existed, or whose mirror previously failed — retried on every poll
        # of an already-ready scenario until it succeeds, idempotent once uploaded.
        if scenario.avatar_storage_status != "uploaded" and scenario.heygen_preview_image_url:
            await mirror_avatar_preview_to_azure(scenario, scenario.heygen_preview_image_url, db)

        res_obj = AvatarScenarioResponse.model_validate(scenario)
        if scenario.doctor:
            res_obj.doctor_name = scenario.doctor.doctor_name
        if scenario.look:
            res_obj.look_name = scenario.look.name
        res_obj.photo_url = resolve_avatar_photo_url(scenario)

        return {
            "status": "completed",
            "scenario_id": scenario.id,
            "heygen_look_id": scenario.heygen_look_id,
            "preview_image_url": res_obj.photo_url,
            "scenario": res_obj
        }

    return {
        "status": scenario.creation_status.lower(),
        "scenario_id": scenario.id,
        "error": scenario.creation_error
    }


@router.get("", response_model=List[AvatarScenarioResponse])
def list_avatar_scenarios(
    doctor_id: Optional[str] = None,
    creation_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List active Avatar Scenarios for current user with doctor isolation."""
    query = db.query(AvatarScenario).filter(AvatarScenario.is_deleted == False)

    if current_user.role != "ADMIN":
        query = query.filter(AvatarScenario.user_id == current_user.id)

    if doctor_id:
        query = query.filter(AvatarScenario.doctor_id == doctor_id)

    if creation_status:
        query = query.filter(AvatarScenario.creation_status == creation_status)

    scenarios = query.order_by(AvatarScenario.created_at.desc()).all()

    res_list = []
    for sc in scenarios:
        sc_res = AvatarScenarioResponse.model_validate(sc)
        if sc.doctor:
            sc_res.doctor_name = sc.doctor.doctor_name
        if sc.look:
            sc_res.look_name = sc.look.name
        sc_res.photo_url = resolve_avatar_photo_url(sc)
        res_list.append(sc_res)

    return res_list


@router.get("/{id}", response_model=AvatarScenarioResponse)
def get_avatar_scenario_details(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get details of a specific Avatar Scenario."""
    sc = db.query(AvatarScenario).filter(
        (AvatarScenario.id == id) | (AvatarScenario.avatar_scenario_id == id),
        AvatarScenario.is_deleted == False
    ).first()

    if not sc:
        raise HTTPException(status_code=404, detail="Avatar Scenario record not found.")

    if current_user.role != "ADMIN" and sc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to Avatar Scenario.")

    res = AvatarScenarioResponse.model_validate(sc)
    if sc.doctor:
        res.doctor_name = sc.doctor.doctor_name
    if sc.look:
        res.look_name = sc.look.name
    res.photo_url = resolve_avatar_photo_url(sc)
    return res


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_avatar_scenario(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft delete an Avatar Scenario."""
    sc = db.query(AvatarScenario).filter(
        (AvatarScenario.id == id) | (AvatarScenario.avatar_scenario_id == id)
    ).first()

    if not sc:
        raise HTTPException(status_code=404, detail="Avatar Scenario record not found.")

    if current_user.role != "ADMIN" and sc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to Avatar Scenario.")

    sc.is_deleted = True
    db.commit()
    return None
