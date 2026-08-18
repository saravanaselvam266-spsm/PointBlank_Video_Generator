"""
Covers app/routers/doctors.py:
  - _counts_for_doctor_ids — the batched aggregate-COUNT replacement for the
    old `len(doc.videos)`-per-doctor-in-a-loop N+1 pattern. Must issue exactly
    one grouped COUNT query per media type for the WHOLE batch of doctor_ids,
    never one query per doctor.
  - get_doctor / get_doctor_profile — ownership enforcement (404/403) and the
    combined Doctor Profile response (doctor + avatars + voices + recent
    videos in one call, media URLs resolved via the shared media_resolve
    helpers rather than persisted).

Scope: no real Postgres, no real Azure — db is a MagicMock, media_resolve
functions are patched to canned SAS-like strings.
"""
import os
import sys
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.routers.doctors import (
    _counts_for_doctor_ids,
    _apply_counts,
    get_doctor,
    get_doctor_profile,
)
from app.schemas import DoctorResponse
from app.models import DoctorProfile, AvatarScenario, Voice, Video


class FakeUser:
    def __init__(self, id="user-1", role="USER"):
        self.id = id
        self.role = role


class FakeDoctor:
    def __init__(self, id="doc-1", user_id="user-1"):
        self.id = id
        self.doctor_id = "PB-DOC-000001"
        self.user_id = user_id
        self.doctor_name = "Dr. Vance"
        self.specialization = "Cardiology"
        self.photo_url = None
        self.avatar_type = "public"
        self.heygen_avatar_id = None
        self.heygen_talking_photo_id = None
        self.heygen_voice_id = None
        from datetime import datetime, timezone
        self.created_at = datetime.now(timezone.utc)


def _mock_grouped_query_chain(db, rows_sequence):
    """
    Makes db.query(...).filter(...).group_by(...).all() return the next
    canned rows list from rows_sequence on each successive call — mirrors the
    exact chain shape used in _counts_for_doctor_ids.
    """
    chain = MagicMock()
    chain.filter.return_value.group_by.return_value.all.side_effect = rows_sequence
    db.query.return_value = chain
    return chain


class TestCountsForDoctorIdsIsBatched:
    def test_empty_doctor_ids_short_circuits_without_querying(self):
        db = MagicMock()
        result = _counts_for_doctor_ids(db, [])
        assert result == {}
        db.query.assert_not_called()

    def test_issues_exactly_one_grouped_query_per_media_type_regardless_of_doctor_count(self):
        doctor_ids = [f"doc-{i}" for i in range(50)]  # a large batch — must NOT scale query count
        db = MagicMock()
        _mock_grouped_query_chain(db, [
            [("doc-0", 3), ("doc-1", 1)],   # avatar_scenarios grouped rows
            [("doc-0", 2)],                  # voices grouped rows
            [("doc-1", 5)],                  # videos grouped rows
        ])

        counts = _counts_for_doctor_ids(db, doctor_ids)

        # Exactly 3 db.query(...) calls total for 50 doctors — the whole point of the fix.
        assert db.query.call_count == 3
        assert counts["doc-0"] == {"scenario_count": 3, "voice_count": 2, "video_count": 0}
        assert counts["doc-1"] == {"scenario_count": 1, "voice_count": 0, "video_count": 5}
        assert counts["doc-49"] == {"scenario_count": 0, "voice_count": 0, "video_count": 0}

    def test_apply_counts_defaults_to_zero_for_unknown_doctor(self):
        res = DoctorResponse(
            id="x", doctor_id="PB-DOC-000001", user_id="u", doctor_name="Dr. X",
            specialization="Derm", avatar_type="public", created_at=__import__("datetime").datetime.now(),
        )
        out = _apply_counts(res, "missing-doc-id", {})
        assert out.scenario_count == 0
        assert out.voice_count == 0
        assert out.video_count == 0


