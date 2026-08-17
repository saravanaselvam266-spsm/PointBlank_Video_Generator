"""
Covers app/routers/videos.py::_ensure_public_share — the get-or-create QR/
public-share flow. Reuses the existing qr_service and PublicVideoShare model
(no duplicate sharing system). QR PNG bytes are mirrored to Azure Blob
Storage; qr_image keeps a small base64 fallback of the SAME bytes.

Scope: no real Postgres, no real Azure — db is a MagicMock, azure_blob_service
and qr_service are patched. get_next_pb_id is patched to avoid touching a
real sequence.
"""
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.routers.videos import _ensure_public_share
from app.models import PublicVideoShare


class FakeDoctor:
    doctor_id = "PB-DOC-000001"


class FakeVideo:
    def __init__(self, status="COMPLETED", video_id="PB-VID-000001"):
        self.id = "video-uuid-1"
        self.video_id = video_id
        self.status = status
        self.doctor = FakeDoctor()
        self.doctor_id = "doctor-uuid-1"


def _db_with_no_existing_share():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    return db


class TestCreatesNewShareWhenNoneExists:
    def test_creates_share_and_uploads_qr_to_azure(self):
        video = FakeVideo()
        db = _db_with_no_existing_share()

        with patch("app.routers.videos.get_next_pb_id", return_value="PB-QR-000001"):
            with patch("app.routers.videos.qr_service.generate_public_token", return_value="tok123"):
                with patch("app.routers.videos.qr_service.generate_qr_png_bytes", return_value=b"png-bytes") as mock_qr:
                    with patch("app.routers.videos.azure_blob_service.upload_bytes") as mock_upload:
                        share = _ensure_public_share(video, db)

        mock_qr.assert_called_once()
        mock_upload.assert_called_once()
        args, kwargs = mock_upload.call_args
        assert args[0] == "qr/PB-DOC-000001/PB-VID-000001.png"
        assert args[1] == b"png-bytes"
        assert kwargs["content_type"] == "image/png"

        assert isinstance(share, PublicVideoShare)
        assert share.qr_id == "PB-QR-000001"
        assert share.public_token == "tok123"
        assert share.qr_blob_name == "qr/PB-DOC-000001/PB-VID-000001.png"
        assert share.qr_image.startswith("data:image/png;base64,")
        db.add.assert_called_once()
        db.commit.assert_called()

    def test_public_url_uses_configured_base_url_and_token(self):
        video = FakeVideo()
        db = _db_with_no_existing_share()

        with patch("app.routers.videos.settings.PUBLIC_BASE_URL", "https://watch.pointblank.example"):
            with patch("app.routers.videos.get_next_pb_id", return_value="PB-QR-000002"):
                with patch("app.routers.videos.qr_service.generate_public_token", return_value="secure-tok"):
                    with patch("app.routers.videos.qr_service.generate_qr_png_bytes", return_value=b"x"):
                        with patch("app.routers.videos.azure_blob_service.upload_bytes"):
                            share = _ensure_public_share(video, db)

        assert share.public_url == "https://watch.pointblank.example/watch/secure-tok"

    def test_azure_upload_failure_still_creates_share_with_base64_fallback(self):
        """QR Azure mirroring is best-effort — a failure must not block the share/token from existing."""
        video = FakeVideo()
        db = _db_with_no_existing_share()

        with patch("app.routers.videos.get_next_pb_id", return_value="PB-QR-000003"):
            with patch("app.routers.videos.qr_service.generate_public_token", return_value="tok"):
                with patch("app.routers.videos.qr_service.generate_qr_png_bytes", return_value=b"png-bytes"):
                    with patch("app.routers.videos.azure_blob_service.upload_bytes", side_effect=RuntimeError("azure down")):
                        share = _ensure_public_share(video, db)

        assert share.qr_blob_name is None
        assert share.qr_image.startswith("data:image/png;base64,")
        assert share.public_token == "tok"

    def test_raises_value_error_when_video_not_completed(self):
        video = FakeVideo(status="PROCESSING")
        db = _db_with_no_existing_share()
        with pytest.raises(ValueError, match="completed"):
            _ensure_public_share(video, db)


class TestGetOrCreateIsIdempotent:
    def test_returns_existing_share_without_creating_new_one(self):
        video = FakeVideo()
        existing_share = MagicMock(spec=PublicVideoShare)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = existing_share

        with patch("app.routers.videos.qr_service.generate_public_token") as mock_token:
            with patch("app.routers.videos.azure_blob_service.upload_bytes") as mock_upload:
                result = _ensure_public_share(video, db)

        assert result is existing_share
        mock_token.assert_not_called()
        mock_upload.assert_not_called()
        db.add.assert_not_called()


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
