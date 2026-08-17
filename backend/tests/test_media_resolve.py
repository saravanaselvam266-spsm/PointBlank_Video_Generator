"""
Covers app/services/media_resolve.py — the shared mirror-to-Azure /
resolve-to-SAS-with-fallback helpers reused by avatar_scenarios.py,
voices.py, videos.py, and public.py.

This is the CRITICAL path for the "final created avatar must be Azure-backed"
requirement: mirror_avatar_preview_to_azure is what actually uploads the
avatar image the Avatar Library displays (not just the source photo).

Scope: no real Azure account, no real Postgres, no real HeyGen/network call —
httpx and azure_blob_service are both mocked throughout, matching the
approach in test_video_azure_storage.py.
"""
import asyncio
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services import media_resolve


def _run(coro):
    return asyncio.run(coro)


def _fake_httpx_client(status_code=200, content=b"fake-bytes"):
    fake_response = MagicMock(status_code=status_code, content=content)
    fake_client = AsyncMock()
    fake_client.get = AsyncMock(return_value=fake_response)
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=fake_client)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm


# A minimal real PNG (1x1 pixel) so sniff_image_content_type succeeds without Pillow.
_REAL_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0"
    b"\x00\x00\x03\x01\x01\x00\x18\xdd\x8d\xb0\x00\x00\x00\x00IEND\xaeB`\x82"
)
# A minimal MP3 frame header, enough for sniff_audio_content_type.
_FAKE_MP3_BYTES = b"\xff\xfb\x90\x00" + b"\x00" * 32


class FakeDoctor:
    def __init__(self, doctor_id="PB-DOC-000001"):
        self.doctor_id = doctor_id


class FakeDB:
    def __init__(self):
        self.commit_count = 0
        self.rollback_count = 0

    def commit(self):
        self.commit_count += 1

    def rollback(self):
        self.rollback_count += 1


class FakeScenario:
    def __init__(self, avatar_scenario_id="PB-AVT-000001", doctor_id="PB-DOC-000001"):
        self.avatar_scenario_id = avatar_scenario_id
        self.doctor = FakeDoctor(doctor_id)
        self.doctor_id = doctor_id
        self.azure_blob_name = None
        self.azure_preview_blob_name = None
        self.original_photo_azure_blob_name = None
        self.avatar_storage_status = "pending"
        self.photo_url = "https://heygen.cdn/preview123.png"
        self.heygen_preview_image_url = "https://heygen.cdn/preview123.png"
        self.original_photo_url = "https://original.example/photo.jpg"


class FakeVoice:
    def __init__(self, voice_id="PB-VCE-000001", doctor_id="PB-DOC-000001"):
        self.voice_id = voice_id
        self.doctor = FakeDoctor(doctor_id)
        self.doctor_id = doctor_id
        self.azure_blob_name = None
        self.voice_storage_status = "pending"
        self.preview_url = "https://heygen.cdn/voice-sample.mp3"


class FakeVideo:
    def __init__(self, video_id="PB-VID-000001"):
        self.video_id = video_id
        self.video_url = "https://heygen.cdn/video.mp4"
        self.azure_blob_name = None
        self.storage_status = "pending"


class FakeShare:
    def __init__(self):
        self.qr_id = "PB-QR-000001"
        self.qr_blob_name = None
        self.qr_image = "data:image/png;base64,ZmFsbGJhY2s="


# --- Final avatar mirror: THE critical path ---

