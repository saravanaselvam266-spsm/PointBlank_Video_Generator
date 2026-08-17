"""
Covers the HeyGen-completed-video -> Azure Blob Storage -> PostgreSQL reference
flow (app/routers/videos.py::_store_completed_video_in_azure).

Scope: only this orchestration function — no real Azure account, no real
Postgres, no real HeyGen video is touched. httpx (HeyGen download) and
azure_blob_service (Azure upload) are both mocked throughout.
"""
import asyncio
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.routers.videos import _store_completed_video_in_azure


class FakeDoctor:
    def __init__(self, doctor_id):
        self.doctor_id = doctor_id


class FakeVideo:
    def __init__(self, video_id="PB-VID-000001", video_url="https://cdn.heygen.ai/fake-video.mp4", doctor_id="PB-DOC-000001"):
        self.video_id = video_id
        self.video_url = video_url
        self.doctor = FakeDoctor(doctor_id)
        self.doctor_id = doctor_id
        self.azure_blob_name = None
        self.storage_status = "pending"


class FakeDB:
    def __init__(self):
        self.commit_count = 0

    def commit(self):
        self.commit_count += 1


def _run(coro):
    return asyncio.run(coro)


def _fake_httpx_client(status_code=200, content=b"fake-mp4-bytes"):
    fake_response = MagicMock(status_code=status_code, content=content)
    fake_client = AsyncMock()
    fake_client.get = AsyncMock(return_value=fake_response)
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=fake_client)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm


class TestSuccessfulUpload:
    def test_downloads_from_heygen_and_uploads_to_azure(self):
        video = FakeVideo()
        db = FakeDB()

        with patch("app.routers.videos.httpx.AsyncClient", return_value=_fake_httpx_client()):
            with patch("app.routers.videos.azure_blob_service.blob_exists", return_value=False):
                with patch("app.routers.videos.azure_blob_service.upload_bytes") as mock_upload:
                    _run(_store_completed_video_in_azure(video, db))

        assert video.storage_status == "uploaded"
        assert video.azure_blob_name == "videos/PB-DOC-000001/PB-VID-000001.mp4"
        mock_upload.assert_called_once()
        args, kwargs = mock_upload.call_args
        assert args[0] == "videos/PB-DOC-000001/PB-VID-000001.mp4"
        assert args[1] == b"fake-mp4-bytes"

    def test_uses_video_mp4_content_type(self):
        video = FakeVideo()
        db = FakeDB()
        with patch("app.routers.videos.httpx.AsyncClient", return_value=_fake_httpx_client()):
            with patch("app.routers.videos.azure_blob_service.blob_exists", return_value=False):
                with patch("app.routers.videos.azure_blob_service.upload_bytes") as mock_upload:
                    _run(_store_completed_video_in_azure(video, db))
        _, kwargs = mock_upload.call_args
        assert kwargs["content_type"] == "video/mp4"

    def test_blob_path_uses_doctor_business_id_and_video_id(self):
        video = FakeVideo(video_id="PB-VID-000042", doctor_id="PB-DOC-000007")
        db = FakeDB()
        with patch("app.routers.videos.httpx.AsyncClient", return_value=_fake_httpx_client()):
            with patch("app.routers.videos.azure_blob_service.blob_exists", return_value=False):
                with patch("app.routers.videos.azure_blob_service.upload_bytes"):
                    _run(_store_completed_video_in_azure(video, db))
        assert video.azure_blob_name == "videos/PB-DOC-000007/PB-VID-000042.mp4"

    def test_transitions_through_uploading_status(self):
        """storage_status must be set to 'uploading' before the network calls, not skipped."""
        video = FakeVideo()
        db = FakeDB()
        observed_statuses = []

        original_commit = db.commit
        def tracking_commit():
            observed_statuses.append(video.storage_status)
            original_commit()
        db.commit = tracking_commit

        with patch("app.routers.videos.httpx.AsyncClient", return_value=_fake_httpx_client()):
            with patch("app.routers.videos.azure_blob_service.blob_exists", return_value=False):
                with patch("app.routers.videos.azure_blob_service.upload_bytes"):
                    _run(_store_completed_video_in_azure(video, db))

        assert "uploading" in observed_statuses
        assert observed_statuses[-1] == "uploaded"


class TestExistingBlobIsNeverReUploaded:
    def test_skips_download_and_upload_when_blob_already_exists(self):
        video = FakeVideo()
        db = FakeDB()

        with patch("app.routers.videos.httpx.AsyncClient") as mock_client_cls:
            with patch("app.routers.videos.azure_blob_service.blob_exists", return_value=True):
                with patch("app.routers.videos.azure_blob_service.upload_bytes") as mock_upload:
                    _run(_store_completed_video_in_azure(video, db))

        mock_client_cls.assert_not_called()
        mock_upload.assert_not_called()
        assert video.storage_status == "uploaded"
        assert video.azure_blob_name == "videos/PB-DOC-000001/PB-VID-000001.mp4"


class TestHeyGenDownloadFailure:
    def test_non_200_from_heygen_never_attempts_azure_upload(self):
        video = FakeVideo()
        db = FakeDB()

        with patch("app.routers.videos.httpx.AsyncClient", return_value=_fake_httpx_client(status_code=404, content=b"")):
            with patch("app.routers.videos.azure_blob_service.blob_exists", return_value=False):
                with patch("app.routers.videos.azure_blob_service.upload_bytes") as mock_upload:
                    with pytest.raises(RuntimeError, match="Failed to download completed video"):
                        _run(_store_completed_video_in_azure(video, db))

        mock_upload.assert_not_called()
        assert video.storage_status == "failed"

    def test_network_exception_never_attempts_azure_upload(self):
        video = FakeVideo()
        db = FakeDB()
        cm = MagicMock()
        cm.__aenter__ = AsyncMock(side_effect=ConnectionError("network unreachable"))
        cm.__aexit__ = AsyncMock(return_value=False)

        with patch("app.routers.videos.httpx.AsyncClient", return_value=cm):
            with patch("app.routers.videos.azure_blob_service.blob_exists", return_value=False):
                with patch("app.routers.videos.azure_blob_service.upload_bytes") as mock_upload:
                    with pytest.raises(ConnectionError):
                        _run(_store_completed_video_in_azure(video, db))

        mock_upload.assert_not_called()
        assert video.storage_status == "failed"


class TestAzureUploadFailure:
    def test_heygen_download_succeeds_but_azure_upload_fails(self):
        video = FakeVideo()
        db = FakeDB()

        with patch("app.routers.videos.httpx.AsyncClient", return_value=_fake_httpx_client()):
            with patch("app.routers.videos.azure_blob_service.blob_exists", return_value=False):
                with patch(
                    "app.routers.videos.azure_blob_service.upload_bytes",
                    side_effect=RuntimeError("HeyGen Asset... err, Azure Upload Failed (500): boom")
                ):
                    with pytest.raises(RuntimeError):
                        _run(_store_completed_video_in_azure(video, db))

        assert video.storage_status == "failed"
        # video.status (HeyGen generation outcome) is not a field this function
        # ever touches — only storage_status reflects the Azure outcome.
        assert not hasattr(video, "status") or video.storage_status == "failed"


class TestMissingVideoUrl:
    def test_raises_clearly_when_no_video_url(self):
        video = FakeVideo(video_url=None)
        db = FakeDB()
        with pytest.raises(RuntimeError, match="No HeyGen video_url"):
            _run(_store_completed_video_in_azure(video, db))


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
