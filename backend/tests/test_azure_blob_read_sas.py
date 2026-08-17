"""
Covers AzureBlobService.generate_read_sas_url (app/services/azure_blob.py) —
added for inline-viewing use cases (avatar grid images, voice preview audio,
video playback, embedded QR) alongside the existing generate_download_sas_url
(explicit download actions). Same mocked-SDK approach as
test_azure_blob_service.py — no real Azure account contacted.
"""
import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.azure_blob import AzureBlobService
from app.config import settings

FAKE_ACCOUNT_KEY = "totally-fake-secret-key-must-never-appear-in-any-response=="


def _configure(monkeypatch, **overrides):
    defaults = dict(
        AZURE_STORAGE_DEFAULT_ENDPOINTS_PROTOCOL="https",
        AZURE_STORAGE_ACCOUNT_NAME="pointblankstorage",
        AZURE_STORAGE_ACCOUNT_KEY=FAKE_ACCOUNT_KEY,
        AZURE_STORAGE_ENDPOINT_SUFFIX="core.windows.net",
        AZURE_STORAGE_CONTAINER_NAME="pointblank-files",
    )
    defaults.update(overrides)
    for key, value in defaults.items():
        monkeypatch.setattr(settings, key, value)


class TestGenerateReadSasUrl:
    def test_delegates_to_download_sas_with_longer_default_expiry(self, monkeypatch):
        _configure(monkeypatch)
        service = AzureBlobService()
        with patch.object(service, "generate_download_sas_url", return_value="https://signed-url") as mock_download:
            result = service.generate_read_sas_url("avatars/PB-DOC-000001/PB-AVT-000001/final.png")

        assert result == "https://signed-url"
        args, kwargs = mock_download.call_args
        assert args[0] == "avatars/PB-DOC-000001/PB-AVT-000001/final.png"
        assert kwargs["expiry_minutes"] == 60

    def test_custom_expiry_is_forwarded(self, monkeypatch):
        _configure(monkeypatch)
        service = AzureBlobService()
        with patch.object(service, "generate_download_sas_url", return_value="https://signed-url") as mock_download:
            service.generate_read_sas_url("voices/PB-DOC-000001/PB-VCE-000001/preview.mp3", expiry_minutes=5)
        _, kwargs = mock_download.call_args
        assert kwargs["expiry_minutes"] == 5

    def test_never_grants_write_or_delete_permission(self, monkeypatch):
        """Both SAS methods must only ever request read=True — no write/delete escape hatch."""
        _configure(monkeypatch)
        service = AzureBlobService()
        fake_blob_client = MagicMock()
        fake_blob_client.url = "https://pointblankstorage.blob.core.windows.net/pointblank-files/avatars/x.png"
        with patch.object(AzureBlobService, "get_blob_client", return_value=fake_blob_client):
            with patch("app.services.azure_blob.generate_blob_sas", return_value="sv=token") as mock_sas:
                url = service.generate_read_sas_url("avatars/x.png")

        assert url.endswith("?sv=token")
        _, kwargs = mock_sas.call_args
        permission = kwargs["permission"]
        assert permission.read is True
        assert not getattr(permission, "write", False)
        assert not getattr(permission, "delete", False)

    def test_account_key_never_appears_in_returned_url(self, monkeypatch):
        _configure(monkeypatch)
        service = AzureBlobService()
        fake_blob_client = MagicMock()
        fake_blob_client.url = "https://pointblankstorage.blob.core.windows.net/pointblank-files/avatars/x.png"
        with patch.object(AzureBlobService, "get_blob_client", return_value=fake_blob_client):
            url = service.generate_read_sas_url("avatars/x.png")
        assert FAKE_ACCOUNT_KEY not in url
