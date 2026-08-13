import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "PointBlank AI Video Generator"
    ENVIRONMENT: str = "development"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Database
    DATABASE_URL: str = "postgresql://admin_pointblank:Systech5admin@74.235.29.143:5432/PBVideogeneration"
    
    # Security
    JWT_SECRET_KEY: str = "pointblank_super_secret_jwt_key_2026_greenfield"
    JWT_SECRET: str = "pointblank_super_secret_jwt_key_2026_greenfield"
    ALGORITHM: str = "HS256"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    JWT_EXPIRE_MINUTES: int = 1440
    
    # Official HeyGen API
    HEYGEN_API_KEY: str = ""
    HEYGEN_BASE_URL: str = "https://api.heygen.com"
    HEYGEN_ENABLED: bool = True
    HEYGEN_POLL_INTERVAL: int = 3
    HEYGEN_MAX_RETRIES: int = 40
    
    # Storage & Base URLs
    STORAGE_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    PUBLIC_BASE_URL: str = "http://localhost:5250"
    
    # Initial Admin Setup (Loaded safely from .env)
    INITIAL_ADMIN_EMAIL: str = "admin@pointblank.co.in"
    INITIAL_ADMIN_PASSWORD: str = "PointBlank2026Admin!"
    INITIAL_ADMIN_NAME: str = "Saravana Perumal"
    
    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
        extra = "allow"

settings = Settings()
