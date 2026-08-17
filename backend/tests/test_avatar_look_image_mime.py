"""
Covers the HeyGen Look Generation image MIME-type bug: uploads were being sent
to HeyGen with a hardcoded Content-Type of image/jpeg regardless of the actual
uploaded file, causing HeyGen's asset upload API to reject PNG/WEBP photos with
"Content type not match image/jpeg != image/png".

_detect_image_content_type (avatar_scenarios.py) fixes this by sniffing the real
format from file bytes (magic numbers), never from filename or client header.

Also covers a second, subtler regression: a follow-up fix over-broadened the
error classifier (`_is_raw_upload_content_type_mismatch`, formerly
`_is_heygen_image_format_error`) to match on HeyGen's generic `invalid_parameter`
error code. Since `generate-look` never uploads the user's own photo bytes (it
only sends base_look_id + a HeyGen-hosted reference-image URL), an unrelated
`invalid_parameter` failure there — e.g. HeyGen's own reference-image URL
tripping its content-type check — was being mislabeled as "please re-upload a
supported image", blaming an image that was already valid and already uploaded
successfully. The classifier is now scoped to the literal mismatch wording only,
and is called exclusively from create_base_avatar (the only step that uploads
raw bytes).

Also covers the actual root cause of that generate-look failure, confirmed by
fetching HeyGen's own public Look Gallery preview assets directly: the "Rafi
Office 18" preset's preview_image_url is served at a .jpg URL with a declared
`Content-Type: image/jpeg` header, but its real bytes are a PNG (magic number
89 50 4E 47). HeyGen's own /v3/avatars validates declared-vs-actual type for
`reference_images` URLs and rejects that mismatch — independent of anything the
user uploaded. `_normalize_reference_image_url` fixes this by re-uploading any
reference image through HeyGen's own asset service with a Content-Type verified
against its real bytes, producing a URL where declared and actual always agree.
"""
import asyncio
import glob
import io
import os
import sys
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.routers.avatar_scenarios import (
    _detect_image_content_type,
    _is_raw_upload_content_type_mismatch,
    _extract_heygen_error_detail,
    _normalize_reference_image_url,
)

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "original_photos")

# Real preview_image_url values pulled from production AvatarScenario.metadata_json
# for this exact bug: the same "Rafi Office 18" URL failed generate-look on every
# occurrence (2/2), while "Kacper Presenter 4" succeeded on every occurrence (2/2).
MISLABELED_LOOK_PREVIEW_URL = "https://resource2.heygen.ai/public-avatars/Rafi/paos/angles/office92_p2_a0.jpg"
GENUINE_JPEG_LOOK_PREVIEW_URL = "https://resource2.heygen.ai/public-avatars/Kacper/lookpack/angles/Presenter_4.jpg"


def _encode(fmt: str) -> bytes:
    img = Image.new("RGB", (32, 32), color=(10, 20, 30))
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


class TestSupportedFormatsDetectedFromRealBytes:
    def test_jpeg(self):
        assert _detect_image_content_type(_encode("JPEG")) == "image/jpeg"

    def test_png(self):
        assert _detect_image_content_type(_encode("PNG")) == "image/png"

    def test_webp(self):
        assert _detect_image_content_type(_encode("WEBP")) == "image/webp"

    def test_png_bytes_are_never_reported_as_jpeg(self):
        """The exact regression: a PNG upload must never be declared image/jpeg."""
        detected = _detect_image_content_type(_encode("PNG"))
        assert detected == "image/png"
        assert detected != "image/jpeg"

    def test_detection_ignores_filename_extension_mismatch(self):
        """
        A file named photo.jpg whose actual bytes are PNG must still be detected
        as image/png — the extension/declared type is never trusted.
        """
        png_bytes_with_jpg_name = _encode("PNG")  # caller would name this "photo.jpg"
        assert _detect_image_content_type(png_bytes_with_jpg_name) == "image/png"


