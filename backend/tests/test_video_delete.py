"""
Covers app/routers/videos.py::delete_video, and confirms list_videos /
get_video_details exclude soft-deleted rows. Soft delete only ever flips
is_deleted — never touches the Azure blob, HeyGen job history, or an
existing public share.

Scope matches the rest of this suite: no real Postgres — db is a MagicMock,
router functions are called directly with plain Python fakes (Pydantic's
model_validate needs real attribute values, not MagicMock auto-attrs).
"""
import os
import sys
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.routers.videos import delete_video, list_videos, get_video_details


class FakeUser:
    def __init__(self, id="user-1", role="USER"):
        self.id = id
        self.role = role


class FakeVideo:
    def __init__(self, id="vid-1", user_id="user-1", is_deleted=False):
        now = datetime.now(timezone.utc)
        self.id = id
        self.video_id = "PB-VID-000001"
        self.user_id = user_id
        self.doctor_id = "doc-1"
        self.avatar_scenario_id = None
        self.voice_id = None
        self.heygen_video_id = None
        self.avatar_type = "public"
        self.heygen_avatar_id = None
        self.heygen_talking_photo_id = None
        self.heygen_voice_id = "hg-voice-1"
        self.script = "Hello."
        self.settings_json = {}
        self.status = "COMPLETED"
        self.video_url = None
        self.thumbnail_url = None
        self.storage_key = None
        self.azure_blob_name = None
        self.storage_status = "pending"
        self.error_message = None
        self.is_deleted = is_deleted
        self.created_at = now
        self.completed_at = None
        self.doctor = None
        self.avatar_scenario = None
        self.saved_voice = None


def _mock_first(db, result):
    db.query.return_value.filter.return_value.first.return_value = result


class TestDeleteVideo:
    def test_404_when_not_found(self):
        db = MagicMock()
        _mock_first(db, None)
        with pytest.raises(HTTPException) as exc_info:
            delete_video("missing-id", db=db, current_user=FakeUser())
        assert exc_info.value.status_code == 404

    def test_403_when_not_owner(self):
        video = FakeVideo(user_id="other-user")
        db = MagicMock()
        _mock_first(db, video)
        with pytest.raises(HTTPException) as exc_info:
            delete_video(video.id, db=db, current_user=FakeUser(id="user-1", role="USER"))
        assert exc_info.value.status_code == 403
        assert video.is_deleted is False  # never flipped on a rejected request

    def test_owner_can_delete_soft_deletes_and_commits(self):
        video = FakeVideo(user_id="user-1", is_deleted=False)
        db = MagicMock()
        _mock_first(db, video)

        result = delete_video(video.id, db=db, current_user=FakeUser(id="user-1", role="USER"))

        assert result is None
        assert video.is_deleted is True  # soft delete — flag flipped, not removed
        db.commit.assert_called_once()

    def test_admin_can_delete_any_users_video(self):
        video = FakeVideo(user_id="someone-else")
        db = MagicMock()
        _mock_first(db, video)

        delete_video(video.id, db=db, current_user=FakeUser(id="admin-1", role="ADMIN"))
        assert video.is_deleted is True

    def test_query_scopes_out_already_deleted_rows(self):
        """The lookup query itself must filter is_deleted == False, so a second
        delete attempt on an already-deleted video 404s rather than re-flipping it."""
        db = MagicMock()
        _mock_first(db, None)  # simulates the real query excluding the deleted row

        with pytest.raises(HTTPException) as exc_info:
            delete_video("already-deleted-id", db=db, current_user=FakeUser())
        assert exc_info.value.status_code == 404

        filter_args = db.query.return_value.filter.call_args[0]
        assert any("is_deleted" in str(arg) for arg in filter_args)


class TestListAndDetailExcludeDeleted:
    def test_list_videos_filters_on_is_deleted(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []

        list_videos(doctor_id=None, db=db, current_user=FakeUser(role="ADMIN"))

        filter_args = db.query.return_value.filter.call_args[0]
        assert any("is_deleted" in str(arg) for arg in filter_args)

    def test_get_video_details_404_for_deleted_video(self):
        db = MagicMock()
        _mock_first(db, None)  # a deleted video's row never matches the is_deleted==False filter

        with pytest.raises(HTTPException) as exc_info:
            get_video_details("some-id", db=db, current_user=FakeUser())
        assert exc_info.value.status_code == 404

        filter_args = db.query.return_value.filter.call_args[0]
        assert any("is_deleted" in str(arg) for arg in filter_args)


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
