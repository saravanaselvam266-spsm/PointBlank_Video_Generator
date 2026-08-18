import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File

from app.models import User
from app.schemas import ScriptGenerateRequest, ScriptResponse
from app.dependencies.auth import get_current_user
from app.services.document_extraction_service import extract_text_from_upload, DocumentExtractionError
from app.services.azure_openai_service import azure_openai_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/videos/script", tags=["Script Generation"])

# Every Azure OpenAI failure mode collapses to this one message — the raw
# reason (auth/config/timeout/empty-response/provider error) is only ever
# logged server-side, never surfaced to the client.
AI_UNAVAILABLE_DETAIL = "Script generation is temporarily unavailable. Please try again."

_AZURE_OPENAI_ERROR_CODES = {
    "AZURE_OPENAI_NOT_CONFIGURED",
    "AZURE_OPENAI_AUTH_ERROR",
    "AZURE_OPENAI_UNAVAILABLE",
    "AZURE_OPENAI_REQUEST_FAILED",
    "AZURE_OPENAI_EMPTY_RESPONSE",
}


def _raise_clean_ai_error(exc: Exception):
    code = str(exc)
    if code in _AZURE_OPENAI_ERROR_CODES:
        logger.error(f"Script generation unavailable ({code})")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=AI_UNAVAILABLE_DETAIL)
    logger.error(f"Unexpected script generation error: {exc}")
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=AI_UNAVAILABLE_DETAIL)


@router.post("/from-document", response_model=ScriptResponse)
async def generate_script_from_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Document → extracted source text → Azure OpenAI → spoken video script.
    The uploaded file's bytes are never sent to video generation — only the
    resulting script string is, and only once the user has reviewed/edited it.
    """
    file_bytes = await file.read()

    try:
        source_text = extract_text_from_upload(file.filename, file.content_type, file_bytes)
    except DocumentExtractionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    try:
        script = await azure_openai_service.generate_script_from_document(source_text)
    except Exception as exc:
        _raise_clean_ai_error(exc)

    return ScriptResponse(script=script, source_type="document")


@router.post("/generate", response_model=ScriptResponse)
async def generate_script_from_scenario(
    req: ScriptGenerateRequest,
    current_user: User = Depends(get_current_user)
):
    """Scenario description → Azure OpenAI → spoken video script."""
    if not req.scenario.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please describe what the doctor should talk about.")

    try:
        script = await azure_openai_service.generate_script_from_scenario(
            scenario=req.scenario,
            tone=req.tone or "professional",
            length=req.length or "medium",
            language=req.language or "English",
        )
    except Exception as exc:
        _raise_clean_ai_error(exc)

    return ScriptResponse(script=script, source_type="ai")
