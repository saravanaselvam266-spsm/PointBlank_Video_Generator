"""
Covers app/services/azure_openai_service.py — error-mapping and prompt
construction for the script-generation service. No real Azure OpenAI calls;
the underlying AzureOpenAI client's chat.completions.create is mocked, since
this suite tests OUR error-handling contract, not the provider itself (that
was verified live separately).
"""
import os
import sys
from unittest.mock import MagicMock, AsyncMock, patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.azure_openai_service import AzureOpenAIService
from openai import AuthenticationError, APIConnectionError


def _run(coro):
    import asyncio
    return asyncio.run(coro)


def _fake_response(text):
    resp = MagicMock()
    resp.choices = [MagicMock(message=MagicMock(content=text))]
    return resp


class TestIsConfigured:
    def test_false_when_endpoint_missing(self):
        svc = AzureOpenAIService()
        with patch("app.services.azure_openai_service.settings") as mock_settings:
            mock_settings.AZURE_OPENAI_ENDPOINT = ""
            mock_settings.AZURE_OPENAI_DEPLOYMENT_NAME = "gpt-5.4"
            assert svc.is_configured() is False

    def test_true_when_both_set(self):
        svc = AzureOpenAIService()
        with patch("app.services.azure_openai_service.settings") as mock_settings:
            mock_settings.AZURE_OPENAI_ENDPOINT = "https://example.cognitiveservices.azure.com/"
            mock_settings.AZURE_OPENAI_DEPLOYMENT_NAME = "gpt-5.4"
            assert svc.is_configured() is True


class TestGenerateScriptFromScenario:
    def test_not_configured_raises_clean_error_code(self):
        svc = AzureOpenAIService()
        with patch.object(svc, "is_configured", return_value=False):
            with pytest.raises(RuntimeError, match="AZURE_OPENAI_NOT_CONFIGURED"):
                _run(svc.generate_script_from_scenario("Explain hydration", "professional", "short", "English"))

    def test_success_returns_generated_text(self):
        svc = AzureOpenAIService()
        with patch.object(svc, "is_configured", return_value=True):
            with patch.object(svc, "_complete_sync", return_value="Stay hydrated for better health.") as mock_complete:
                script = _run(svc.generate_script_from_scenario("Explain hydration", "friendly", "short", "English"))
        assert script == "Stay hydrated for better health."
        mock_complete.assert_called_once()
        prompt_sent = mock_complete.call_args[0][0]
        assert "Explain hydration" in prompt_sent
        assert "friendly" in prompt_sent

    def test_authentication_error_maps_to_auth_error_code_after_exhausting_retries(self):
        """AuthenticationError is retried (transient on this resource, proven empirically) — only raises after every attempt fails."""
        svc = AzureOpenAIService()
        fake_response = MagicMock(status_code=401, headers={}, request=MagicMock())
        with patch.object(svc, "is_configured", return_value=True):
            with patch.object(svc, "_complete_sync", side_effect=AuthenticationError("denied", response=fake_response, body=None)) as mock_complete:
                with patch("app.services.azure_openai_service.asyncio.sleep", new=AsyncMock()):
                    with pytest.raises(RuntimeError, match="AZURE_OPENAI_AUTH_ERROR"):
                        _run(svc.generate_script_from_scenario("topic", "professional", "short", "English"))
        assert mock_complete.call_count == 3  # exhausted all retry attempts

    def test_authentication_error_recovers_on_retry(self):
        """Confirms a transient 401-then-200 pattern (observed live against the real resource) succeeds without surfacing an error."""
        svc = AzureOpenAIService()
        fake_response = MagicMock(status_code=401, headers={}, request=MagicMock())
        with patch.object(svc, "is_configured", return_value=True):
            with patch.object(
                svc, "_complete_sync",
                side_effect=[AuthenticationError("denied", response=fake_response, body=None), "Recovered script text."],
            ) as mock_complete:
                with patch("app.services.azure_openai_service.asyncio.sleep", new=AsyncMock()):
                    script = _run(svc.generate_script_from_scenario("topic", "professional", "short", "English"))
        assert script == "Recovered script text."
        assert mock_complete.call_count == 2

    def test_connection_error_maps_to_unavailable_code(self):
        svc = AzureOpenAIService()
        with patch.object(svc, "is_configured", return_value=True):
            with patch.object(svc, "_complete_sync", side_effect=APIConnectionError(request=MagicMock())):
                with pytest.raises(RuntimeError, match="AZURE_OPENAI_UNAVAILABLE"):
                    _run(svc.generate_script_from_scenario("topic", "professional", "short", "English"))

    def test_empty_response_maps_to_empty_response_code(self):
        svc = AzureOpenAIService()
        with patch.object(svc, "is_configured", return_value=True):
            with patch.object(svc, "_complete_sync", return_value=""):
                with pytest.raises(RuntimeError, match="AZURE_OPENAI_EMPTY_RESPONSE"):
                    _run(svc.generate_script_from_scenario("topic", "professional", "short", "English"))


class TestGenerateScriptFromDocument:
    def test_prompt_includes_source_text_and_no_fact_invention_instruction(self):
        svc = AzureOpenAIService()
        with patch.object(svc, "is_configured", return_value=True):
            with patch.object(svc, "_complete_sync", return_value="Rewritten script.") as mock_complete:
                script = _run(svc.generate_script_from_document("Patients should monitor blood pressure weekly."))
        assert script == "Rewritten script."
        prompt_sent = mock_complete.call_args[0][0]
        assert "blood pressure weekly" in prompt_sent
        assert "SOURCE OF TRUTH" in prompt_sent


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
