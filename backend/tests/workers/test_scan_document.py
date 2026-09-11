from __future__ import annotations

import zipfile

from app.workers.scan_document import _matches_declared_type


def test_magic_byte_validation_rejects_spoofed_pdf(tmp_path):
    path = tmp_path / "spoofed.pdf"
    path.write_bytes(b"<script>alert('not a pdf')</script>")

    assert _matches_declared_type(path, "application/pdf") is False


def test_magic_byte_validation_accepts_pdf_png_and_jpeg(tmp_path):
    samples = (
        ("document.pdf", b"%PDF-1.7\n", "application/pdf"),
        ("image.png", b"\x89PNG\r\n\x1a\nrest", "image/png"),
        ("photo.jpg", b"\xff\xd8\xff\xe0rest", "image/jpeg"),
    )
    for file_name, payload, content_type in samples:
        path = tmp_path / file_name
        path.write_bytes(payload)
        assert _matches_declared_type(path, content_type) is True


def test_docx_requires_office_package_structure(tmp_path):
    valid = tmp_path / "valid.docx"
    with zipfile.ZipFile(valid, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types />")
        archive.writestr("word/document.xml", "<document />")

    invalid = tmp_path / "generic.zip"
    with zipfile.ZipFile(invalid, "w") as archive:
        archive.writestr("payload.txt", "not a document")

    content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    assert _matches_declared_type(valid, content_type) is True
    assert _matches_declared_type(invalid, content_type) is False
