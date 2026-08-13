from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class BaseImageTransformationProvider(ABC):
    """
    Abstract Base Class for Real Generative AI Image Transformation Providers.
    Applies PointBlank Look Presets while preserving doctor facial identity.
    """

    @abstractmethod
    def is_configured(self) -> bool:
        """Returns True if the provider API credentials are configured in environment."""
        pass

    @abstractmethod
    async def transform_image(
        self,
        image_bytes: bytes,
        look_preset: Dict[str, Any],
        doctor_name: str
    ) -> bytes:
        """
        Executes real AI visual transformation of the doctor photo according to look preset.
        Preserves doctor's facial structure and identity.
        Returns transformed image bytes.
        """
        pass
