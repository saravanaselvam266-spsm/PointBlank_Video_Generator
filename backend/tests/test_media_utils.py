"""
Covers app/services/media_utils.py — the shared, provider-agnostic content-type
sniffing used by every Azure mirror call site (doctor photo, final avatar,
voice preview, QR). Pure functions, no network/Azure/DB access.
"""
import io
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.media_utils import (
    sniff_image_content_type,
    sniff_audio_content_type,
    extension_for_content_type,
)


def _encode_image(fmt: str) -> bytes:
    img = Image.new("RGB", (16, 16), color=(1, 2, 3))
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


class TestSniffImageContentType:
    def test_jpeg(self):
        assert sniff_image_content_type(_encode_image("JPEG")) == "image/jpeg"

    def test_png(self):
        assert sniff_image_content_type(_encode_image("PNG")) == "image/png"

    def test_webp(self):
        assert sniff_image_content_type(_encode_image("WEBP")) == "image/webp"

    def test_unrecognized_format_returns_none(self):
        assert sniff_image_content_type(_encode_image("GIF")) is None

    def test_empty_bytes_returns_none(self):
        assert sniff_image_content_type(b"") is None

    def test_never_trusts_extension_only_bytes(self):
        """A PNG's real bytes must be detected as png even if a caller intended to name it .jpg."""
        png_bytes = _encode_image("PNG")
        assert sniff_image_content_type(png_bytes) == "image/png"
        assert sniff_image_content_type(png_bytes) != "image/jpeg"


class TestSniffAudioContentType:
    def test_mp3_with_id3_header(self):
        assert sniff_audio_content_type(b"ID3\x03\x00\x00\x00" + b"\x00" * 20) == "audio/mpeg"

    def test_mp3_with_frame_sync_header(self):
        assert sniff_audio_content_type(b"\xff\xfb\x90\x00" + b"\x00" * 20) == "audio/mpeg"

    def test_wav(self):
        data = b"RIFF" + b"\x00\x00\x00\x00" + b"WAVE" + b"\x00" * 20
        assert sniff_audio_content_type(data) == "audio/wav"

    def test_ogg(self):
        assert sniff_audio_content_type(b"OggS" + b"\x00" * 20) == "audio/ogg"

    def test_m4a(self):
        data = b"\x00\x00\x00\x18ftypM4A " + b"\x00" * 20
        assert sniff_audio_content_type(data) == "audio/mp4"

    def test_unrecognized_bytes_returns_none(self):
        assert sniff_audio_content_type(b"not audio at all, just text padding here") is None

    def test_empty_bytes_returns_none(self):
        assert sniff_audio_content_type(b"") is None

    def test_image_bytes_are_not_misdetected_as_audio(self):
        assert sniff_audio_content_type(_encode_image("PNG")) is None


class TestExtensionForContentType:
    def test_known_image_types(self):
        assert extension_for_content_type("image/jpeg") == "jpg"
        assert extension_for_content_type("image/png") == "png"
        assert extension_for_content_type("image/webp") == "webp"

    def test_known_audio_types(self):
        assert extension_for_content_type("audio/mpeg") == "mp3"
        assert extension_for_content_type("audio/wav") == "wav"

    def test_known_video_type(self):
        assert extension_for_content_type("video/mp4") == "mp4"

    def test_unknown_type_uses_fallback(self):
        assert extension_for_content_type("application/unknown", fallback="dat") == "dat"

    def test_none_type_uses_default_fallback(self):
        assert extension_for_content_type(None) == "bin"
