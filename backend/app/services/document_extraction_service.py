import io
import logging
from typing import Optional

from pypdf import PdfReader
from docx import Document as DocxDocument

logger = logging.getLogger(__name__)

MAX_DOCUMENT_UPLOAD_BYTES = 15 * 1024 * 1024  # 15MB, matches the existing photo-upload limit
MIN_EXTRACTED_TEXT_CHARS = 20  # below this, treat as an effectively empty document

SUPPORTED_CONTENT_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
}
SUPPORTED_EXTENSIONS = {"pdf": "pdf", "docx": "docx", "txt": "txt"}


class DocumentExtractionError(ValueError):
    """Raised for any document that can't be turned into usable script source text. Message is always safe to show the user as-is."""


def _detect_format(filename: Optional[str], content_type: Optional[str]) -> str:
    """
    Prefers the declared Content-Type (browsers/axios set this reliably for
    PDF/DOCX/TXT from a file picker or drag-and-drop), falling back to the
    filename extension. Never guesses further than these three formats — if
    the backend doesn't have a real parser for it, it doesn't claim support.
    """
    content_type = (content_type or "").split(";")[0].strip().lower()
    if content_type in SUPPORTED_CONTENT_TYPES:
        return SUPPORTED_CONTENT_TYPES[content_type]

    ext = (filename or "").rsplit(".", 1)[-1].lower() if filename and "." in filename else ""
    if ext in SUPPORTED_EXTENSIONS:
        return SUPPORTED_EXTENSIONS[ext]

    raise DocumentExtractionError("Unsupported file type. Please upload a PDF, DOCX, or TXT file.")


def _extract_pdf_text(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
    except Exception as exc:
        logger.warning(f"PDF parse failed: {exc}")
        raise DocumentExtractionError("Couldn't read this PDF. Please try another file.")

    pages_text = []
    for page in reader.pages:
        try:
            text = page.extract_text() or ""
        except Exception as exc:
            logger.warning(f"PDF page extraction warning: {exc}")
            text = ""
        if text.strip():
            pages_text.append(text.strip())

    return "\n\n".join(pages_text)


def _extract_docx_text(file_bytes: bytes) -> str:
    try:
        doc = DocxDocument(io.BytesIO(file_bytes))
    except Exception as exc:
        logger.warning(f"DOCX parse failed: {exc}")
        raise DocumentExtractionError("Couldn't read this DOCX file. Please try another file.")

    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text and p.text.strip()]
    return "\n\n".join(paragraphs)


def _extract_txt_text(file_bytes: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return file_bytes.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            continue
    raise DocumentExtractionError("Couldn't read this text file. Please try another file.")


def extract_text_from_upload(filename: Optional[str], content_type: Optional[str], file_bytes: bytes) -> str:
    """
    Turns an uploaded PDF/DOCX/TXT into plain source text for the AI script
    step. Raises DocumentExtractionError (safe, user-facing message) for any
    unsupported/unreadable/empty document — never lets a raw parser
    exception or stack trace escape to the API layer.
    """
    if not file_bytes:
        raise DocumentExtractionError("This file appears to be empty. Please upload a document with content.")

    if len(file_bytes) > MAX_DOCUMENT_UPLOAD_BYTES:
        raise DocumentExtractionError("This file is too large. Please upload a file under 15MB.")

    fmt = _detect_format(filename, content_type)

    if fmt == "pdf":
        text = _extract_pdf_text(file_bytes)
    elif fmt == "docx":
        text = _extract_docx_text(file_bytes)
    else:
        text = _extract_txt_text(file_bytes)

    if len(text.strip()) < MIN_EXTRACTED_TEXT_CHARS:
        raise DocumentExtractionError("This document appears to be empty or has no readable text. Please upload another file.")

    return text.strip()
