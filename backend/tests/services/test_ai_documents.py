from io import BytesIO

import pytest
from docx import Document

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
