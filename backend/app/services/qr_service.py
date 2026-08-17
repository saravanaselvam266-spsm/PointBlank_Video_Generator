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

    def generate_qr_png_bytes(self, public_url: str) -> bytes:
        """
        Generates a high-quality standalone PNG QR code image encoding public_url.
        Returns raw PNG bytes — the primary output, mirrored to Azure Blob
        Storage by the caller. Never embeds an Azure AccountKey or SAS URL;
        only the plain PointBlank public_url is encoded.
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
        return buffer.getvalue()

    def generate_qr_data_uri(self, public_url: str) -> str:
        """
        Base64 Data URI form of generate_qr_png_bytes: data:image/png;base64,...
        Used as a small, resilient DB-stored fallback when the Azure mirror of
        the same bytes is unavailable — never a duplicate QR render.
        """
        png_bytes = self.generate_qr_png_bytes(public_url)
        base64_png = base64.b64encode(png_bytes).decode("utf-8")
        return f"data:image/png;base64,{base64_png}"

qr_service = QRService()