class TestMirrorAvatarPreviewToAzure:
    def test_downloads_and_uploads_final_avatar_image(self):
        scenario = FakeScenario()
        db = FakeDB()
        with patch("app.services.media_resolve.httpx.AsyncClient", return_value=_fake_httpx_client(content=_REAL_PNG_BYTES)):
            with patch("app.services.media_resolve.azure_blob_service.upload_bytes") as mock_upload:
                _run(media_resolve.mirror_avatar_preview_to_azure(scenario, scenario.heygen_preview_image_url, db))

        mock_upload.assert_called_once()
        args, kwargs = mock_upload.call_args
        assert args[0] == "avatars/PB-DOC-000001/PB-AVT-000001/final.png"
        assert args[1] == _REAL_PNG_BYTES
        assert kwargs["content_type"] == "image/png"

    def test_sets_both_azure_blob_name_fields_to_the_same_blob(self):
        """No separate provider-rendered 'final' vs 'preview' asset exists — both
        fields point at the one mirrored blob, never left blank when upload succeeds."""
        scenario = FakeScenario()
        db = FakeDB()
        with patch("app.services.media_resolve.httpx.AsyncClient", return_value=_fake_httpx_client(content=_REAL_PNG_BYTES)):
            with patch("app.services.media_resolve.azure_blob_service.upload_bytes"):
                _run(media_resolve.mirror_avatar_preview_to_azure(scenario, scenario.heygen_preview_image_url, db))

        assert scenario.azure_blob_name == "avatars/PB-DOC-000001/PB-AVT-000001/final.png"
        assert scenario.azure_preview_blob_name == scenario.azure_blob_name
        assert scenario.avatar_storage_status == "uploaded"

    def test_uses_doctor_business_id_and_avatar_scenario_business_id(self):
        scenario = FakeScenario(avatar_scenario_id="PB-AVT-000042", doctor_id="PB-DOC-000007")
        db = FakeDB()
        with patch("app.services.media_resolve.httpx.AsyncClient", return_value=_fake_httpx_client(content=_REAL_PNG_BYTES)):
            with patch("app.services.media_resolve.azure_blob_service.upload_bytes"):
                _run(media_resolve.mirror_avatar_preview_to_azure(scenario, scenario.heygen_preview_image_url, db))
        assert scenario.azure_blob_name == "avatars/PB-DOC-000007/PB-AVT-000042/final.png"

    def test_idempotent_skips_reupload_when_already_uploaded_for_this_blob(self):
        scenario = FakeScenario()
        scenario.avatar_storage_status = "uploaded"
        scenario.azure_blob_name = "avatars/PB-DOC-000001/PB-AVT-000001/final.png"
        db = FakeDB()
        with patch("app.services.media_resolve.httpx.AsyncClient") as mock_client_cls:
            with patch("app.services.media_resolve.azure_blob_service.upload_bytes") as mock_upload:
                _run(media_resolve.mirror_avatar_preview_to_azure(scenario, scenario.heygen_preview_image_url, db))
        mock_client_cls.assert_not_called()
        mock_upload.assert_not_called()

    def test_no_op_when_no_preview_url(self):
        scenario = FakeScenario()
        db = FakeDB()
        with patch("app.services.media_resolve.azure_blob_service.upload_bytes") as mock_upload:
            _run(media_resolve.mirror_avatar_preview_to_azure(scenario, None, db))
        mock_upload.assert_not_called()
        assert scenario.avatar_storage_status == "pending"

    def test_download_failure_marks_failed_not_raises(self):
        scenario = FakeScenario()
        db = FakeDB()
        with patch("app.services.media_resolve.httpx.AsyncClient", return_value=_fake_httpx_client(status_code=404, content=b"")):
            with patch("app.services.media_resolve.azure_blob_service.upload_bytes") as mock_upload:
                _run(media_resolve.mirror_avatar_preview_to_azure(scenario, scenario.heygen_preview_image_url, db))
        mock_upload.assert_not_called()
        assert scenario.avatar_storage_status == "failed"

    def test_unrecognized_image_bytes_marks_failed_not_raises(self):
        scenario = FakeScenario()
        db = FakeDB()
        with patch("app.services.media_resolve.httpx.AsyncClient", return_value=_fake_httpx_client(content=b"<html>not an image</html>")):
            with patch("app.services.media_resolve.azure_blob_service.upload_bytes") as mock_upload:
                _run(media_resolve.mirror_avatar_preview_to_azure(scenario, scenario.heygen_preview_image_url, db))
        mock_upload.assert_not_called()
        assert scenario.avatar_storage_status == "failed"

    def test_azure_upload_exception_marks_failed_not_raises(self):
        """HeyGen already succeeded — a storage hiccup must never raise past this function."""
        scenario = FakeScenario()
        db = FakeDB()
        with patch("app.services.media_resolve.httpx.AsyncClient", return_value=_fake_httpx_client(content=_REAL_PNG_BYTES)):
            with patch("app.services.media_resolve.azure_blob_service.upload_bytes", side_effect=RuntimeError("boom")):
                _run(media_resolve.mirror_avatar_preview_to_azure(scenario, scenario.heygen_preview_image_url, db))
        assert scenario.avatar_storage_status == "failed"
        assert scenario.azure_blob_name is None


