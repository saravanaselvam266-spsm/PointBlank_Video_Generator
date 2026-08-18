import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import AzureOpenAI, AuthenticationError, APIError, APIConnectionError, APITimeoutError

from app.config import settings

logger = logging.getLogger(__name__)

COGNITIVE_SERVICES_SCOPE = "https://cognitiveservices.azure.com/.default"


def _endpoint_hostname() -> str:
    """Hostname only, for diagnostic logs — never the full URL/query, never a token."""
    try:
        return urlparse(settings.AZURE_OPENAI_ENDPOINT).hostname or "(unset)"
    except Exception:
        return "(unparseable)"

SYSTEM_PROMPT = """You are a script writer for PointBlank, a platform that produces short spoken-narration \
videos of real doctors talking directly to patients. You write ONLY the words the doctor will say out loud.

Rules for every script you write:
- Write natural, conversational spoken language — the way a doctor actually talks to a patient, not an \
article or a slide deck.
- Be professional, clear, and concise. Prefer short sentences a narrator can deliver smoothly.
- Do NOT use markdown, bullet points, or headings unless the user explicitly asked for a structured format.
- Do NOT add citations, references, or source markers unless the source material itself requires attribution.
- Do NOT add a title, label, or preamble like "Video Script:" — output only the spoken narration itself.
- You are not a medical authority. Never invent medical facts, diagnoses, dosages, or claims that are not \
already present in the material you were given.
- If the input describes a topic in general terms, keep the script at that same general, safe level of \
detail rather than fabricating specifics.
"""

DOCUMENT_PROMPT_TEMPLATE = """The following text was extracted from a document uploaded by a doctor's team. \
Treat it as the SOURCE OF TRUTH. Rewrite/summarize it into a natural spoken video script a doctor would say \
directly to a patient.

Do not invent medical facts, statistics, or claims that are not present in the source text below. Preserve \
any important qualifications, warnings, or safety notes from the source material — do not silently drop them.

Do not simply copy the document verbatim — transform it into something that sounds natural when spoken aloud.

--- SOURCE DOCUMENT TEXT ---
{source_text}
--- END SOURCE DOCUMENT TEXT ---

Write the spoken video script now."""

SCENARIO_PROMPT_TEMPLATE = """Write a spoken video script for a doctor based on this scenario/topic:

"{scenario}"

Tone: {tone}
Target length: {length} (short ≈ 20-30 seconds spoken, medium ≈ 45-60 seconds spoken, long ≈ 90-120 seconds spoken)
Language: {language}

Write the spoken video script now, in {language}."""


