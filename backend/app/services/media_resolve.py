"""
Shared Azure mirroring + SAS-resolution helpers for every media type (doctor
photos, final avatars, voice previews, videos, QR codes). Single source of
truth so avatar_scenarios.py / voices.py / videos.py / public.py never
duplicate the "download from provider -> sniff type -> upload -> resolve SAS
with fallback" pattern that _store_completed_video_in_azure pioneered for
video.

Every mirror_* function is best-effort and NEVER raises past this module for
storage-status purposes: on failure it flips the row's own *_storage_status to
"failed", logs, and returns without touching provider-sourced fields — the
provider's success (HeyGen generation) must never be undone by a storage
hiccup. Callers that need to surface the exception (there are none today)
can still inspect storage_status afterward.

Every resolve_* function returns a working URL no matter what: an Azure SAS
URL when the asset is mirrored and reachable, otherwise the original
provider-hosted URL already stored on the row. It never raises.
"""
import logging
from typing import Optional

import httpx

from app.services.azure_blob import azure_blob_service
from app.services.media_utils import (
    sniff_image_content_type,
    sniff_audio_content_type,
    extension_for_content_type,
)

logger = logging.getLogger("media_resolve")


async def _fetch_bytes(url: str, timeout: float = 30.0) -> Optional[bytes]:
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            res = await client.get(url)
            if res.status_code != 200:
                logger.warning(f"Media fetch returned HTTP {res.status_code} for {url}")
                return None
            return res.content
    except Exception as exc:
        logger.warning(f"Media fetch failed for {url}: {exc}")
        return None


# --- Doctor photo (mirrored at upload time, from bytes already in hand) ---

def mirror_original_photo_to_azure(scenario, file_bytes: bytes, content_type: str, db) -> None:
    """
    Mirrors the doctor's original uploaded photo bytes (already validated and
    written to local disk by the caller) to Azure at
    doctors/{doctor_id}/photos/{avatar_scenario_id}.{ext}. Best-effort: local
    disk remains the source of truth for create-base-avatar's read-back step
    either way, so a failure here only affects the Azure Blob requirement, not
    avatar creation itself.
    """
    doctor_business_id = scenario.doctor.doctor_id if scenario.doctor else scenario.doctor_id
    ext = extension_for_content_type(content_type, fallback="jpg")
    blob_name = f"doctors/{doctor_business_id}/photos/{scenario.avatar_scenario_id}.{ext}"
    try:
        azure_blob_service.upload_bytes(blob_name, file_bytes, content_type=content_type)
        scenario.original_photo_azure_blob_name = blob_name
        db.commit()
        logger.info(f"Doctor photo mirrored to Azure at '{blob_name}' for scenario {scenario.avatar_scenario_id}")
    except Exception as exc:
        db.rollback()
        logger.warning(f"Doctor photo Azure mirror failed for scenario {scenario.avatar_scenario_id}: {exc}")


# --- Final avatar image (mirrored from the HeyGen-hosted preview URL) ---

async def mirror_avatar_preview_to_azure(scenario, preview_image_url: str, db) -> None:
    """
    HeyGen avatar look completed -> download the preview image -> Azure Blob
    -> PostgreSQL reference. This IS the final avatar asset shown in the
    Avatar Library — HeyGen returns exactly one image per generated look, so
    azure_blob_name and azure_preview_blob_name are set to the same blob.

    Idempotent: skipped entirely if already uploaded for this exact URL.
    """
    if not preview_image_url:
        return

    doctor_business_id = scenario.doctor.doctor_id if scenario.doctor else scenario.doctor_id
    provisional_blob_name = f"avatars/{doctor_business_id}/{scenario.avatar_scenario_id}/final"

    if scenario.avatar_storage_status == "uploaded" and scenario.azure_blob_name and scenario.azure_blob_name.startswith(provisional_blob_name):
        return

    scenario.avatar_storage_status = "uploading"
    db.commit()

    image_bytes = await _fetch_bytes(preview_image_url)
    if not image_bytes:
        scenario.avatar_storage_status = "failed"
        db.commit()
        return

    content_type = sniff_image_content_type(image_bytes)
    if not content_type:
        logger.warning(f"Avatar preview for scenario {scenario.avatar_scenario_id} is not a recognizable image; skipping Azure mirror.")
        scenario.avatar_storage_status = "failed"
        db.commit()
        return

    ext = extension_for_content_type(content_type)
    blob_name = f"{provisional_blob_name}.{ext}"

    try:
        azure_blob_service.upload_bytes(blob_name, image_bytes, content_type=content_type)
        scenario.azure_blob_name = blob_name
        scenario.azure_preview_blob_name = blob_name
        scenario.avatar_storage_status = "uploaded"
        db.commit()
        logger.info(f"Final avatar mirrored to Azure at '{blob_name}' for scenario {scenario.avatar_scenario_id} ({len(image_bytes)} bytes).")
    except Exception as exc:
        db.rollback()
        scenario.avatar_storage_status = "failed"
        db.commit()
        logger.warning(f"Final avatar Azure mirror failed for scenario {scenario.avatar_scenario_id}: {exc}")


