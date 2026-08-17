"""
Covers the Azure Blob Storage connection service (app/services/azure_blob.py).

Scope: only the connection/service layer itself — no real Azure account is
required (or contacted) for these tests; the SDK client is mocked throughout.
Real connectivity against a live Azure Storage account is verified separately
via the /health endpoint once real credentials are pasted into backend/.env.
"""
import json
import os
import sys
from unittest.mock import MagicMock, patch

import pytest
from azure.core.exceptions import ServiceRequestError

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


class TestConnectionStringConstruction:
    def test_builds_expected_format_and_excludes_container_name(self, monkeypatch):
        _configure(monkeypatch)
        service = AzureBlobService()
        conn_str = service._build_connection_string()

        assert conn_str == (
            "DefaultEndpointsProtocol=https;"
            "AccountName=pointblankstorage;"
            f"AccountKey={FAKE_ACCOUNT_KEY};"
            "EndpointSuffix=core.windows.net"
        )
        # Requirement: ContainerName must never be embedded in the connection string.
        assert "ContainerName" not in conn_str
        assert "pointblank-files" not in conn_str

    def test_raises_clear_names_only_error_when_account_name_missing(self, monkeypatch):
        _configure(monkeypatch, AZURE_STORAGE_ACCOUNT_NAME="")
        service = AzureBlobService()
        with pytest.raises(ValueError) as exc_info:
            service._build_connection_string()
        assert "AZURE_STORAGE_ACCOUNT_NAME" in str(exc_info.value)
        assert FAKE_ACCOUNT_KEY not in str(exc_info.value)

    def test_raises_clear_names_only_error_when_account_key_missing(self, monkeypatch):
        _configure(monkeypatch, AZURE_STORAGE_ACCOUNT_KEY="")
        service = AzureBlobService()
        with pytest.raises(ValueError) as exc_info:
            service._build_connection_string()
        assert "AZURE_STORAGE_ACCOUNT_KEY" in str(exc_info.value)

    def test_raises_when_all_fields_blank(self, monkeypatch):
        _configure(monkeypatch, AZURE_STORAGE_ACCOUNT_NAME="", AZURE_STORAGE_ACCOUNT_KEY="", AZURE_STORAGE_ENDPOINT_SUFFIX="")
        service = AzureBlobService()
        with pytest.raises(ValueError) as exc_info:
            service._build_connection_string()
        msg = str(exc_info.value)
        assert "AZURE_STORAGE_ACCOUNT_NAME" in msg
        assert "AZURE_STORAGE_ACCOUNT_KEY" in msg
        assert "AZURE_STORAGE_ENDPOINT_SUFFIX" in msg


class TestSingleContainerOnly:
    """The project has exactly one container — never a per-purpose container."""

    def test_container_name_comes_from_single_configured_setting(self, monkeypatch):
        _configure(monkeypatch)
        service = AzureBlobService()
        assert service.container_name == "pointblank-files"

    def test_container_name_raises_when_not_configured(self, monkeypatch):
        _configure(monkeypatch, AZURE_STORAGE_CONTAINER_NAME="")
        service = AzureBlobService()
        with pytest.raises(ValueError):
            _ = service.container_name

    def test_get_container_client_uses_configured_container_only(self, monkeypatch):
        _configure(monkeypatch)
        service = AzureBlobService()
        fake_client = MagicMock()
        with patch.object(AzureBlobService, "client", fake_client):
            service.get_container_client()
            fake_client.get_container_client.assert_called_once_with("pointblank-files")

    def test_get_blob_client_targets_single_container(self, monkeypatch):
        _configure(monkeypatch)
        service = AzureBlobService()
        fake_client = MagicMock()
        with patch.object(AzureBlobService, "client", fake_client):
            service.get_blob_client("doctors/PB-DOCTOR-001/photo.png")
            fake_client.get_blob_client.assert_called_once_with(
                container="pointblank-files", blob="doctors/PB-DOCTOR-001/photo.png"
            )