class TestUnsupportedOrInvalidFilesAreRejected:
    def test_gif_is_not_claimed_as_supported(self):
        assert _detect_image_content_type(_encode("GIF")) is None

    def test_bmp_is_not_claimed_as_supported(self):
        assert _detect_image_content_type(_encode("BMP")) is None

    def test_tiff_is_not_claimed_as_supported(self):
        assert _detect_image_content_type(_encode("TIFF")) is None

    def test_non_image_file(self):
        assert _detect_image_content_type(b"%PDF-1.4 not an image") is None

    def test_empty_file(self):
        assert _detect_image_content_type(b"") is None

    def test_corrupted_truncated_header(self):
        real_png = _encode("PNG")
        assert _detect_image_content_type(real_png[:3]) is None


@pytest.mark.skipif(not os.path.isdir(UPLOADS_DIR), reason="no uploads/original_photos directory present")
class TestRealUploadedPngFromTheBugReport:
    """
    Real 1254x1254 PNGs previously saved to disk by upload-photo during the user's
    actual repro of this bug — a direct regression test for that exact file shape,
    not just a synthetic Pillow-encoded one.
    """

    def _real_png_paths(self):
        return sorted(glob.glob(os.path.join(UPLOADS_DIR, "*.png")))

    def test_every_stored_png_is_detected_as_image_png(self):
        paths = self._real_png_paths()
        assert paths, "expected at least one real PNG fixture in uploads/original_photos"
        for path in paths:
            with open(path, "rb") as f:
                data = f.read()
            assert _detect_image_content_type(data) == "image/png", f"{path} was not detected as image/png"


class TestRawUploadContentTypeMismatchClassifier:
    """
    Scoped strictly to create_base_avatar's raw-bytes upload step. Must NOT be
    used to classify generate-look failures (see module docstring) — that's a
    router-level rule, enforced by only calling this from create_base_avatar's
    except block, not generate_look_for_avatar's.
    """

    def test_literal_content_type_mismatch_is_recognized(self):
        msg = 'HeyGen Asset Upload Failed (400): {"code":400543,"message":"Content type not match image/jpeg != image/png"}'
        assert _is_raw_upload_content_type_mismatch(msg) is True

    def test_generic_invalid_parameter_is_no_longer_misclassified(self):
        """
        The exact prior bug: a bare `invalid_parameter` code (HeyGen's generic
        validation error, used for dozens of unrelated reasons) was previously
        enough to trigger "please upload a supported image" — even when the
        actual complaint had nothing to do with image format.
        """
        msg = 'HeyGen Look Generation API Error (400): {"error":{"code":"invalid_parameter","message":"prompt exceeds maximum length"}}'
        assert _is_raw_upload_content_type_mismatch(msg) is False

    def test_unrelated_error_is_not_misclassified(self):
        msg = "HeyGen Look Generation API Error (402): insufficient credits"
        assert _is_raw_upload_content_type_mismatch(msg) is False

    def test_usable_state_error_is_not_misclassified(self):
        msg = "Base avatar avt_123 is not in a usable state"
        assert _is_raw_upload_content_type_mismatch(msg) is False


class TestExtractHeyGenErrorDetail:
    """The real generate-look failure from this bug report, verbatim from prod logs."""

    def test_nested_error_shape_from_generate_look(self):
        msg = (
            'HeyGen Look Generation API Error (400): {"error":{"code":"invalid_parameter",'
            '"doc_url":"https://developers.heygen.com/docs/error-codes#invalid-parameter",'
            '"message":"Content type not match image/jpeg != image/png"}}'
        )
        assert _extract_heygen_error_detail(msg) == "Content type not match image/jpeg != image/png"

    def test_flat_error_shape_from_asset_upload(self):
        msg = 'HeyGen Asset Upload Failed (400): {"code":400543,"message":"Content type not match image/jpeg != image/png"}'
        assert _extract_heygen_error_detail(msg) == "Content type not match image/jpeg != image/png"

    def test_non_json_error_falls_back_to_original_string(self):
        msg = "HeyGen Look Generation API Error (500): Internal Server Error"
        assert _extract_heygen_error_detail(msg) == msg


def _run(coro):
    return asyncio.run(coro)


