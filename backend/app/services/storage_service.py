import os
import uuid
import httpx
import logging
from typing import Dict, Any
from app.config import settings

logger = logging.getLogger("storage_service")

class StorageService:
    """
    Permanent Local Storage Service for PointBlank AI Video Generator.
    Downloads temporary HeyGen video URLs into permanent local storage.
    """
    def __init__(self, storage_dir: str = settings.STORAGE_DIR):
        self.storage_dir = storage_dir
        self.photos_dir = os.path.join(storage_dir, "photos")
        self.videos_dir = os.path.join(storage_dir, "videos")

        os.makedirs(self.photos_dir, exist_ok=True)
        os.makedirs(self.videos_dir, exist_ok=True)

    async def save_photo_upload(self, file_bytes: bytes, filename: str) -> Dict[str, str]:
        """
        Saves user photo upload to local permanent storage.
        """
        ext = os.path.splitext(filename)[1].lower() or ".jpg"
        photo_id = f"photo_{uuid.uuid4().hex[:12]}{ext}"
        file_path = os.path.join(self.photos_dir, photo_id)

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        relative_key = f"uploads/photos/{photo_id}"
        public_url = f"http://localhost:8000/{relative_key}"

        logger.info(f"Saved photo upload to {file_path}")
        return {
            "storage_key": relative_key,
            "public_url": public_url,
            "local_path": file_path
        }

    async def download_and_store_video(self, heygen_video_url: str, video_id: str) -> Dict[str, str]:
        """
        Downloads completed video MP4 from temporary HeyGen CDN URL
        and stores it permanently in PointBlank storage.
        """
        file_name = f"{video_id}.mp4"
        file_path = os.path.join(self.videos_dir, file_name)

        logger.info(f"Downloading completed video from HeyGen CDN: {heygen_video_url}")

        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
            res = await client.get(heygen_video_url)
            if res.status_code != 200:
                logger.error(f"Failed to download video from HeyGen CDN ({res.status_code})")
                raise RuntimeError(f"Failed to download video from HeyGen CDN ({res.status_code})")

            with open(file_path, "wb") as f:
                f.write(res.content)

        relative_key = f"uploads/videos/{file_name}"
        public_url = f"http://localhost:8000/{relative_key}"

        logger.info(f"Successfully stored permanent video MP4 at {file_path}")
        return {
            "storage_key": relative_key,
            "public_url": public_url,
            "file_size": len(res.content)
        }

storage_service = StorageService()