class TestResolveAvatarPhotoUrl:
    def test_returns_sas_url_when_uploaded(self):
        scenario = FakeScenario()
        scenario.avatar_storage_status = "uploaded"
        scenario.azure_blob_name = "avatars/PB-DOC-000001/PB-AVT-000001/final.png"
        with patch("app.services.media_resolve.azure_blob_service.generate_read_sas_url", return_value="https://sas-url"):
            assert media_resolve.resolve_avatar_photo_url(scenario) == "https://sas-url"

    def test_falls_back_to_heygen_url_when_not_uploaded(self):
        scenario = FakeScenario()
        assert media_resolve.resolve_avatar_photo_url(scenario) == scenario.photo_url

    def test_falls_back_when_sas_generation_raises(self):
        scenario = FakeScenario()
        scenario.avatar_storage_status = "uploaded"
        scenario.azure_blob_name = "avatars/x/y/final.png"
        with patch("app.services.media_resolve.azure_blob_service.generate_read_sas_url", side_effect=RuntimeError("azure down")):
            assert media_resolve.resolve_avatar_photo_url(scenario) == scenario.photo_url

    def test_never_raises_even_with_no_urls_at_all(self):
        scenario = FakeScenario()
        scenario.photo_url = None
        scenario.heygen_preview_image_url = None
        scenario.original_photo_url = None
        assert media_resolve.resolve_avatar_photo_url(scenario) is None


# --- Original doctor photo mirror ---

class TestMirrorOriginalPhotoToAzure:
    def test_uploads_to_doctor_photos_prefix(self):
        scenario = FakeScenario()
        db = FakeDB()
        with patch("app.services.media_resolve.azure_blob_service.upload_bytes") as mock_upload:
            media_resolve.mirror_original_photo_to_azure(scenario, _REAL_PNG_BYTES, "image/png", db)
        mock_upload.assert_called_once_with(
            "doctors/PB-DOC-000001/photos/PB-AVT-000001.png", _REAL_PNG_BYTES, content_type="image/png"
        )
        assert scenario.original_photo_azure_blob_name == "doctors/PB-DOC-000001/photos/PB-AVT-000001.png"

    def test_failure_is_swallowed_not_raised(self):
        """Local disk remains authoritative either way — Azure mirror failure must not break photo upload."""
        scenario = FakeScenario()
        db = FakeDB()
        with patch("app.services.media_resolve.azure_blob_service.upload_bytes", side_effect=RuntimeError("boom")):
            media_resolve.mirror_original_photo_to_azure(scenario, _REAL_PNG_BYTES, "image/png", db)
        assert scenario.original_photo_azure_blob_name is None


# --- Voice preview mirror ---

