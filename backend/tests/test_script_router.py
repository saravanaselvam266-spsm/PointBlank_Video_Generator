"""
Covers app/routers/script.py — the two script-generation endpoints
(POST /api/v1/videos/script/from-document, POST /api/v1/videos/script/generate).

Uses FastAPI's TestClient against the real app with get_current_user
overridden (no real auth/DB) and azure_openai_service mocked (no real Azure
OpenAI call — that path was verified live separately). Confirms: auth is
required, validation errors are clean, and every Azure OpenAI failure mode
maps to the SAME generic user-facing message (never a raw provider error).
"""
import os
import sys
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.dependencies.auth import get_current_user


class FakeUser:
    id = "user-1"
    role = "USER"


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: FakeUser()
    yield TestClient(app)
    app.dependency_overrides.pop(get_current_user, None)


class TestGenerateFromScenario:
    def test_requires_authentication(self):
        app.dependency_overrides.pop(get_current_user, None)
        raw_client = TestClient(app)
        res = raw_client.post("/api/v1/videos/script/generate", json={"scenario": "Explain hydration"})
        assert res.status_code == 401

    def test_empty_scenario_rejected(self, client):
        res = client.post("/api/v1/videos/script/generate", json={"scenario": "   "})
        assert res.status_code == 400
        assert "describe" in res.json()["detail"].lower()

    def test_success_returns_script_and_source_type(self, client):
        with patch("app.routers.script.azure_openai_service.generate_script_from_scenario", new=AsyncMock(return_value="Stay hydrated.")):
            res = client.post("/api/v1/videos/script/generate", json={"scenario": "Explain hydration", "tone": "friendly", "length": "short", "language": "English"})
        assert res.status_code == 200
        body = res.json()
        assert body["script"] == "Stay hydrated."
        assert body["source_type"] == "ai"

    def test_azure_openai_failure_returns_clean_generic_message(self, client):
        with patch("app.routers.script.azure_openai_service.generate_script_from_scenario", new=AsyncMock(side_effect=RuntimeError("AZURE_OPENAI_AUTH_ERROR"))):
            res = client.post("/api/v1/videos/script/generate", json={"scenario": "Explain hydration"})
        assert res.status_code == 503
        detail = res.json()["detail"]
        assert detail == "Script generation is temporarily unavailable. Please try again."
        assert "azure" not in detail.lower()
        assert "openai" not in detail.lower()

    def test_not_configured_returns_same_clean_message(self, client):
        with patch("app.routers.script.azure_openai_service.generate_script_from_scenario", new=AsyncMock(side_effect=RuntimeError("AZURE_OPENAI_NOT_CONFIGURED"))):
            res = client.post("/api/v1/videos/script/generate", json={"scenario": "Explain hydration"})
        assert res.status_code == 503
        assert res.json()["detail"] == "Script generation is temporarily unavailable. Please try again."


class TestGenerateFromDocument:
    def test_requires_authentication(self):
        app.dependency_overrides.pop(get_current_user, None)
        raw_client = TestClient(app)
        res = raw_client.post("/api/v1/videos/script/from-document", files={"file": ("notes.txt", b"hello", "text/plain")})
        assert res.status_code == 401

    def test_unsupported_file_type_returns_400_clean_message(self, client):
        res = client.post("/api/v1/videos/script/from-document", files={"file": ("image.png", b"\x89PNG\r\n", "image/png")})
        assert res.status_code == 400
        assert "unsupported file type" in res.json()["detail"].lower()

    def test_empty_file_returns_400_clean_message(self, client):
        res = client.post("/api/v1/videos/script/from-document", files={"file": ("notes.txt", b"", "text/plain")})
        assert res.status_code == 400
        assert "empty" in res.json()["detail"].lower()

    def test_success_extracts_and_generates_script(self, client):
        content = b"Patients should monitor their blood pressure weekly and report any concerns to their physician."
        with patch("app.routers.script.azure_openai_service.generate_script_from_document", new=AsyncMock(return_value="Please check your blood pressure every week.")):
            res = client.post("/api/v1/videos/script/from-document", files={"file": ("notes.txt", content, "text/plain")})
        assert res.status_code == 200
        body = res.json()
        assert body["script"] == "Please check your blood pressure every week."
        assert body["source_type"] == "document"

    def test_azure_openai_failure_after_successful_extraction_returns_clean_message(self, client):
        content = b"Patients should monitor their blood pressure weekly and report any concerns to their physician."
        with patch("app.routers.script.azure_openai_service.generate_script_from_document", new=AsyncMock(side_effect=RuntimeError("AZURE_OPENAI_EMPTY_RESPONSE"))):
            res = client.post("/api/v1/videos/script/from-document", files={"file": ("notes.txt", content, "text/plain")})
        assert res.status_code == 503
        assert res.json()["detail"] == "Script generation is temporarily unavailable. Please try again."


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
