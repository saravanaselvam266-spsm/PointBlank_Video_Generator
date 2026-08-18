"""
Covers app/routers/videos.py::_check_avatar_provider_availability — the
ground-truth avatar-existence check run immediately before video generation.

Root cause this replaces: the previous check verified membership in a
general "live catalog" list (GET /v2/avatars + GET /v3/avatars). For
self-created Photo Avatar "looks", GET /v3/avatars was observed returning
only ~20 entries account-wide — nowhere near exhaustive — so a real, still
generatable photo avatar could false-negative if it wasn't in that partial
list, AND (separately, confirmed live against the real HeyGen account) a
genuinely provider-deleted avatar would also correctly fail either way.
Photo avatars are now checked via the same dedicated per-resource lookup
HeyGen itself uses during creation-status polling (GET /v3/avatars/looks/{id}),
which is authoritative regardless of any listing/pagination gaps.

Scope matches the rest of this suite: no real network call — heygen_service
methods are mocked throughout.
"""
import asyncio
import os
import sys
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.routers import videos as videos_router


def _run(coro):
    return asyncio.run(coro)


class TestPhotoAvatarAvailability:
    def test_available_when_look_status_lookup_succeeds(self):
        with patch("app.routers.videos.heygen_service.get_avatar_look_status", new=AsyncMock(return_value={"status": "completed"})) as mock_lookup:
            result = _run(videos_router._check_avatar_provider_availability("real-look-id-123", is_photo=True))
        assert result is True
        mock_lookup.assert_called_once_with("real-look-id-123")

    def test_unavailable_when_look_status_lookup_raises_404(self):
        """This is the exact real-world failure confirmed live: HeyGen returns
        'Avatar group {id} not found' for a deleted/expired photo avatar."""
        with patch(
            "app.routers.videos.heygen_service.get_avatar_look_status",
            new=AsyncMock(side_effect=RuntimeError('HeyGen Look Status Error (404): {"error":{"code":"avatar_not_found"}}')),
        ):
            result = _run(videos_router._check_avatar_provider_availability("deleted-look-id", is_photo=True))
        assert result is False

    def test_never_falls_back_to_general_catalog_for_photo_avatars(self):
        """A photo avatar's availability must never be decided by general
        catalog membership — only the per-resource lookup matters."""
        with patch("app.routers.videos.heygen_service.get_avatar_look_status", new=AsyncMock(return_value={})):
            with patch("app.routers.videos.heygen_service.get_avatars", new=AsyncMock(side_effect=AssertionError("should not be called"))):
                result = _run(videos_router._check_avatar_provider_availability("some-look-id", is_photo=True))
        assert result is True


class TestPublicAvatarAvailability:
    def test_available_when_present_in_v2_avatars(self):
        v2_response = {"avatars": [{"avatar_id": "Abigail_expressive_2024112501"}], "talking_photos": []}
        with patch("app.routers.videos.heygen_service.get_avatars", new=AsyncMock(return_value=v2_response)):
            with patch("app.routers.videos.heygen_service.get_avatars_v3", new=AsyncMock(return_value=[])):
                result = _run(videos_router._check_avatar_provider_availability("Abigail_expressive_2024112501", is_photo=False))
        assert result is True

    def test_available_when_present_in_v2_talking_photos(self):
        v2_response = {"avatars": [], "talking_photos": [{"talking_photo_id": "tp_real_123"}]}
        with patch("app.routers.videos.heygen_service.get_avatars", new=AsyncMock(return_value=v2_response)):
            with patch("app.routers.videos.heygen_service.get_avatars_v3", new=AsyncMock(return_value=[])):
                result = _run(videos_router._check_avatar_provider_availability("tp_real_123", is_photo=False))
        assert result is True

    def test_unavailable_when_absent_from_non_empty_catalog(self):
        v2_response = {"avatars": [{"avatar_id": "SomeoneElse_avatar"}], "talking_photos": []}
        with patch("app.routers.videos.heygen_service.get_avatars", new=AsyncMock(return_value=v2_response)):
            with patch("app.routers.videos.heygen_service.get_avatars_v3", new=AsyncMock(return_value=[])):
                result = _run(videos_router._check_avatar_provider_availability("nonexistent_avatar_id", is_photo=False))
        assert result is False

    def test_fails_open_when_catalog_fetch_raises(self):
        """Never block video generation just because OUR OWN catalog fetch failed."""
        with patch("app.routers.videos.heygen_service.get_avatars", new=AsyncMock(side_effect=RuntimeError("network down"))):
            result = _run(videos_router._check_avatar_provider_availability("some_avatar_id", is_photo=False))
        assert result is True

    def test_fails_open_when_catalog_is_empty(self):
        with patch("app.routers.videos.heygen_service.get_avatars", new=AsyncMock(return_value={"avatars": [], "talking_photos": []})):
            with patch("app.routers.videos.heygen_service.get_avatars_v3", new=AsyncMock(return_value=[])):
                result = _run(videos_router._check_avatar_provider_availability("some_avatar_id", is_photo=False))
        assert result is True

    def test_v3_fetch_failure_does_not_break_v2_based_result(self):
        v2_response = {"avatars": [{"avatar_id": "Abigail_expressive_2024112501"}], "talking_photos": []}
        with patch("app.routers.videos.heygen_service.get_avatars", new=AsyncMock(return_value=v2_response)):
            with patch("app.routers.videos.heygen_service.get_avatars_v3", new=AsyncMock(side_effect=RuntimeError("v3 down"))):
                result = _run(videos_router._check_avatar_provider_availability("Abigail_expressive_2024112501", is_photo=False))
        assert result is True


class TestAvatarSelectionDoesNotCrossContaminate:
    """Regression for 'avatar selection changes -> new selected avatar ID reaches backend'."""

    def test_two_different_scenarios_each_check_their_own_exact_id(self):
        calls = []

        async def fake_lookup(avatar_id):
            calls.append(avatar_id)
            if avatar_id == "scenario-a-look-id":
                return {"status": "completed"}
            raise RuntimeError('HeyGen Look Status Error (404): not found')

        with patch("app.routers.videos.heygen_service.get_avatar_look_status", new=AsyncMock(side_effect=fake_lookup)):
            result_a = _run(videos_router._check_avatar_provider_availability("scenario-a-look-id", is_photo=True))
            result_b = _run(videos_router._check_avatar_provider_availability("scenario-b-look-id", is_photo=True))

        assert calls == ["scenario-a-look-id", "scenario-b-look-id"]
        assert result_a is True
        assert result_b is False


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