class TestNormalizeReferenceImageDeterministic:
    """Fully mocked (no live network) — exercises the decision logic in isolation."""

    def test_declares_type_from_real_bytes_not_from_response_header(self):
        """
        The exact defect: a response whose Content-Type header lies (says jpeg)
        must still be re-uploaded declaring the REAL bytes' type (png), because
        our own sniff — not the untrusted upstream header — is authoritative.
        """
        png_bytes = _encode("PNG")
        fake_response = type("R", (), {"status_code": 200, "content": png_bytes})()

        async def fake_get(*args, **kwargs):
            return fake_response

        with patch("app.routers.avatar_scenarios.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=fake_response)
            mock_client_cls.return_value.__aenter__.return_value = mock_client

            with patch(
                "app.routers.avatar_scenarios.heygen_service.upload_asset_bytes",
                new=AsyncMock(return_value={"id": "asset123", "url": "https://upload.heygen.com/asset/normalized123"})
            ) as mock_upload:
                result = _run(_normalize_reference_image_url("https://example.com/mislabeled.jpg"))

        assert result == "https://upload.heygen.com/asset/normalized123"
        _, kwargs = mock_upload.call_args
        assert kwargs["content_type"] == "image/png"

    def test_non_200_response_is_skipped_not_raised(self):
        fake_response = type("R", (), {"status_code": 404, "content": b""})()
        with patch("app.routers.avatar_scenarios.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=fake_response)
            mock_client_cls.return_value.__aenter__.return_value = mock_client
            result = _run(_normalize_reference_image_url("https://example.com/missing.jpg"))
        assert result is None

    def test_undetectable_bytes_are_skipped_not_raised(self):
        fake_response = type("R", (), {"status_code": 200, "content": b"<html>not an image</html>"})()
        with patch("app.routers.avatar_scenarios.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=fake_response)
            mock_client_cls.return_value.__aenter__.return_value = mock_client
            result = _run(_normalize_reference_image_url("https://example.com/notanimage.jpg"))
        assert result is None

    def test_upload_failure_is_skipped_not_raised(self):
        png_bytes = _encode("PNG")
        fake_response = type("R", (), {"status_code": 200, "content": png_bytes})()
        with patch("app.routers.avatar_scenarios.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=fake_response)
            mock_client_cls.return_value.__aenter__.return_value = mock_client
            with patch(
                "app.routers.avatar_scenarios.heygen_service.upload_asset_bytes",
                new=AsyncMock(side_effect=RuntimeError("HeyGen Asset Upload Failed (500): boom"))
            ):
                result = _run(_normalize_reference_image_url("https://example.com/photo.png"))
        assert result is None


class TestNormalizeReferenceImageAgainstRealHeyGenLookAssets:
    """
    Hits the real HeyGen public CDN URLs involved in this bug report (read-only
    GET, no API key needed for public assets). Mocks only the authenticated
    upload_asset_bytes call, since this environment has no live HEYGEN_API_KEY.
    Skips gracefully if outbound network isn't available.
    """

    def _assert_reachable(self, url):
        try:
            httpx.get(url, timeout=10)
        except Exception as exc:
            pytest.skip(f"no outbound network access in this environment: {exc}")

    def test_mislabeled_look_preview_gets_corrected_to_real_png_type(self):
        self._assert_reachable(MISLABELED_LOOK_PREVIEW_URL)
        with patch(
            "app.routers.avatar_scenarios.heygen_service.upload_asset_bytes",
            new=AsyncMock(return_value={"id": "x", "url": "https://upload.heygen.com/asset/normalized-rafi"})
        ) as mock_upload:
            result = _run(_normalize_reference_image_url(MISLABELED_LOOK_PREVIEW_URL))
        assert result == "https://upload.heygen.com/asset/normalized-rafi"
        _, kwargs = mock_upload.call_args
        # The upstream header claims image/jpeg; the real bytes are PNG. We must
        # declare what the bytes actually are, not what the broken header says.
        assert kwargs["content_type"] == "image/png"

    def test_genuine_jpeg_look_preview_is_declared_as_jpeg(self):
        self._assert_reachable(GENUINE_JPEG_LOOK_PREVIEW_URL)
        with patch(
            "app.routers.avatar_scenarios.heygen_service.upload_asset_bytes",
            new=AsyncMock(return_value={"id": "y", "url": "https://upload.heygen.com/asset/normalized-kacper"})
        ) as mock_upload:
            result = _run(_normalize_reference_image_url(GENUINE_JPEG_LOOK_PREVIEW_URL))
        assert result == "https://upload.heygen.com/asset/normalized-kacper"
        _, kwargs = mock_upload.call_args
        assert kwargs["content_type"] == "image/jpeg"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
