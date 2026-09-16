from io import BytesIO
from types import SimpleNamespace

import pytest
from docx import Document

from app.services import ai_documents
from app.services.ai_documents import (
    CHUNK_CHARS,
    DocumentExtractionError,
    _chunk_text,
    extract_document_chunks,
)


def test_chunk_text_preserves_overlap_and_bounds():
    text = " ".join(f"word-{index}" for index in range(600))

    chunks = _chunk_text(text)

    assert len(chunks) > 1
    assert all(len(chunk) <= CHUNK_CHARS for chunk in chunks)
    assert set(chunks[0].split()).intersection(chunks[1].split())


def test_extract_docx_text_without_external_provider():
    document = Document()
    document.add_paragraph("Client legal name is Example Client.")
    output = BytesIO()
    document.save(output)

    chunks = extract_document_chunks(
        output.getvalue(),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

    assert "Example Client" in chunks[0].content
    assert chunks[0].page_number is None


def test_image_documents_require_separate_ocr_pipeline():
    with pytest.raises(DocumentExtractionError, match="PDF and DOCX"):
        extract_document_chunks(b"\x89PNG", "image/png")


def test_docx_zip_bomb_is_rejected_before_document_parser(monkeypatch):
    class OversizedArchive:
        def __init__(self, payload):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def infolist(self):
            return [
                SimpleNamespace(
                    file_size=ai_documents.MAX_OFFICE_UNCOMPRESSED_BYTES + 1
                )
            ]

    monkeypatch.setattr(ai_documents, "ZipFile", OversizedArchive)
    monkeypatch.setattr(ai_documents, "Document", lambda payload: pytest.fail("parser called"))

    with pytest.raises(
        DocumentExtractionError,
        match="uncompressed processing limit",
    ):
        ai_documents._extract_docx(b"PK")