class TestGetDoctorOwnership:
    def test_404_when_doctor_not_found(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc_info:
            get_doctor("missing-id", db=db, current_user=FakeUser())
        assert exc_info.value.status_code == 404

    def test_403_when_not_owner_and_not_admin(self):
        doctor = FakeDoctor(user_id="other-user")
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = doctor
        with pytest.raises(HTTPException) as exc_info:
            get_doctor(doctor.id, db=db, current_user=FakeUser(id="user-1", role="USER"))
        assert exc_info.value.status_code == 403

    def test_admin_can_access_any_doctor(self):
        doctor = FakeDoctor(user_id="someone-else")
        db = MagicMock()
        chain = _mock_grouped_query_chain(db, [[], [], []])
        chain.filter.return_value.first.return_value = doctor
        res = get_doctor(doctor.id, db=db, current_user=FakeUser(id="admin-1", role="ADMIN"))
        assert res.doctor_id == "PB-DOC-000001"


class TestGetDoctorProfile:
    def test_404_when_doctor_not_found(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc_info:
            get_doctor_profile("missing-id", db=db, current_user=FakeUser())
        assert exc_info.value.status_code == 404

    def test_403_when_not_owner(self):
        doctor = FakeDoctor(user_id="other-user")
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = doctor
        with pytest.raises(HTTPException) as exc_info:
            get_doctor_profile(doctor.id, db=db, current_user=FakeUser(id="user-1", role="USER"))
        assert exc_info.value.status_code == 403

    def test_returns_combined_doctor_avatars_voices_videos_with_resolved_urls(self):
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        doctor = FakeDoctor(user_id="user-1")

        class FakeScenario:
            id = "sc-1"
            avatar_scenario_id = "PB-AVT-000001"
            user_id = "user-1"
            doctor_id = doctor.id
            look_id = None
            name = "Dr. Vance — Clinic"
            avatar_type = "photo"
            photo_url = None
            original_photo_url = None
            prepared_photo_url = None
            background_type = "color"
            background_value = "#FAFAFA"
            position = "center"
            scale = "1.0"
            framing = "medium"
            aspect_ratio = "16:9"
            heygen_base_look_id = None
            heygen_look_id = None
            heygen_avatar_id = None
            heygen_talking_photo_id = None
            heygen_avatar_group_id = None
            heygen_preview_image_url = None
            creation_status = "READY"
            creation_error = None
            provider_status = "unknown"
            metadata_json = None
            is_deleted = False
            created_at = now
            updated_at = now
            look = None

        class FakeVoice:
            id = "vce-1"
            voice_id = "PB-VCE-000001"
            user_id = "user-1"
            doctor_id = doctor.id
            name = "Dr. Vance Voice"
            voice_type = "cloned"
            heygen_voice_id = "hg-voice-1"
            language = "English"
            gender = None
            accent = None
            preview_url = None
            source_metadata_json = None
            is_deleted = False
            azure_blob_name = None
            voice_storage_status = "pending"
            clone_status = "ready"
            clone_failure_reason = None
            is_default = True
            created_at = now
            updated_at = now

        class FakeVideoRecord:
            id = "vid-1"
            video_id = "PB-VID-000001"
            user_id = "user-1"
            doctor_id = doctor.id
            avatar_scenario_id = None
            voice_id = None
            heygen_video_id = None
            avatar_type = "photo"
            heygen_avatar_id = None
            heygen_talking_photo_id = None
            heygen_voice_id = "hg-voice-1"
            script = "Hello."
            settings_json = {}
            status = "COMPLETED"
            video_url = None
            thumbnail_url = None
            storage_key = None
            azure_blob_name = "videos/PB-DOC-000001/PB-VID-000001.mp4"
            storage_status = "uploaded"
            error_message = None
            created_at = now
            completed_at = now
            avatar_scenario = None
            saved_voice = None

        fake_scenario = FakeScenario()
        fake_voice = FakeVoice()
        fake_video = FakeVideoRecord()

        db = MagicMock()

        def query_side_effect(*args, **kwargs):
            model = args[0]
            chain = MagicMock()
            if model is DoctorProfile:
                chain.filter.return_value.first.return_value = doctor
            elif model is AvatarScenario:
                chain.filter.return_value.order_by.return_value.all.return_value = [fake_scenario]
            elif model is Voice:
                chain.filter.return_value.order_by.return_value.all.return_value = [fake_voice]
            elif model is Video:
                chain.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [fake_video]
            else:
                # Not a bare model class — this is one of _counts_for_doctor_ids'
                # `db.query(Model.doctor_id, func.count(Model.id))` aggregate calls.
                chain.filter.return_value.group_by.return_value.all.return_value = []
            return chain

        db.query.side_effect = query_side_effect

        with patch("app.routers.doctors.resolve_avatar_photo_url", return_value="https://blob.core.windows.net/avatar.png?sig=x"):
            with patch("app.routers.doctors.resolve_avatar_thumbnail_url", return_value="https://blob.core.windows.net/avatar-thumb.png?sig=x"):
                with patch("app.routers.doctors.resolve_voice_preview_url", return_value="https://blob.core.windows.net/voice.mp3?sig=x"):
                    with patch("app.routers.doctors.resolve_voice_source_preview_url", return_value=None):
                        with patch("app.routers.doctors.resolve_video_playback_url", return_value="https://blob.core.windows.net/video.mp4?sig=x"):
                            with patch("app.routers.doctors.resolve_video_thumbnail_url", return_value="https://blob.core.windows.net/video-thumb.jpg?sig=x"):
                                profile = get_doctor_profile(doctor.id, db=db, current_user=FakeUser(id="user-1"))

        assert profile.doctor.doctor_id == "PB-DOC-000001"
        assert len(profile.avatars) == 1
        assert profile.avatars[0].photo_url == "https://blob.core.windows.net/avatar.png?sig=x"
        assert len(profile.voices) == 1
        assert profile.voices[0].preview_url == "https://blob.core.windows.net/voice.mp3?sig=x"
        assert len(profile.recent_videos) == 1
        assert profile.recent_videos[0].video_url == "https://blob.core.windows.net/video.mp4?sig=x"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
