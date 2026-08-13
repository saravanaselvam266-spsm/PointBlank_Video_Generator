from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import UserResponse, UserUpdateRequest, UserPasswordChangeRequest
from app.dependencies.auth import get_current_user
from app.services.auth_service import verify_password, hash_password

router = APIRouter(prefix="/api/v1/users", tags=["User Profile"])

@router.get("/me", response_model=UserResponse)
def get_user_profile(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=UserResponse)
def update_user_profile(
    update_req: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if update_req.full_name is not None:
        current_user.full_name = update_req.full_name.strip()
    if update_req.avatar_url is not None:
        current_user.avatar_url = update_req.avatar_url.strip()

    db.commit()
    db.refresh(current_user)
    return current_user

@router.post("/me/change-password")
def change_password(
    pwd_req: UserPasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(pwd_req.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password verification failed.",
        )

    current_user.hashed_password = hash_password(pwd_req.new_password)
    db.commit()
    return {"message": "Password changed successfully."}