class AzureOpenAIService:
    """
    Thin wrapper around the Azure OpenAI Chat Completions API for PointBlank's
    script-generation feature. Auth is Microsoft Entra ID via
    DefaultAzureCredential (no API key is ever stored or sent) — matches the
    organization's existing Azure OpenAI access pattern.

    The client and credential are created lazily on first use so importing
    this module never fails even if Azure OpenAI isn't configured yet; only
    an actual generation call requires real configuration/auth.
    """

    def __init__(self):
        self._client: Optional[AzureOpenAI] = None

    def is_configured(self) -> bool:
        return bool(settings.AZURE_OPENAI_ENDPOINT and settings.AZURE_OPENAI_DEPLOYMENT_NAME)

    def _get_client(self) -> AzureOpenAI:
        if self._client is None:
            credential = DefaultAzureCredential()
            token_provider = get_bearer_token_provider(credential, COGNITIVE_SERVICES_SCOPE)
            self._client = AzureOpenAI(
                azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
                azure_ad_token_provider=token_provider,
                api_version=settings.AZURE_OPENAI_API_VERSION,
            )
        return self._client

    def _complete_sync(self, user_prompt: str) -> str:
        client = self._get_client()
        response = client.chat.completions.create(
            model=settings.AZURE_OPENAI_DEPLOYMENT_NAME,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.6,
            max_completion_tokens=800,
        )
        text = (response.choices[0].message.content or "").strip() if response.choices else ""
        return text

    async def _complete_with_retry(self, user_prompt: str, max_attempts: int = 3) -> str:
        """
        Retries ONLY on AuthenticationError — observed empirically to be
        transient on this Azure OpenAI resource (identical requests from the
        identical credential alternate between 401 and 200 a few seconds
        apart, consistent with regional RBAC-cache replication lag on a
        global/PayGo deployment). Every other error type is a genuine,
        deterministic failure and is never retried here.
        """
        last_exc = None
        for attempt in range(1, max_attempts + 1):
            try:
                return await asyncio.to_thread(self._complete_sync, user_prompt)
            except AuthenticationError as exc:
                last_exc = exc
                if attempt < max_attempts:
                    logger.warning(
                        f"Azure OpenAI transient auth rejection on attempt {attempt}/{max_attempts} "
                        f"(azure_error_code={getattr(exc, 'code', None)}) — retrying."
                    )
                    await asyncio.sleep(0.8 * attempt)
        raise last_exc

    async def _complete(self, user_prompt: str, method: str = "unknown") -> str:
        if not self.is_configured():
            logger.error(
                f"Azure OpenAI not configured: endpoint={_endpoint_hostname()}, "
                f"deployment={settings.AZURE_OPENAI_DEPLOYMENT_NAME or '(unset)'}"
            )
            raise RuntimeError("AZURE_OPENAI_NOT_CONFIGURED")

        timestamp = datetime.now(timezone.utc).isoformat()
        logger.info(
            f"Azure OpenAI request: method={method}, timestamp={timestamp}, "
            f"endpoint={_endpoint_hostname()}, deployment={settings.AZURE_OPENAI_DEPLOYMENT_NAME}, "
            f"api_version={settings.AZURE_OPENAI_API_VERSION}, messages_count=2, "
            f"system_prompt_chars={len(SYSTEM_PROMPT)}, user_prompt_chars={len(user_prompt)}, "
            f"optional_params=[temperature,max_completion_tokens], "
            f"client_id={id(self._client) if self._client is not None else '(not yet created)'}"
        )

        try:
            text = await self._complete_with_retry(user_prompt)
        except AuthenticationError as exc:
            logger.error(
                f"Azure OpenAI authentication/authorization error (after retries): method={method}, "
                f"timestamp={datetime.now(timezone.utc).isoformat()}, "
                f"exception_type={type(exc).__name__}, http_status={getattr(exc, 'status_code', None)}, "
                f"azure_error_code={getattr(exc, 'code', None)}"
            )
            raise RuntimeError("AZURE_OPENAI_AUTH_ERROR") from exc
        except (APIConnectionError, APITimeoutError) as exc:
            logger.error(
                f"Azure OpenAI connection/timeout error: exception_type={type(exc).__name__}"
            )
            raise RuntimeError("AZURE_OPENAI_UNAVAILABLE") from exc
        except APIError as exc:
            logger.error(
                f"Azure OpenAI API error: exception_type={type(exc).__name__}, "
                f"http_status={getattr(exc, 'status_code', None)}, azure_error_code={getattr(exc, 'code', None)}"
            )
            raise RuntimeError("AZURE_OPENAI_REQUEST_FAILED") from exc
        except Exception as exc:
            logger.error(f"Azure OpenAI unexpected error: exception_type={type(exc).__name__}, message={exc}")
            raise RuntimeError("AZURE_OPENAI_REQUEST_FAILED") from exc

        if not text:
            logger.error(f"Azure OpenAI returned an empty completion (no exception raised): method={method}")
            raise RuntimeError("AZURE_OPENAI_EMPTY_RESPONSE")

        logger.info(f"Azure OpenAI request succeeded: method={method}, timestamp={datetime.now(timezone.utc).isoformat()}, response_chars={len(text)}")
        return text

    async def generate_script_from_document(self, source_text: str) -> str:
        logger.info(f"Document-to-script generation: extracted_text_chars={len(source_text)}")
        prompt = DOCUMENT_PROMPT_TEMPLATE.format(source_text=source_text[:12000])
        return await self._complete(prompt, method="generate_script_from_document")

    async def generate_script_from_scenario(self, scenario: str, tone: str, length: str, language: str) -> str:
        prompt = SCENARIO_PROMPT_TEMPLATE.format(scenario=scenario.strip(), tone=tone, length=length, language=language)
        return await self._complete(prompt, method="generate_script_from_scenario")


azure_openai_service = AzureOpenAIService()