def resolve_avatar_photo_url(scenario) -> Optional[str]:
    """Azure SAS for the final avatar if mirrored, else the original HeyGen/local URL already on the row."""
    if scenario.avatar_storage_status == "uploaded" and scenario.azure_blob_name:
        try:
            return azure_blob_service.generate_read_sas_url(scenario.azure_blob_name)
        except Exception as exc:
            logger.warning(f"Avatar SAS URL generation failed for scenario {getattr(scenario, 'avatar_scenario_id', '?')}: {exc}")
    return scenario.photo_url or scenario.heygen_preview_image_url or scenario.original_photo_url


# --- Voice preview audio ---

async def mirror_voice_preview_to_azure(voice, preview_url: str, db) -> None:
    """Mirrors a saved voice's provider-hosted preview sample to Azure at voices/{doctor_id}/{voice_id}/preview.{ext}."""
    if not preview_url:
        return

    doctor_business_id = voice.doctor.doctor_id if voice.doctor else voice.doctor_id
    voice.voice_storage_status = "uploading"
    db.commit()

    audio_bytes = await _fetch_bytes(preview_url)
    if not audio_bytes:
        voice.voice_storage_status = "failed"
        db.commit()
        return

    content_type = sniff_audio_content_type(audio_bytes)
    if not content_type:
        logger.warning(f"Voice preview for {voice.voice_id} is not a recognizable audio format; skipping Azure mirror.")
        voice.voice_storage_status = "failed"
        db.commit()
        return

    ext = extension_for_content_type(content_type)
    blob_name = f"voices/{doctor_business_id}/{voice.voice_id}/preview.{ext}"

    try:
        azure_blob_service.upload_bytes(blob_name, audio_bytes, content_type=content_type)
        voice.azure_blob_name = blob_name
        voice.voice_storage_status = "uploaded"
        db.commit()
        logger.info(f"Voice preview mirrored to Azure at '{blob_name}' for {voice.voice_id} ({len(audio_bytes)} bytes).")
    except Exception as exc:
        db.rollback()
        voice.voice_storage_status = "failed"
        db.commit()
        logger.warning(f"Voice preview Azure mirror failed for {voice.voice_id}: {exc}")


def resolve_voice_preview_url(voice) -> Optional[str]:
    """Azure SAS for the voice preview if mirrored, else the original provider-hosted preview URL."""
    if voice.voice_storage_status == "uploaded" and voice.azure_blob_name:
        try:
            return azure_blob_service.generate_read_sas_url(voice.azure_blob_name)
        except Exception as exc:
            logger.warning(f"Voice SAS URL generation failed for {voice.voice_id}: {exc}")
    return voice.preview_url


# --- Video playback ---

def resolve_video_playback_url(video) -> Optional[str]:
    """Azure SAS for the completed video if mirrored, else the original HeyGen CDN URL already on the row."""
    if video.storage_status == "uploaded" and video.azure_blob_name:
        try:
            return azure_blob_service.generate_read_sas_url(video.azure_blob_name)
        except Exception as exc:
            logger.warning(f"Video SAS URL generation failed for {getattr(video, 'video_id', '?')}: {exc}")
    return video.video_url


# --- QR image ---

def resolve_qr_image(share) -> Optional[str]:
    """Azure SAS for the QR PNG if mirrored, else the base64 data URI fallback already on the row."""
    if getattr(share, "qr_blob_name", None):
        try:
            return azure_blob_service.generate_read_sas_url(share.qr_blob_name)
        except Exception as exc:
            logger.warning(f"QR SAS URL generation failed for share {getattr(share, 'qr_id', '?')}: {exc}")
    return share.qr_image
