import bcrypt
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from app.config import settings

def hash_password(password: str) -> str:
    """Hash password securely using bcrypt."""
    pw_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt(12)
    return bcrypt.hashpw(pw_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash."""
    try:
        pw_bytes = plain_password.encode('utf-8')[:72]
        hash_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(pw_bytes, hash_bytes)
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Generate JWT Access Token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """Decode and validate JWT Token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None