class TestMirrorVoicePreviewToAzure:
    def test_uploads_voice_preview_with_detected_audio_type(self):
        voice = FakeVoice()
        db = FakeDB()
        with patch("app.services.media_resolve.httpx.AsyncClient", return_value=_fake_httpx_client(content=_FAKE_MP3_BYTES)):
            with patch("app.services.media_resolve.azure_blob_service.upload_bytes") as mock_upload:
                _run(media_resolve.mirror_voice_preview_to_azure(voice, voice.preview_url, db))

        mock_upload.assert_called_once()
        args, kwargs = mock_upload.call_args
        assert args[0] == "voices/PB-DOC-000001/PB-VCE-000001/preview.mp3"
        assert kwargs["content_type"] == "audio/mpeg"
        assert voice.azure_blob_name == "voices/PB-DOC-000001/PB-VCE-000001/preview.mp3"
        assert voice.voice_storage_status == "uploaded"

    def test_unrecognized_audio_marks_failed(self):
        voice = FakeVoice()
        db = FakeDB()
        with patch("app.services.media_resolve.httpx.AsyncClient", return_value=_fake_httpx_client(content=b"not audio")):
            with patch("app.services.media_resolve.azure_blob_service.upload_bytes") as mock_upload:
                _run(media_resolve.mirror_voice_preview_to_azure(voice, voice.preview_url, db))
        mock_upload.assert_not_called()
        assert voice.voice_storage_status == "failed"


class TestResolveVoicePreviewUrl:
    def test_returns_sas_when_uploaded(self):
        voice = FakeVoice()
        voice.voice_storage_status = "uploaded"
        voice.azure_blob_name = "voices/x/y/preview.mp3"
        with patch("app.services.media_resolve.azure_blob_service.generate_read_sas_url", return_value="https://sas-audio"):
            assert media_resolve.resolve_voice_preview_url(voice) == "https://sas-audio"

    def test_falls_back_to_original_preview_url(self):
        voice = FakeVoice()
        assert media_resolve.resolve_voice_preview_url(voice) == voice.preview_url


# --- Video playback resolution (source-of-truth preference) ---

class TestResolveVideoPlaybackUrl:
    def test_prefers_azure_sas_when_uploaded(self):
        video = FakeVideo()
        video.storage_status = "uploaded"
        video.azure_blob_name = "videos/PB-DOC-000001/PB-VID-000001.mp4"
        with patch("app.services.media_resolve.azure_blob_service.generate_read_sas_url", return_value="https://sas-video"):
            assert media_resolve.resolve_video_playback_url(video) == "https://sas-video"

    def test_falls_back_to_provider_url_when_not_uploaded(self):
        video = FakeVideo()
        assert media_resolve.resolve_video_playback_url(video) == video.video_url

    def test_falls_back_to_provider_url_when_sas_generation_fails(self):
        video = FakeVideo()
        video.storage_status = "uploaded"
        video.azure_blob_name = "videos/x.mp4"
        with patch("app.services.media_resolve.azure_blob_service.generate_read_sas_url", side_effect=RuntimeError("down")):
            assert media_resolve.resolve_video_playback_url(video) == video.video_url


# --- QR image resolution ---

class TestResolveQrImage:
    def test_prefers_azure_sas_when_blob_name_set(self):
        share = FakeShare()
        share.qr_blob_name = "qr/PB-DOC-000001/PB-VID-000001.png"
        with patch("app.services.media_resolve.azure_blob_service.generate_read_sas_url", return_value="https://sas-qr"):
            assert media_resolve.resolve_qr_image(share) == "https://sas-qr"

    def test_falls_back_to_base64_when_no_blob_name(self):
        share = FakeShare()
        assert media_resolve.resolve_qr_image(share) == share.qr_image

    def test_falls_back_to_base64_when_sas_generation_fails(self):
        share = FakeShare()
        share.qr_blob_name = "qr/x.png"
        with patch("app.services.media_resolve.azure_blob_service.generate_read_sas_url", side_effect=RuntimeError("down")):
            assert media_resolve.resolve_qr_image(share) == share.qr_image


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
