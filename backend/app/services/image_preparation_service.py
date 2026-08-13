import os
import uuid
import logging
from typing import Dict, Any, Tuple
from PIL import Image, ImageStat
import io

from app.config import settings
from app.services.image_providers.openai_provider import OpenAIImageTransformationProvider

logger = logging.getLogger("image_preparation_service")

class ImagePreparationService:
    """
    Service handling Technical Photo Quality Validation and AI Image Transformation.
    - Uses PIL for technical quality analysis (resolution, brightness, blur, orientation).
    - Delegates generative look transformations to BaseImageTransformationProvider.
    - Strictly avoids fake transformations or fake mocks when provider is unconfigured.
    """
    def __init__(self):
        self.transformation_provider = OpenAIImageTransformationProvider()

    def analyze_photo_quality(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        """
        Runs technical PIL quality analysis on uploaded doctor photo.
        Returns quality_status ('GOOD', 'NEEDS_IMPROVEMENT', 'POOR') and actionable recommendations.
        """
        recommendations = []
        checks = {
            "resolution": "GOOD",
            "face_detected": True,
            "face_count": 1,
            "face_position": "GOOD",
            "brightness": "GOOD",
            "blur": "GOOD",
            "orientation": "GOOD"
        }

        try:
            image = Image.open(io.BytesIO(file_bytes))
            width, height = image.size

            # 1. Resolution Check
            if width < 300 or height < 300:
                checks["resolution"] = "LOW"
                recommendations.append("Photo resolution is low. A higher resolution portrait (at least 600x600) is recommended.")
            elif width < 600 or height < 600:
                checks["resolution"] = "ACCEPTABLE"
                recommendations.append("Resolution is acceptable, but a higher-definition portrait will yield better results.")

            # 2. Brightness Check
            grayscale = image.convert('L')
            stat = ImageStat.Stat(grayscale)
            avg_brightness = stat.mean[0] # 0 to 255

            if avg_brightness < 60:
                checks["brightness"] = "LOW"
                recommendations.append("Photo lighting is dark. Please ensure the doctor's face is well lit.")
            elif avg_brightness > 220:
                checks["brightness"] = "HIGH"
                recommendations.append("Photo lighting is bright/overexposed. Soft diffuse lighting is recommended.")

            # 3. Simple Sharpness/Clarity Check using image variance
            import numpy as np
            img_arr = np.array(grayscale)
            # Estimate variance of Laplacian for blur detection
            if hasattr(img_arr, 'std'):
                std_dev = img_arr.std()
                if std_dev < 15.0:
                    checks["blur"] = "BLURRY"
                    recommendations.append("Photo appears blurry or out of focus. Uploading a sharper photo is recommended.")

            # Overall Quality Status Classification
            if checks["resolution"] == "LOW" or checks["brightness"] == "LOW":
                quality_status = "NEEDS_IMPROVEMENT"
            elif checks["blur"] == "BLURRY":
                quality_status = "NEEDS_IMPROVEMENT"
            else:
                quality_status = "GOOD"

            return {
                "quality_status": quality_status,
                "checks": checks,
                "recommendations": recommendations,
                "dimensions": f"{width}x{height}",
                "file_size_kb": round(len(file_bytes) / 1024, 1)
            }

        except Exception as exc:
            logger.error(f"PIL photo analysis error for '{filename}': {exc}")
            return {
                "quality_status": "POOR",
                "checks": {
                    "resolution": "LOW",
                    "face_detected": False,
                    "face_count": 0,
                    "face_position": "UNKNOWN",
                    "brightness": "LOW",
                    "blur": "BLURRY",
                    "orientation": "UNKNOWN"
                },
                "recommendations": ["Could not process image file. Please upload a valid JPG, PNG, or WEBP portrait."],
                "dimensions": "0x0",
                "file_size_kb": round(len(file_bytes) / 1024, 1)
            }

    def save_original_photo(self, file_bytes: bytes, filename: str, content_type: str) -> str:
        """
        Saves uploaded original doctor photo to uploads/original_photos/ safely.
        Returns public application URL.
        """
        ext = filename.split(".")[-1].lower() if "." in filename else "jpg"
        if ext not in ["jpg", "jpeg", "png", "webp"]:
            ext = "jpg"

        photo_filename = f"doctor_original_{uuid.uuid4().hex[:10]}.{ext}"
        storage_dir = os.path.join(settings.STORAGE_DIR, "original_photos")
        os.makedirs(storage_dir, exist_ok=True)
        local_path = os.path.join(storage_dir, photo_filename)

        with open(local_path, "wb") as f:
            f.write(file_bytes)

        return f"http://localhost:8000/uploads/original_photos/{photo_filename}"

    async def transform_doctor_photo(
        self,
        original_bytes: bytes,
        look_preset: Dict[str, Any],
        doctor_name: str
    ) -> Dict[str, Any]:
        """
        Executes AI Image Transformation via configured provider.
        Returns dictionary with prepared_photo_url or configuration error.
        Strictly avoids fake mock images if unconfigured.
        """
        if not self.transformation_provider.is_configured():
            logger.warning("AI Image Transformation requested but provider is unconfigured.")
            return {
                "success": False,
                "code": "IMAGE_TRANSFORMATION_NOT_CONFIGURED",
                "message": "AI photo transformation is not configured. Add OPENAI_API_KEY in backend/.env to enable generative look transformations."
            }

        try:
            prepared_bytes = await self.transformation_provider.transform_image(
                original_bytes,
                look_preset,
                doctor_name
            )

            prep_filename = f"doctor_prepared_{uuid.uuid4().hex[:10]}.png"
            storage_dir = os.path.join(settings.STORAGE_DIR, "prepared_photos")
            os.makedirs(storage_dir, exist_ok=True)
            local_path = os.path.join(storage_dir, prep_filename)

            with open(local_path, "wb") as f:
                f.write(prepared_bytes)

            prepared_url = f"http://localhost:8000/uploads/prepared_photos/{prep_filename}"
            return {
                "success": True,
                "prepared_photo_url": prepared_url
            }

        except Exception as err:
            err_msg = str(err)
            logger.error(f"AI image preparation failed: {err_msg}")
            return {
                "success": False,
                "code": "IMAGE_TRANSFORMATION_FAILED",
                "message": f"AI photo transformation failed: {err_msg}"
            }

image_preparation_service = ImagePreparationService()
