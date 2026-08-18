"""
Covers the Doctor Original Voice cloning feature end to end at the service
layer: audio validation (media_utils), the original-recording Azure mirror
(media_resolve), the real HeyGen v3 voice-cloning HTTP calls (heygen_service),
and the router's clone-submission/retry helpers (routers.voices).

Scope matches the rest of this suite: no real Azure account, no real Postgres,
no real HeyGen/network call — httpx, azure_blob_service, and heygen_service
are all mocked throughout.
"""
import asyncio
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services import media_resolve
from app.services import media_utils
from app.services.heygen_service import HeyGenService
from app.routers import voices as voices_router
from app.config import settings


@pytest.fixture(autouse=True)
def _fake_heygen_api_key(monkeypatch):
    """_get_headers() reads settings.HEYGEN_API_KEY first (with an os.getenv
    fallback) — real .env value would otherwise leak into these HTTP-call
    assertions instead of the per-test fake key."""
    monkeypatch.setattr(settings, "HEYGEN_API_KEY", "fake-key")
    monkeypatch.setenv("HEYGEN_API_KEY", "fake-key")


def _run(coro):
    return asyncio.run(coro)


# A minimal MP3 frame header, enough for sniff_audio_content_type / is_clonable_audio_content_type.
_FAKE_MP3_BYTES = b"\xff\xfb\x90\x00" + b"\x00" * 32
_FAKE_WAV_BYTES = b"RIFF\x00\x00\x00\x00WAVEfmt " + b"\x00" * 16
_FAKE_OGG_BYTES = b"OggS" + b"\x00" * 32


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


class FakeVoice:
    def __init__(self, voice_id="PB-VCE-000001", doctor_id="PB-DOC-000001"):
        self.id = "voice-db-id-1"
        self.voice_id = voice_id
        self.doctor = FakeDoctor(doctor_id)
        self.doctor_id = doctor_id
        self.name = "Dr. Saravana Original Voice"
        self.language = "en"
        self.source_audio_blob_name = None
        self.source_content_type = None
        self.original_filename = "recording.mp3"
        self.heygen_voice_id = None
        self.clone_status = "pending"
        self.clone_failure_reason = None
        self.is_default = False


# --- Audio validation (media_utils) ---

class TestIsClonableAudioContentType:
    def test_mp3_is_clonable(self):
        assert media_utils.is_clonable_audio_content_type("audio/mpeg") is True

    def test_wav_is_clonable(self):
        assert media_utils.is_clonable_audio_content_type("audio/wav") is True

    def test_ogg_is_not_clonable(self):
        """sniff_audio_content_type recognizes ogg/m4a for playback, but HeyGen's
        real clone API only documents mp3/wav — never claim broader support."""
        assert media_utils.is_clonable_audio_content_type("audio/ogg") is False

    def test_m4a_is_not_clonable(self):
        assert media_utils.is_clonable_audio_content_type("audio/mp4") is False

    def test_none_is_not_clonable(self):
        assert media_utils.is_clonable_audio_content_type(None) is False

    def test_sniff_then_validate_real_mp3_bytes(self):
        detected = media_utils.sniff_audio_content_type(_FAKE_MP3_BYTES)
        assert detected == "audio/mpeg"
        assert media_utils.is_clonable_audio_content_type(detected) is True

    def test_sniff_then_validate_real_wav_bytes(self):
        detected = media_utils.sniff_audio_content_type(_FAKE_WAV_BYTES)
        assert detected == "audio/wav"
        assert media_utils.is_clonable_audio_content_type(detected) is True

    def test_sniff_then_validate_ogg_bytes_rejected_for_cloning(self):
        detected = media_utils.sniff_audio_content_type(_FAKE_OGG_BYTES)
        assert detected == "audio/ogg"
        assert media_utils.is_clonable_audio_content_type(detected) is False

    def test_corrupted_file_sniffs_to_none(self):
        assert media_utils.sniff_audio_content_type(b"not audio at all") is None
        assert media_utils.is_clonable_audio_content_type(None) is False

    def test_size_limit_constants_match_heygen_documented_limit(self):
        assert media_utils.MAX_VOICE_CLONE_UPLOAD_BYTES == 32 * 1024 * 1024


# --- Original recording Azure mirror (media_resolve) ---

