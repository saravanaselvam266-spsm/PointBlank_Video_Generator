import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import AvatarLook, User
from app.schemas import AvatarLookResponse
from app.dependencies.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/avatar-looks", tags=["Avatar Looks"])


@router.get("", response_model=List[AvatarLookResponse])
def list_avatar_looks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List active PointBlank Look Presets (PB-LOOK-xxxx).
    Available to authenticated users.
    """
    looks = db.query(AvatarLook).filter(AvatarLook.is_active == True).order_by(AvatarLook.look_id.asc()).all()
    return looks


@router.get("/{id}", response_model=AvatarLookResponse)
def get_avatar_look_details(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get details of a specific PointBlank Look Preset.
    Supports lookup by DB UUID or look_id (e.g. PB-LOOK-000001).
    """
    look = db.query(AvatarLook).filter(
        (AvatarLook.id == id) | (AvatarLook.look_id == id)
    ).first()

    if not look or not look.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Avatar Look preset '{id}' not found or inactive."
        )

    return look
