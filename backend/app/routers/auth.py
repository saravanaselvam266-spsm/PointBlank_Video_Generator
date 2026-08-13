from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import UserLoginRequest, TokenResponse, UserResponse
from app.services.auth_service import verify_password, create_access_token
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(login_req: UserLoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_req.email.lower().strip()).first()
    if not user or not verify_password(login_req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email address or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    access_token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})

    # Set HttpOnly Cookie for secure browser sessions
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=86400,
        samesite="lax",
        secure=False # Set to True in HTTPS production
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="access_token")
    return {"message": "Successfully logged out."}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
