import secrets
import qrcode
import io
import base64
import logging
from app.config import settings

logger = logging.getLogger("qr_service")

class QRService:
    """
    Public Token & QR Code Generator for PointBlank AI Video Generator.
    Generates secure non-guessable cryptographic tokens and PNG QR codes.
    """
    def generate_public_token(self) -> str:
        """
        Generates a 256-bit cryptographically secure public token.
        """
        return secrets.token_urlsafe(32)

    def generate_qr_data_uri(self, public_url: str) -> str:
        """
        Generates a high-quality standalone PNG QR code image encoding public_url.
        Returns Base64 Data URI: data:image/png;base64,...
        """
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=4,
        )
        qr.add_data(public_url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="#0F172A", back_color="#FFFFFF")
        
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)

        base64_png = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{base64_png}"

qr_service = QRService()
