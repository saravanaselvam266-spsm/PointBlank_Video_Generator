import logging
from datetime import datetime, timedelta, timezone
from typing import Any, BinaryIO, Dict, Optional

from azure.core.exceptions import AzureError
from azure.storage.blob import (
    BlobClient,
    BlobSasPermissions,
    BlobServiceClient,
    ContainerClient,
    ContentSettings,
    generate_blob_sas,
)

from app.config import settings

logger = logging.getLogger("azure_blob_service")


class AzureBlobService:
    """
    Generic Azure Blob Storage service for PointBlank.

    This project has access to exactly ONE Azure Blob container
    (AZURE_STORAGE_CONTAINER_NAME). Every future PointBlank file — doctor
    photos, voices, generated videos, QR codes — is stored as a differently
    prefixed blob name inside this SAME container (e.g. "doctors/PB-DOCTOR-001/
    photo.png", "videos/PB-DOCTOR-001/video-001.mp4"), never as separate
    containers. This service intentionally has no photo/video/voice-specific
    methods yet — only generic blob operations reusable by all of them later.
    """

    def __init__(self):
        self._client: Optional[BlobServiceClient] = None

    def _build_connection_string(self) -> str:
        """
        Builds the Azure Storage connection string from the four individual
        endpoint/credential values. Deliberately excludes ContainerName — the
        container is selected separately via get_container_client(), not
        embedded in the connection string.
        """
        protocol = settings.AZURE_STORAGE_DEFAULT_ENDPOINTS_PROTOCOL
        account_name = settings.AZURE_STORAGE_ACCOUNT_NAME
        account_key = settings.AZURE_STORAGE_ACCOUNT_KEY
        endpoint_suffix = settings.AZURE_STORAGE_ENDPOINT_SUFFIX

        missing = [
            name for name, value in (
                ("AZURE_STORAGE_ACCOUNT_NAME", account_name),
                ("AZURE_STORAGE_ACCOUNT_KEY", account_key),
                ("AZURE_STORAGE_ENDPOINT_SUFFIX", endpoint_suffix),
            ) if not value
        ]
        if missing:
            raise ValueError(
                f"Azure Storage is not configured. Missing: {', '.join(missing)}. "
                f"Set these in backend/.env."
            )

        return (
            f"DefaultEndpointsProtocol={protocol};"
            f"AccountName={account_name};"
            f"AccountKey={account_key};"
            f"EndpointSuffix={endpoint_suffix}"
        )

    @property
    def client(self) -> BlobServiceClient:
        """Lazily builds the BlobServiceClient so a missing/blank .env never crashes app startup."""
        if self._client is None:
            connection_string = self._build_connection_string()
            self._client = BlobServiceClient.from_connection_string(connection_string)
        return self._client

    @property
    def container_name(self) -> str:
        if not settings.AZURE_STORAGE_CONTAINER_NAME:
            raise ValueError("AZURE_STORAGE_CONTAINER_NAME is not configured. Set it in backend/.env.")
        return settings.AZURE_STORAGE_CONTAINER_NAME

    def get_container_client(self) -> ContainerClient:
        """Returns a client for the single configured container."""
        return self.client.get_container_client(self.container_name)

    def get_blob_client(self, blob_name: str) -> BlobClient:
        """Returns a client for `blob_name` inside the single configured container."""
        return self.client.get_blob_client(container=self.container_name, blob=blob_name)

    def upload_bytes(
        self,
        blob_name: str,
        data: bytes,
        content_type: Optional[str] = None,
        overwrite: bool = True
    ) -> str:
        """Uploads raw bytes to `blob_name`. Returns the resulting blob URL."""
        content_settings = ContentSettings(content_type=content_type) if content_type else None
        blob_client = self.get_blob_client(blob_name)
        blob_client.upload_blob(data, overwrite=overwrite, content_settings=content_settings)
        logger.info(
            f"Uploaded blob '{blob_name}' ({len(data)} bytes, "
            f"content_type={content_type or 'application/octet-stream'})"
        )
        return blob_client.url

    def upload_stream(
        self,
        blob_name: str,
        stream: BinaryIO,
        content_type: Optional[str] = None,
        overwrite: bool = True,
        length: Optional[int] = None
    ) -> str:
        """Uploads a file-like stream to `blob_name`. Returns the resulting blob URL."""
        content_settings = ContentSettings(content_type=content_type) if content_type else None
        blob_client = self.get_blob_client(blob_name)
        blob_client.upload_blob(stream, overwrite=overwrite, content_settings=content_settings, length=length)
        logger.info(f"Uploaded blob stream '{blob_name}' (content_type={content_type or 'application/octet-stream'})")
        return blob_client.url

    def download_blob(self, blob_name: str) -> bytes:
        """Downloads and returns the full bytes of `blob_name`."""
        return self.get_blob_client(blob_name).download_blob().readall()

    def blob_exists(self, blob_name: str) -> bool:
        return self.get_blob_client(blob_name).exists()

    def delete_blob(self, blob_name: str) -> None:
        self.get_blob_client(blob_name).delete_blob()
        logger.info(f"Deleted blob '{blob_name}'")

    def generate_download_sas_url(self, blob_name: str, expiry_minutes: int = 15) -> str:
        """
        Generates a short-lived, read-only SAS URL for `blob_name` so the browser
        can download/stream directly from Azure without the backend proxying the
        (potentially large) file and without ever exposing AccountKey to the
        frontend. AccountKey is used only server-side to sign the token; the
        signature in the returned URL cannot be reversed back into the key.

        Intended for explicit "download this file" actions (final video,
        QR image download) — short expiry since the link is used immediately.
        """
        sas_token = generate_blob_sas(
            account_name=settings.AZURE_STORAGE_ACCOUNT_NAME,
            container_name=self.container_name,
            blob_name=blob_name,
            account_key=settings.AZURE_STORAGE_ACCOUNT_KEY,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)
        )
        return f"{self.get_blob_client(blob_name).url}?{sas_token}"

    def generate_read_sas_url(self, blob_name: str, expiry_minutes: int = 60) -> str:
        """
        Generates a short-lived, read-only SAS URL for inline viewing (avatar
        grid images, voice preview audio, video playback, embedded QR images) —
        same read-only signature as generate_download_sas_url, just a longer
        default expiry suited to a page staying open and re-rendering the same
        list without hammering this endpoint. Never grants write/delete access.
        """
        return self.generate_download_sas_url(blob_name, expiry_minutes=expiry_minutes)

    def check_connection(self) -> Dict[str, Any]:
        """
        Lightweight connectivity check — verifies credentials load, the storage
        account is reachable, and the configured container exists/is accessible,
        without uploading or downloading any real file (just a container
        properties lookup). Never raises; always returns a status dict so
        callers (e.g. a health endpoint) can surface a clear, credential-free
        result. Never includes AccountKey or the connection string.
        """
        try:
            container_client = self.get_container_client()
            if not container_client.exists():
                return {
                    "azure_blob": "error",
                    "container": "not_found",
                    "detail": f"Container '{self.container_name}' does not exist or is not accessible."
                }
            return {"azure_blob": "connected", "container": "accessible"}
        except ValueError as exc:
            # Only ever raised by us above with a names-only message — safe to surface.
            return {"azure_blob": "not_configured", "container": "unknown", "detail": str(exc)}
        except AzureError as exc:
            logger.error(f"Azure Blob connectivity check failed: {type(exc).__name__}: {exc}")
            return {
                "azure_blob": "error",
                "container": "unknown",
                "detail": "Azure Storage connection failed. Check server logs for details."
            }
        except Exception as exc:
            logger.error(f"Azure Blob connectivity check failed unexpectedly: {type(exc).__name__}: {exc}")
            return {
                "azure_blob": "error",
                "container": "unknown",
                "detail": "Unexpected error verifying Azure Storage connection."
            }


azure_blob_service = AzureBlobService()
