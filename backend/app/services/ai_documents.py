"""Local, bounded text extraction and provider-neutral document chunking."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from zipfile import ZipFile

from docx import Document
from pypdf import PdfReader

from app.core.config import settings

MAX_PDF_PAGES = 250
MAX_OFFICE_ENTRIES = 5000
MAX_OFFICE_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
CHUNK_CHARS = 1400
CHUNK_OVERLAP = 180


class DocumentExtractionError(ValueError):
    pass


@dataclass(frozen=True)
class ExtractedChunk:
    page_number: int | None
    content: str


def extract_document_chunks(payload: bytes, content_type: str) -> list[ExtractedChunk]:
    if content_type == "application/pdf":
        pages = _extract_pdf(payload)
    elif content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        pages = [(None, _extract_docx(payload))]
    else:
        raise DocumentExtractionError("Only text-based PDF and DOCX documents can be indexed")

    chunks: list[ExtractedChunk] = []
    consumed = 0
    for page_number, text in pages:
        normalized = " ".join(text.split())
        if not normalized:
            continue
        remaining = max(0, settings.ai_max_document_chars - consumed)
        normalized = normalized[:remaining]
        consumed += len(normalized)
        chunks.extend(
            ExtractedChunk(page_number=page_number, content=chunk)
            for chunk in _chunk_text(normalized)
        )
        if consumed >= settings.ai_max_document_chars:
            break
    if not chunks:
        raise DocumentExtractionError(
            "No selectable text was found; OCR is required for this document"
        )
    return chunks


def _extract_pdf(payload: bytes) -> list[tuple[int, str]]:
    try:
        reader = PdfReader(BytesIO(payload), strict=False)
        if len(reader.pages) > MAX_PDF_PAGES:
            raise DocumentExtractionError(f"PDF exceeds the {MAX_PDF_PAGES}-page indexing limit")
        return [
            (index + 1, page.extract_text() or "")
            for index, page in enumerate(reader.pages)
        ]
    except DocumentExtractionError:
        raise
    except Exception as exc:
        raise DocumentExtractionError("PDF text extraction failed") from exc


def _extract_docx(payload: bytes) -> str:
    try:
        with ZipFile(BytesIO(payload)) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_OFFICE_ENTRIES:
                raise DocumentExtractionError("DOCX archive contains too many entries")
            if sum(entry.file_size for entry in entries) > MAX_OFFICE_UNCOMPRESSED_BYTES:
                raise DocumentExtractionError(
                    "DOCX archive exceeds the uncompressed processing limit"
                )
        document = Document(BytesIO(payload))
        return "\n".join(
            paragraph.text
            for paragraph in document.paragraphs
            if paragraph.text.strip()
        )
    except DocumentExtractionError:
        raise
    except Exception as exc:
        raise DocumentExtractionError("DOCX text extraction failed") from exc


def _chunk_text(text: str) -> list[str]:
    if len(text) <= CHUNK_CHARS:
        return [text]
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + CHUNK_CHARS)
        if end < len(text):
            split = text.rfind(" ", start + CHUNK_CHARS // 2, end)
            if split > start:
                end = split
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(start + 1, end - CHUNK_OVERLAP)
    return chunks
