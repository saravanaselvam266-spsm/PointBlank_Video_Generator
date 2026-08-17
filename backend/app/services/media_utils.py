"""
Shared, provider-agnostic media detection helpers.

Every Azure mirroring call site (doctor photo, final avatar, voice preview,
QR code) must name its blob with the REAL content type of the bytes it is
about to upload — never a filename extension or an upstream Content-Type
header, both of which have been observed to lie (see
avatar_scenarios._normalize_reference_image_url). These are pure functions,
no network/Azure/DB access, safe to import from any router or service.
"""
from typing import Optional

_IMAGE_EXTENSION_BY_TYPE = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

_AUDIO_EXTENSION_BY_TYPE = {
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
}

_VIDEO_EXTENSION_BY_TYPE = {
    "video/mp4": "mp4",
}

_EXTENSION_BY_TYPE = {**_IMAGE_EXTENSION_BY_TYPE, **_AUDIO_EXTENSION_BY_TYPE, **_VIDEO_EXTENSION_BY_TYPE}


def sniff_image_content_type(data: bytes) -> Optional[str]:
    """
    Determines the REAL image MIME type from magic-number signatures. Returns
    None if the bytes don't match a supported format (JPEG/PNG/WEBP) — callers
    must treat that as "not a usable image", never guess a default.
    """
    if not data:
        return None
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def sniff_audio_content_type(data: bytes) -> Optional[str]:
    """
    Determines the REAL audio MIME type from magic-number signatures. Covers
    the formats HeyGen's voice preview samples and common recorded/uploaded
    audio use. Returns None if unrecognized.
    """
    if not data:
        return None
    if data[:3] == b"ID3" or data[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return "audio/mpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return "audio/wav"
    if data[:4] == b"OggS":
        return "audio/ogg"
    if data[4:8] == b"ftyp":
        return "audio/mp4"
    return None


def extension_for_content_type(content_type: Optional[str], fallback: str = "bin") -> str:
    """Maps a known MIME type to its file extension. Never guesses from a URL/filename."""
    if not content_type:
        return fallback
    return _EXTENSION_BY_TYPE.get(content_type, fallback)
