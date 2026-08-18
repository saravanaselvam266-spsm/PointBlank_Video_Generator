"""
Covers app/services/document_extraction_service.py — PDF/DOCX/TXT text
extraction for the "Upload Document" script mode.

Scope: real pypdf/python-docx parsing against real (tiny, hand-built) file
bytes — no mocking of the parsing libraries themselves, since correctness of
extraction is exactly what this module exists for. No network, no DB.
"""
import io
import os
import sys

import pytest
from docx import Document as DocxDocument

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.document_extraction_service import (
    extract_text_from_upload,
    DocumentExtractionError,
    MAX_DOCUMENT_UPLOAD_BYTES,
)


def _make_minimal_pdf_bytes(text: str) -> bytes:
    """Hand-built minimal single-page PDF containing the given text — no reportlab dependency needed just for tests."""
    content = f"BT /F1 24 Tf 72 720 Td ({text}) Tj ET".encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = b"%PDF-1.4\n"
    offsets = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref_offset = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += b"trailer\n<< /Size " + str(len(objects) + 1).encode() + b" /Root 1 0 R >>\nstartxref\n" + str(xref_offset).encode() + b"\n%%EOF"
    return out


def _make_docx_bytes(paragraphs) -> bytes:
    doc = DocxDocument()
    for p in paragraphs:
        doc.add_paragraph(p)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


class TestPdfExtraction:
    def test_extracts_real_text_from_pdf(self):
        pdf_bytes = _make_minimal_pdf_bytes("Patients should monitor blood pressure regularly.")
        text = extract_text_from_upload("notes.pdf", "application/pdf", pdf_bytes)
        assert "blood pressure" in text.lower()

    def test_corrupt_pdf_raises_clean_error(self):
        with pytest.raises(DocumentExtractionError) as exc_info:
            extract_text_from_upload("broken.pdf", "application/pdf", b"%PDF-1.4 not a real pdf structure")
        assert "couldn't read" in str(exc_info.value).lower()


class TestDocxExtraction:
    def test_extracts_paragraphs_from_docx(self):
        docx_bytes = _make_docx_bytes([
            "Regular checkups help detect hypertension early.",
            "Please consult your physician before starting any new medication.",
        ])
        text = extract_text_from_upload("notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docx_bytes)
        assert "hypertension" in text.lower()
        assert "physician" in text.lower()

    def test_corrupt_docx_raises_clean_error(self):
        with pytest.raises(DocumentExtractionError) as exc_info:
            extract_text_from_upload("broken.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", b"not a real docx zip")
        assert "couldn't read" in str(exc_info.value).lower()


class TestTxtExtraction:
    def test_extracts_plain_text(self):
        text = extract_text_from_upload("notes.txt", "text/plain", "Simple wellness reminder for annual checkups.".encode("utf-8"))
        assert "wellness" in text.lower()

    def test_falls_back_to_latin1_when_not_valid_utf8(self):
        raw = "Café checkup notes for the annual wellness visit".encode("latin-1")
        text = extract_text_from_upload("notes.txt", "text/plain", raw)
        assert "checkup" in text.lower()


class TestValidationErrors:
    def test_empty_file_rejected(self):
        with pytest.raises(DocumentExtractionError, match="empty"):
            extract_text_from_upload("empty.txt", "text/plain", b"")

    def test_oversized_file_rejected(self):
        oversized = b"a" * (MAX_DOCUMENT_UPLOAD_BYTES + 1)
        with pytest.raises(DocumentExtractionError, match="too large"):
            extract_text_from_upload("big.txt", "text/plain", oversized)

    def test_unsupported_file_type_rejected(self):
        with pytest.raises(DocumentExtractionError, match="Unsupported file type"):
            extract_text_from_upload("image.png", "image/png", b"\x89PNG\r\n\x1a\n")

    def test_effectively_empty_text_rejected(self):
        with pytest.raises(DocumentExtractionError, match="empty"):
            extract_text_from_upload("notes.txt", "text/plain", b"hi")

    def test_falls_back_to_extension_when_content_type_missing(self):
        pdf_bytes = _make_minimal_pdf_bytes("Annual flu vaccination reduces complications.")
        text = extract_text_from_upload("report.pdf", None, pdf_bytes)
        assert "vaccination" in text.lower()


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
