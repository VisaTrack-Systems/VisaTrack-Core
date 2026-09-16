from __future__ import annotations

import hashlib
import zipfile
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.workers import scan_document
from app.workers.scan_document import _matches_declared_type
from tests.support import FakeResult


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


@pytest.mark.parametrize(
    "ai_enabled, organization_allowed, expected_jobs",
    [(False, True, 0), (True, False, 0), (True, True, 1)],
)
def test_clean_scan_only_queues_ai_index_when_feature_enabled(
    monkeypatch, ai_enabled, organization_allowed, expected_jobs
):
    document_id = uuid4()
    db = MagicMock()
    db.execute.side_effect = [
        FakeResult(
            rows=[
                {
                    "id": document_id,
                    "case_id": uuid4(),
                    "file_path": "quarantine/org/case/document.pdf",
                    "file_type": "application/pdf",
                    "scan_status": "pending",
                    "scan_completed_at": None,
                    "organization_id": uuid4(),
                    "client_id": uuid4(),
                }
            ]
        ),
        FakeResult(),
        FakeResult(),
    ]

    def download_pdf(*, object_key, destination):
        destination.write(b"%PDF-1.7\n")
        destination.seek(0)

    enqueue = MagicMock()
    monkeypatch.setattr(scan_document.settings, "ai_enabled", ai_enabled)
    monkeypatch.setattr(
        scan_document.settings,
        "ai_enabled_for_organization",
        lambda organization_id: ai_enabled and organization_allowed,
    )
    monkeypatch.setattr(scan_document, "download_object", download_pdf)
    monkeypatch.setattr(scan_document, "_scan", lambda path: (True, "clean", "test"))
    put_object = MagicMock()
    monkeypatch.setattr(scan_document, "put_object_bytes", put_object)
    monkeypatch.setattr(scan_document, "delete_object", MagicMock())
    monkeypatch.setattr(scan_document, "log_activity", MagicMock())
    monkeypatch.setattr(scan_document, "enqueue_job", enqueue)

    scan_document.scan_document(db, {"document_id": str(document_id)})

    assert enqueue.call_count == expected_jobs
    assert put_object.call_args.kwargs["payload"] == b"%PDF-1.7\n"
    clean_update_params = db.execute.call_args_list[2].args[1]
    assert clean_update_params["file_hash"] == hashlib.sha256(b"%PDF-1.7\n").hexdigest()
