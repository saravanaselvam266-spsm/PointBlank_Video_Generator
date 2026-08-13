import os
import logging
import httpx
from typing import Dict, Any
from app.services.image_providers.base import BaseImageTransformationProvider

logger = logging.getLogger("image_transformation_provider")

class OpenAIImageTransformationProvider(BaseImageTransformationProvider):
    """
    OpenAI / External Generative AI Image Edit Provider implementation.
    Reads credentials from environment variables.
    """
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY", "").strip() or os.getenv("IMAGE_TRANSFORMATION_API_KEY", "").strip()
        self.api_url = os.getenv("IMAGE_TRANSFORMATION_API_URL", "https://api.openai.com/v1/images/edits").strip()

    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def transform_image(
        self,
        image_bytes: bytes,
        look_preset: Dict[str, Any],
        doctor_name: str
    ) -> bytes:
        if not self.is_configured():
            raise RuntimeError("IMAGE_TRANSFORMATION_NOT_CONFIGURED: AI photo transformation API key is not configured in backend/.env")

        prompt = look_preset.get("transformation_prompt") or f"Professional healthcare portrait of doctor {doctor_name}"
        
        logger.info(f"Submitting AI Image Transformation for '{doctor_name}' with Look '{look_preset.get('name')}'")
        
        headers = {
            "Authorization": f"Bearer {self.api_key}"
        }

        files = {
            "image": ("doctor_portrait.png", image_bytes, "image/png")
        }
        data = {
            "prompt": prompt,
            "n": "1",
            "size": "1024x1024",
            "response_format": "b64_json"
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(self.api_url, headers=headers, data=data, files=files)
            if response.status_code not in (200, 201):
                logger.error(f"Image transformation provider API error ({response.status_code}): {response.text}")
                raise RuntimeError(f"AI Image Transformation Failed ({response.status_code}): {response.text}")

            res_json = response.json()
            import base64
            b64_data = res_json.get("data", [{}])[0].get("b64_json")
            if not b64_data:
                raise RuntimeError("Image transformation provider returned empty image payload.")

            return base64.b64decode(b64_data)