class TestMirrorVoiceSourceToAzure:
    def test_uploads_to_original_blob_path_with_correct_content_type(self):
        voice = FakeVoice()
        db = FakeDB()
        with patch("app.services.media_resolve.azure_blob_service.upload_bytes") as mock_upload:
            blob_name = media_resolve.mirror_voice_source_to_azure(voice, _FAKE_MP3_BYTES, "audio/mpeg", db)

        assert blob_name == "voices/PB-DOC-000001/PB-VCE-000001/original.mp3"
        mock_upload.assert_called_once_with(blob_name, _FAKE_MP3_BYTES, content_type="audio/mpeg", cache_control=media_resolve.IMMUTABLE_CACHE_CONTROL)
        assert voice.source_audio_blob_name == blob_name
        assert voice.source_content_type == "audio/mpeg"
        assert db.commit_count == 1

    def test_wav_extension_is_wav_not_bin(self):
        voice = FakeVoice()
        db = FakeDB()
        with patch("app.services.media_resolve.azure_blob_service.upload_bytes"):
            blob_name = media_resolve.mirror_voice_source_to_azure(voice, _FAKE_WAV_BYTES, "audio/wav", db)
        assert blob_name == "voices/PB-DOC-000001/PB-VCE-000001/original.wav"

    def test_azure_failure_raises_and_does_not_set_blob_name(self):
        """Unlike the best-effort mirror_* helpers, this must raise so the caller
        aborts before ever calling the cloning API — per the required failure flow."""
        voice = FakeVoice()
        db = FakeDB()
        with patch("app.services.media_resolve.azure_blob_service.upload_bytes", side_effect=RuntimeError("azure down")):
            with pytest.raises(RuntimeError):
                media_resolve.mirror_voice_source_to_azure(voice, _FAKE_MP3_BYTES, "audio/mpeg", db)
        assert voice.source_audio_blob_name is None
        assert db.commit_count == 0


class TestResolveVoiceSourcePreviewUrl:
    def test_returns_sas_when_source_blob_set(self):
        voice = FakeVoice()
        voice.source_audio_blob_name = "voices/PB-DOC-000001/PB-VCE-000001/original.mp3"
        with patch("app.services.media_resolve.azure_blob_service.generate_read_sas_url", return_value="https://sas-original"):
            assert media_resolve.resolve_voice_source_preview_url(voice) == "https://sas-original"

    def test_returns_none_when_not_yet_uploaded(self):
        voice = FakeVoice()
        assert media_resolve.resolve_voice_source_preview_url(voice) is None

    def test_returns_none_when_sas_generation_fails(self):
        voice = FakeVoice()
        voice.source_audio_blob_name = "voices/x/y/original.mp3"
        with patch("app.services.media_resolve.azure_blob_service.generate_read_sas_url", side_effect=RuntimeError("down")):
            assert media_resolve.resolve_voice_source_preview_url(voice) is None


# --- Real HeyGen v3 voice cloning HTTP calls (heygen_service) ---

def _fake_httpx_post_client(status_code=200, json_body=None):
    fake_response = MagicMock(status_code=status_code, text="error-text")
    fake_response.json.return_value = json_body or {}
    fake_client = AsyncMock()
    fake_client.post = AsyncMock(return_value=fake_response)
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=fake_client)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm, fake_client


def _fake_httpx_get_client(status_code=200, json_body=None):
    fake_response = MagicMock(status_code=status_code, text="error-text")
    fake_response.json.return_value = json_body or {}
    fake_client = AsyncMock()
    fake_client.get = AsyncMock(return_value=fake_response)
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=fake_client)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm, fake_client


class TestUploadAudioAsset:
    def test_posts_to_v3_assets_with_correct_headers_and_multipart_file(self):
        service = HeyGenService(api_key="fake-key", base_url="https://api.heygen.com")
        cm, fake_client = _fake_httpx_post_client(
            status_code=200,
            json_body={"data": {"asset_id": "asset-123", "url": "https://cdn/x.mp3", "mime_type": "audio/mpeg", "size_bytes": 4096}},
        )
        with patch("app.services.heygen_service.httpx.AsyncClient", return_value=cm):
            result = _run(service.upload_audio_asset(_FAKE_MP3_BYTES, filename="rec.mp3", content_type="audio/mpeg"))

        assert result["asset_id"] == "asset-123"
        assert result["url"] == "https://cdn/x.mp3"

        call_args, call_kwargs = fake_client.post.call_args
        assert call_args[0] == "https://api.heygen.com/v3/assets"
        assert call_kwargs["headers"]["X-Api-Key"] == "fake-key"
        # Multipart upload — Content-Type must NOT be forced to application/json.
        assert "Content-Type" not in call_kwargs["headers"]
        assert call_kwargs["files"]["file"][0] == "rec.mp3"
        assert call_kwargs["files"]["file"][1] == _FAKE_MP3_BYTES
        assert call_kwargs["files"]["file"][2] == "audio/mpeg"

    def test_missing_asset_id_raises(self):
        service = HeyGenService(api_key="fake-key")
        cm, _ = _fake_httpx_post_client(status_code=200, json_body={"data": {}})
        with patch("app.services.heygen_service.httpx.AsyncClient", return_value=cm):
            with pytest.raises(RuntimeError):
                _run(service.upload_audio_asset(_FAKE_MP3_BYTES, filename="rec.mp3", content_type="audio/mpeg"))

    def test_non_200_raises(self):
        service = HeyGenService(api_key="fake-key")
        cm, _ = _fake_httpx_post_client(status_code=400, json_body={})
        with patch("app.services.heygen_service.httpx.AsyncClient", return_value=cm):
            with pytest.raises(RuntimeError):
                _run(service.upload_audio_asset(_FAKE_MP3_BYTES, filename="rec.mp3", content_type="audio/mpeg"))


