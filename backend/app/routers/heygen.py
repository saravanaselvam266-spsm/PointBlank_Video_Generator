from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from typing import Optional, Dict, Any
from app.services.heygen_service import heygen_service
from app.services.storage_service import storage_service
from app.schemas import PhotoAvatarUploadResponse

router = APIRouter(prefix="/api/v1/heygen", tags=["HeyGen Proxy"])

@router.get("/avatars")
async def get_avatars():
    """
    Proxies request to HeyGen API v2 GET /v2/avatars.
    Returns real studio avatars and talking photos.
    Does not mock data on error.
    """
    try:
        return await heygen_service.get_avatars()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/avatars-v3")
async def get_avatars_v3():
    """
    Proxies request to HeyGen API v3 GET /v3/avatars (Avatar IV Engine Avatars).
    """
    try:
        return await heygen_service.get_avatars_v3()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/voices")
async def get_voices():
    """
    Proxies request to HeyGen API v2 GET /v2/voices.
    Returns real voice library.
    Does not mock data on error.
    """
    try:
        return await heygen_service.get_voices()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/photo-avatar", response_model=PhotoAvatarUploadResponse)
async def upload_photo_avatar(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None)
):
    """
    Uploads a Doctor Photo file to local storage, generates public URL,
    and invokes official HeyGen Photo Avatar creation API.
    Returns real HeyGen talking_photo_id.
    Does not fabricate or hard-code IDs.
    """
    if file.content_type not in ("image/jpeg", "image/png", "image/jpg", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPG, JPEG, PNG, and WEBP image files are allowed.")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image file size must be less than 10MB.")

    # 1. Save photo locally
    stored_info = await storage_service.save_photo_upload(file_bytes, file.filename or "doctor_photo.jpg")

    # 2. Invoke HeyGen photo avatar creation workflow
    try:
        result = await heygen_service.upload_photo_avatar(
            photo_url=stored_info["public_url"],
            name=name or "PointBlank Doctor Avatar"
        )
        return PhotoAvatarUploadResponse(
            talking_photo_id=result["talking_photo_id"],
            status=result["status"],
            message="Photo avatar successfully registered with HeyGen API"
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"HeyGen Photo Avatar Creation Failed: {str(e)}")
