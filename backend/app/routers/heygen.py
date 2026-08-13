import logging
import time
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from typing import Optional, Dict, Any
from app.services.heygen_service import heygen_service
from app.services.storage_service import storage_service
from app.schemas import PhotoAvatarUploadResponse
from app.dependencies.auth import get_current_user
from app.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/heygen", tags=["HeyGen Proxy"])


# Real HeyGen `name` strings are the only descriptive signal this catalog returns
# (its `tags` field is populated with internal system flags like "AvatarTags.NEW",
# never style/profession descriptors) — so professional-look ranking is derived
# from real name text, not fabricated metadata.
_MEDICAL_KEYWORDS = ["healthcare", "medical", "clinical", "doctor", "physician", "hospital", "consultation"]
_PROFESSIONAL_KEYWORDS_HIGH = [
    "coat", "suit", "blazer", "formal", "professional", "executive", "consultant",
    "corporate", "office", "presenter", "professor", "lecture"
]
_PROFESSIONAL_KEYWORDS_MED = ["shirt", "blouse", "polo", "jacket", "studio", "business", "conference", "law", "lawyer"]
_CASUAL_KEYWORDS = [
    "t-shirt", "tshirt", "tank", "hoodie", "shorts", "streetwear", "puffer", "vest",
    "party", "gaming", "stream", "streamer", "casual", "gym", "sport", "swim", "beach",
    "kitchen", "living room", "livingroom", "fitness"
]

# Only photo_avatar is confirmed (live) to support the Avatar IV engine —
# studio_avatar in this catalog only supports avatar_iii, and digital_twin
# avatars are real cloned people's consent-gated identities, not synthetic
# presets — both excluded from this Avatar IV style-reference gallery.
_GALLERY_AVATAR_TYPE = "photo_avatar"
_GALLERY_ENGINE = "avatar_iv"
_PAGE_SIZE = 50
_MAX_PAGES = 15
_MIN_PER_GENDER = 25

# Reaching a gender-balanced pool requires walking several pages deep into
# HeyGen's own catalog ordering (each ~1.5-2s server-side) — a cost worth
# paying once, not on every Look Selection page visit. Public preset looks
# don't change minute-to-minute, so a short in-memory cache is safe here.
_GALLERY_CACHE: Dict[Any, Dict[str, Any]] = {}
_GALLERY_CACHE_TTL_SECONDS = 1800


def _professional_score(look: Dict[str, Any]) -> int:
    name = (look.get("name") or "").lower()
    score = 0
    for kw in _MEDICAL_KEYWORDS:
        if kw in name:
            score += 4
    for kw in _PROFESSIONAL_KEYWORDS_HIGH:
        if kw in name:
            score += 3
    for kw in _PROFESSIONAL_KEYWORDS_MED:
        if kw in name:
            score += 1
    for kw in _CASUAL_KEYWORDS:
        if kw in name:
            score -= 2
    return score


def _rank_and_balance_looks(looks: list) -> list:
    """
    Ranks real HeyGen looks by professional-appearance signal (from `name`),
    then interleaves by gender so both male and female options surface
    immediately, instead of one gender dominating purely by catalog order.
    """
    scored = sorted(looks, key=_professional_score, reverse=True)

    male = [l for l in scored if l.get("gender") == "male"]
    female = [l for l in scored if l.get("gender") == "female"]
    other = [l for l in scored if l.get("gender") not in ("male", "female")]

    interleaved = []
    i = j = 0
    while i < len(male) or j < len(female):
        if i < len(male):
            interleaved.append(male[i])
            i += 1
        if j < len(female):
            interleaved.append(female[j])
            j += 1
    interleaved.extend(other)
    return interleaved


@router.get("/avatar-looks")
async def get_avatar_looks(
    ownership: str = "public",
    avatar_type: Optional[str] = None,
    limit: int = 50,
    token: Optional[str] = None,
    group_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Proxies official HeyGen API v3 GET /v3/avatars/looks.

    - With an explicit `avatar_type`: simple single-type passthrough (preserves
      HeyGen's own has_more/next_token pagination), unchanged from before.
    - Without `avatar_type` (used by the Create Avatar Look gallery): paginates
      the `photo_avatar` catalog — the type confirmed (live) to support the
      Avatar IV engine — deep enough to collect a real gender-balanced pool
      (male entries appear only several pages in for this catalog), stopping
      early once both genders are sufficiently represented or a bounded page
      cap is hit. Ranks by real professional/medical-appearance signal in
      `name` and interleaves by gender so the gallery isn't dominated by a
      single gender purely due to upstream catalog ordering.
    Does not mock data on error.
    """
    try:
        if avatar_type:
            return await heygen_service.list_avatar_looks(
                ownership=ownership,
                avatar_type=avatar_type,
                limit=limit,
                token=token,
                group_id=group_id
            )

        cache_key = (ownership, group_id)
        cached = _GALLERY_CACHE.get(cache_key)
        if cached and (time.time() - cached["cached_at"]) < _GALLERY_CACHE_TTL_SECONDS:
            return cached["response"]

        combined: list = []
        male_count = female_count = 0
        page_token = None
        for _ in range(_MAX_PAGES):
            result = await heygen_service.list_avatar_looks(
                ownership=ownership,
                avatar_type=_GALLERY_AVATAR_TYPE,
                limit=_PAGE_SIZE,
                token=page_token,
                group_id=group_id
            )
            page_items = [
                item for item in result.get("data", [])
                if _GALLERY_ENGINE in (item.get("supported_api_engines") or [])
            ]
            combined.extend(page_items)
            male_count += sum(1 for i in page_items if i.get("gender") == "male")
            female_count += sum(1 for i in page_items if i.get("gender") == "female")

            page_token = result.get("next_token")
            if not result.get("has_more") or not page_token:
                break
            if male_count >= _MIN_PER_GENDER and female_count >= _MIN_PER_GENDER:
                break

        curated = _rank_and_balance_looks(combined)
        response = {"data": curated, "has_more": False, "next_token": None}
        _GALLERY_CACHE[cache_key] = {"response": response, "cached_at": time.time()}
        return response
    except Exception as e:
        logger.error(f"Failed to fetch HeyGen avatar looks: {e}")
        raise HTTPException(status_code=502, detail="Unable to load HeyGen avatar looks. Please try again.")

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