class TestCheckConnectionNeverRaisesAndNeverLeaksSecrets:
    def test_not_configured_when_credentials_blank(self, monkeypatch):
        _configure(monkeypatch, AZURE_STORAGE_ACCOUNT_KEY="")
        service = AzureBlobService()
        result = service.check_connection()
        assert result["azure_blob"] == "not_configured"
        assert FAKE_ACCOUNT_KEY not in json.dumps(result)

    def test_connected_when_container_exists(self, monkeypatch):
        _configure(monkeypatch)
        service = AzureBlobService()
        fake_container_client = MagicMock()
        fake_container_client.exists.return_value = True
        with patch.object(AzureBlobService, "get_container_client", return_value=fake_container_client):
            result = service.check_connection()
        assert result == {"azure_blob": "connected", "container": "accessible"}

    def test_error_when_container_missing(self, monkeypatch):
        _configure(monkeypatch)
        service = AzureBlobService()
        fake_container_client = MagicMock()
        fake_container_client.exists.return_value = False
        with patch.object(AzureBlobService, "get_container_client", return_value=fake_container_client):
            result = service.check_connection()
        assert result["azure_blob"] == "error"
        assert result["container"] == "not_found"

    def test_azure_error_is_caught_and_never_leaks_key(self, monkeypatch):
        _configure(monkeypatch)
        service = AzureBlobService()
        with patch.object(
            AzureBlobService, "get_container_client",
            side_effect=ServiceRequestError(f"connection failed for key {FAKE_ACCOUNT_KEY}")
        ):
            result = service.check_connection()
        assert result["azure_blob"] == "error"
        assert FAKE_ACCOUNT_KEY not in json.dumps(result)

    def test_unexpected_exception_is_caught_and_never_leaks_key(self, monkeypatch):
        _configure(monkeypatch)
        service = AzureBlobService()
        with patch.object(
            AzureBlobService, "get_container_client",
            side_effect=RuntimeError(f"boom with key {FAKE_ACCOUNT_KEY}")
        ):
            result = service.check_connection()
        assert result["azure_blob"] == "error"
        assert FAKE_ACCOUNT_KEY not in json.dumps(result)


class TestGenericBlobOperations:
    def test_upload_bytes_sets_content_type_and_returns_url(self, monkeypatch):
        _configure(monkeypatch)
        service = AzureBlobService()
        fake_blob_client = MagicMock()
        fake_blob_client.url = "https://pointblankstorage.blob.core.windows.net/pointblank-files/doctors/x.png"
        with patch.object(AzureBlobService, "get_blob_client", return_value=fake_blob_client):
            url = service.upload_bytes("doctors/x.png", b"fake-png-bytes", content_type="image/png")

        assert url == fake_blob_client.url
        _, kwargs = fake_blob_client.upload_blob.call_args
        assert kwargs["content_settings"].content_type == "image/png"
        assert kwargs["overwrite"] is True

    def test_upload_bytes_without_content_type_passes_no_content_settings(self, monkeypatch):
        _configure(monkeypatch)
        service = AzureBlobService()
        fake_blob_client = MagicMock()
        with patch.object(AzureBlobService, "get_blob_client", return_value=fake_blob_client):
            service.upload_bytes("misc/unknown.bin", b"data")
        _, kwargs = fake_blob_client.upload_blob.call_args
        assert kwargs["content_settings"] is None

    def test_upload_stream_passes_content_type_and_length(self, monkeypatch):
        _configure(monkeypatch)
        service = AzureBlobService()
        fake_blob_client = MagicMock()
        fake_stream = MagicMock()
        with patch.object(AzureBlobService, "get_blob_client", return_value=fake_blob_client):
            service.upload_stream("videos/x.mp4", fake_stream, content_type="video/mp4", length=1024)
        _, kwargs = fake_blob_client.upload_blob.call_args
        assert kwargs["content_settings"].content_type == "video/mp4"
        assert kwargs["length"] == 1024

    def test_download_blob_returns_bytes(self, monkeypatch):
        _configure(monkeypatch)
        service = AzureBlobService()
        fake_blob_client = MagicMock()
        fake_blob_client.download_blob.return_value.readall.return_value = b"the-bytes"
        with patch.object(AzureBlobService, "get_blob_client", return_value=fake_blob_client):
            result = service.download_blob("doctors/x.png")
        assert result == b"the-bytes"

    def test_blob_exists_delegates_to_blob_client(self, monkeypatch):
        _configure(monkeypatch)
        service = AzureBlobService()
        fake_blob_client = MagicMock()
        fake_blob_client.exists.return_value = True
        with patch.object(AzureBlobService, "get_blob_client", return_value=fake_blob_client):
            assert service.blob_exists("doctors/x.png") is True

    def test_delete_blob_delegates_to_blob_client(self, monkeypatch):
        _configure(monkeypatch)
        service = AzureBlobService()
        fake_blob_client = MagicMock()
        with patch.object(AzureBlobService, "get_blob_client", return_value=fake_blob_client):
            service.delete_blob("doctors/x.png")
        fake_blob_client.delete_blob.assert_called_once()


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