class TestCloneVoice:
    def test_posts_to_v3_voices_clone_with_documented_payload_shape(self):
        service = HeyGenService(api_key="fake-key", base_url="https://api.heygen.com")
        cm, fake_client = _fake_httpx_post_client(status_code=200, json_body={"data": {"voice_clone_id": "clone-abc"}})
        with patch("app.services.heygen_service.httpx.AsyncClient", return_value=cm):
            voice_clone_id = _run(service.clone_voice(asset_id="asset-123", voice_name="Dr. Smith Voice", language="en"))

        assert voice_clone_id == "clone-abc"
        call_args, call_kwargs = fake_client.post.call_args
        assert call_args[0] == "https://api.heygen.com/v3/voices/clone"
        assert call_kwargs["headers"]["X-Api-Key"] == "fake-key"
        payload = call_kwargs["json"]
        assert payload["audio"] == {"type": "asset_id", "asset_id": "asset-123"}
        assert payload["voice_name"] == "Dr. Smith Voice"
        assert payload["language"] == "en"
        assert payload["remove_background_noise"] is True

    def test_omits_language_when_not_provided(self):
        service = HeyGenService(api_key="fake-key")
        cm, fake_client = _fake_httpx_post_client(status_code=200, json_body={"data": {"voice_clone_id": "clone-abc"}})
        with patch("app.services.heygen_service.httpx.AsyncClient", return_value=cm):
            _run(service.clone_voice(asset_id="asset-123", voice_name="Dr. Smith Voice"))
        _, call_kwargs = fake_client.post.call_args
        assert "language" not in call_kwargs["json"]

    def test_402_raises_insufficient_credits(self):
        service = HeyGenService(api_key="fake-key")
        cm, _ = _fake_httpx_post_client(status_code=402, json_body={})
        with patch("app.services.heygen_service.httpx.AsyncClient", return_value=cm):
            with pytest.raises(RuntimeError, match="INSUFFICIENT_CREDITS"):
                _run(service.clone_voice(asset_id="asset-123", voice_name="X"))

    def test_403_raises_voice_clone_forbidden(self):
        """Covers the documented account-tier restriction — must be surfaced distinctly, not silently faked as success."""
        service = HeyGenService(api_key="fake-key")
        cm, _ = _fake_httpx_post_client(status_code=403, json_body={})
        with patch("app.services.heygen_service.httpx.AsyncClient", return_value=cm):
            with pytest.raises(RuntimeError, match="VOICE_CLONE_FORBIDDEN"):
                _run(service.clone_voice(asset_id="asset-123", voice_name="X"))

    def test_missing_voice_clone_id_raises(self):
        service = HeyGenService(api_key="fake-key")
        cm, _ = _fake_httpx_post_client(status_code=200, json_body={"data": {}})
        with patch("app.services.heygen_service.httpx.AsyncClient", return_value=cm):
            with pytest.raises(RuntimeError):
                _run(service.clone_voice(asset_id="asset-123", voice_name="X"))


class TestGetVoiceCloneStatus:
    def test_complete_status_normalized(self):
        service = HeyGenService(api_key="fake-key")
        cm, fake_client = _fake_httpx_get_client(status_code=200, json_body={"data": {"voice_id": "clone-abc", "status": "complete"}})
        with patch("app.services.heygen_service.httpx.AsyncClient", return_value=cm):
            result = _run(service.get_voice_clone_status("clone-abc"))
        assert result["status"] == "complete"
        call_args, _ = fake_client.get.call_args
        assert call_args[0] == "https://api.heygen.com/v3/voices/clone-abc"

    def test_failed_status_normalized(self):
        service = HeyGenService(api_key="fake-key")
        cm, _ = _fake_httpx_get_client(status_code=200, json_body={"data": {"status": "failed", "failure_message": "bad audio"}})
        with patch("app.services.heygen_service.httpx.AsyncClient", return_value=cm):
            result = _run(service.get_voice_clone_status("clone-abc"))
        assert result["status"] == "failed"
        assert result["failure_message"] == "bad audio"

    def test_processing_status_normalized(self):
        service = HeyGenService(api_key="fake-key")
        cm, _ = _fake_httpx_get_client(status_code=200, json_body={"data": {"status": "processing"}})
        with patch("app.services.heygen_service.httpx.AsyncClient", return_value=cm):
            result = _run(service.get_voice_clone_status("clone-abc"))
        assert result["status"] == "processing"


