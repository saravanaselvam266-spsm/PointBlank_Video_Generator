import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine
from app.routers import auth, users, dashboard, doctors, heygen, videos, public, avatar_scenarios, voices, avatar_looks, script
from app.scripts.create_admin import create_initial_admin
from app.scripts.seed_avatar_looks import seed_avatar_looks
from app.services.azure_blob import azure_blob_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Official PointBlank AI Video Generator Backend Service for Healthcare SaaS",
    version="2.0.0"
)

# CORS Configuration - Explicit Origins for Credentials Support
origins = [
    "http://localhost:5250",
    "http://localhost:3000",
    "http://127.0.0.1:5250",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler to guarantee CORS headers on 500 errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global unhandled exception: {exc}", exc_info=True)
    origin = request.headers.get("origin") or "http://localhost:5250"
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true"
        }
    )

# Mount permanent storage directory
os.makedirs(settings.STORAGE_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.STORAGE_DIR), name="uploads")

# Include Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(dashboard.router)
app.include_router(doctors.router)
app.include_router(avatar_looks.router)
app.include_router(avatar_scenarios.router)
app.include_router(voices.router)
app.include_router(heygen.router)
app.include_router(videos.router)
app.include_router(script.router)
app.include_router(public.router)

@app.on_event("startup")
def on_startup():
    logger.info("PostgreSQL database connection verified.")
    try:
        from app.database import SessionLocal
        from sqlalchemy import text
        db = SessionLocal()
        try:
            sequences = [
                'pb_user_id_seq',
                'pb_doctor_id_seq',
                'pb_avatar_scenario_id_seq',
                'pb_voice_id_seq',
                'pb_video_id_seq',
                'pb_qr_id_seq',
                'pb_look_id_seq'
            ]
            for seq in sequences:
                db.execute(text(f"CREATE SEQUENCE IF NOT EXISTS {seq} START WITH 1"))
            db.commit()
            logger.info("PostgreSQL database sequences verified and created if missing.")
        except Exception as seq_err:
            db.rollback()
            logger.warning(f"Database sequence initialization warning: {seq_err}")
        finally:
            db.close()

        create_initial_admin()
        try:
            seed_avatar_looks()
        except Exception as seed_err:
            logger.warning(f"Avatar look seed warning: {seed_err}")
    except Exception as e:
        logger.warning(f"Startup initial setup warning: {e}")


@app.get("/health")
def health_check():
    # check_connection() never raises — always returns a credential-free status dict,
    # so a slow/unreachable Azure account degrades this field, not the whole endpoint.
    azure_status = azure_blob_service.check_connection()
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "database": "PostgreSQL",
        "heygen_enabled": settings.HEYGEN_ENABLED,
        "azure_blob": azure_status.get("azure_blob"),
        "azure_container": azure_status.get("container")
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