# --- Router clone-submission helper (routers.voices) ---

class TestSubmitVoiceClone:
    def test_success_path_stores_real_voice_clone_id_and_sets_cloning(self):
        voice = FakeVoice()
        voice.source_audio_blob_name = "voices/PB-DOC-000001/PB-VCE-000001/original.mp3"
        voice.source_content_type = "audio/mpeg"
        db = FakeDB()

        with patch("app.routers.voices.azure_blob_service.download_blob", return_value=_FAKE_MP3_BYTES) as mock_download, \
             patch("app.routers.voices.heygen_service.upload_audio_asset", new=AsyncMock(return_value={"asset_id": "asset-1"})) as mock_upload, \
             patch("app.routers.voices.heygen_service.clone_voice", new=AsyncMock(return_value="real-heygen-voice-clone-id")) as mock_clone:
            _run(voices_router._submit_voice_clone(voice, db))

        mock_download.assert_called_once_with(voice.source_audio_blob_name)
        mock_upload.assert_called_once()
        mock_clone.assert_called_once_with(asset_id="asset-1", voice_name=voice.name, language=voice.language)

        # This is the critical acceptance chain assertion: the value returned by
        # the real cloning API becomes the Voice's provider voice id verbatim —
        # never the PointBlank voice_id, doctor_id, or blob name.
        assert voice.heygen_voice_id == "real-heygen-voice-clone-id"
        assert voice.clone_status == "cloning"
        assert voice.clone_failure_reason is None

    def test_azure_download_failure_sets_failed_status_with_safe_message(self):
        voice = FakeVoice()
        voice.source_audio_blob_name = "voices/PB-DOC-000001/PB-VCE-000001/original.mp3"
        db = FakeDB()

        with patch("app.routers.voices.azure_blob_service.download_blob", side_effect=RuntimeError("azure outage")):
            _run(voices_router._submit_voice_clone(voice, db))

        assert voice.clone_status == "failed"
        assert voice.heygen_voice_id is None
        assert "azure outage" not in voice.clone_failure_reason
        assert voice.clone_failure_reason == "Unable to create the doctor's voice. Please try again."

    def test_clone_api_failure_never_deletes_stored_original_audio(self):
        voice = FakeVoice()
        voice.source_audio_blob_name = "voices/PB-DOC-000001/PB-VCE-000001/original.mp3"
        db = FakeDB()

        with patch("app.routers.voices.azure_blob_service.download_blob", return_value=_FAKE_MP3_BYTES), \
             patch("app.routers.voices.heygen_service.upload_audio_asset", new=AsyncMock(return_value={"asset_id": "asset-1"})), \
             patch("app.routers.voices.heygen_service.clone_voice", new=AsyncMock(side_effect=RuntimeError("INSUFFICIENT_CREDITS: no credits"))):
            _run(voices_router._submit_voice_clone(voice, db))

        assert voice.clone_status == "failed"
        assert voice.source_audio_blob_name == "voices/PB-DOC-000001/PB-VCE-000001/original.mp3"
        assert voice.clone_failure_reason == "Unable to create the doctor's voice right now. Please contact support."

    def test_forbidden_tier_error_maps_to_clean_message(self):
        voice = FakeVoice()
        voice.source_audio_blob_name = "voices/PB-DOC-000001/PB-VCE-000001/original.mp3"
        db = FakeDB()

        with patch("app.routers.voices.azure_blob_service.download_blob", return_value=_FAKE_MP3_BYTES), \
             patch("app.routers.voices.heygen_service.upload_audio_asset", new=AsyncMock(return_value={"asset_id": "asset-1"})), \
             patch("app.routers.voices.heygen_service.clone_voice", new=AsyncMock(side_effect=RuntimeError("VOICE_CLONE_FORBIDDEN: no enterprise tier"))):
            _run(voices_router._submit_voice_clone(voice, db))

        assert voice.clone_status == "failed"
        assert "enterprise" not in voice.clone_failure_reason.lower()
        assert voice.clone_failure_reason == "Voice cloning is not enabled for this account. Please contact support."


class TestAssignDefaultIfNeeded:
    def test_first_ready_voice_becomes_default(self):
        voice = FakeVoice()
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        voices_router._assign_default_if_needed(voice, db)
        assert voice.is_default is True

    def test_does_not_override_existing_default(self):
        voice = FakeVoice()
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = FakeVoice(voice_id="PB-VCE-000002")
        voices_router._assign_default_if_needed(voice, db)
        assert voice.is_default is False


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
