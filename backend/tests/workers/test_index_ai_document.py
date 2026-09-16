import hashlib
from unittest.mock import MagicMock
from uuid import uuid4

from app.services.ai_documents import ExtractedChunk
from app.workers import index_ai_document
from tests.support import FakeResult


def test_indexer_never_reads_quarantined_document(monkeypatch):
    document_id = uuid4()
    db = MagicMock()
    db.execute.return_value = FakeResult(
        rows=[
            {
                "id": document_id,
                "case_id": uuid4(),
                "file_path": "quarantine/org/case/document.pdf",
                "file_type": "application/pdf",
                "scan_status": "pending",
                "organization_id": uuid4(),
                "client_id": uuid4(),
            }
        ]
    )
    storage_read = MagicMock()
    monkeypatch.setattr(index_ai_document.settings, "ai_enabled", True)
    monkeypatch.setattr(index_ai_document, "get_object_bytes", storage_read)

    index_ai_document.index_ai_document(db, {"document_id": str(document_id)})

    storage_read.assert_not_called()
    db.commit.assert_not_called()


def test_indexer_does_nothing_when_ai_feature_is_disabled(monkeypatch):
    db = MagicMock()
    storage_read = MagicMock()
    monkeypatch.setattr(index_ai_document.settings, "ai_enabled", False)
    monkeypatch.setattr(index_ai_document, "get_object_bytes", storage_read)

    index_ai_document.index_ai_document(db, {"document_id": str(uuid4())})

    db.execute.assert_not_called()
    storage_read.assert_not_called()


def test_indexer_rejects_legacy_clean_row_without_scan_provenance(monkeypatch):
    db = MagicMock()
    db.execute.return_value = FakeResult(
        rows=[
            {
                "id": uuid4(),
                "case_id": uuid4(),
                "file_path": "clean/org/case/legacy.pdf",
                "file_type": "application/pdf",
                "scan_status": "clean",
                "scan_completed_at": None,
                "file_hash": None,
                "organization_id": uuid4(),
                "client_id": uuid4(),
            }
        ]
    )
    storage_read = MagicMock()
    monkeypatch.setattr(index_ai_document.settings, "ai_enabled", True)
    monkeypatch.setattr(index_ai_document, "get_object_bytes", storage_read)

    index_ai_document.index_ai_document(db, {"document_id": str(uuid4())})

    storage_read.assert_not_called()


def test_indexer_rejects_clean_status_outside_clean_prefix(monkeypatch):
    document_id = uuid4()
    db = MagicMock()
    db.execute.return_value = FakeResult(
        rows=[
            {
                "id": document_id,
                "case_id": uuid4(),
                "file_path": "quarantine/org/case/document.pdf",
                "file_type": "application/pdf",
                "scan_status": "clean",
                "scan_completed_at": "now",
                "file_hash": "a" * 64,
                "organization_id": uuid4(),
                "client_id": uuid4(),
            }
        ]
    )
    storage_read = MagicMock()
    monkeypatch.setattr(index_ai_document.settings, "ai_enabled", True)
    monkeypatch.setattr(index_ai_document, "get_object_bytes", storage_read)
    monkeypatch.setattr(index_ai_document, "log_activity", MagicMock())

    index_ai_document.index_ai_document(db, {"document_id": str(document_id)})

    storage_read.assert_not_called()
    assert "DELETE FROM ai_document_chunks" in str(db.execute.call_args_list[1].args[0])
    db.commit.assert_called_once()


def test_indexer_does_not_extract_for_unapproved_organization(monkeypatch):
    document_id = uuid4()
    db = MagicMock()
    db.execute.return_value = FakeResult(
        rows=[
            {
                "id": document_id,
                "case_id": uuid4(),
                "file_path": "clean/org/case/document.pdf",
                "file_type": "application/pdf",
                "scan_status": "clean",
                "scan_completed_at": "now",
                "file_hash": "a" * 64,
                "organization_id": uuid4(),
                "client_id": uuid4(),
            }
        ]
    )
    storage_read = MagicMock()
    monkeypatch.setattr(index_ai_document.settings, "ai_enabled", True)
    monkeypatch.setattr(
        index_ai_document.settings,
        "ai_enabled_for_organization",
        lambda organization_id: False,
    )
    monkeypatch.setattr(index_ai_document, "get_object_bytes", storage_read)

    index_ai_document.index_ai_document(db, {"document_id": str(document_id)})

    storage_read.assert_not_called()


def test_indexer_rejects_object_that_changed_after_clean_scan(monkeypatch):
    document_id = uuid4()
    db = MagicMock()
    db.execute.side_effect = [
        FakeResult(
            rows=[
                {
                    "id": document_id,
                    "case_id": uuid4(),
                    "file_path": "clean/org/case/document.pdf",
                    "file_type": "application/pdf",
                    "scan_status": "clean",
                    "scan_completed_at": "now",
                    "file_hash": "a" * 64,
                    "organization_id": uuid4(),
                    "client_id": uuid4(),
                }
            ]
        ),
        FakeResult(),
    ]
    extract = MagicMock()
    monkeypatch.setattr(index_ai_document.settings, "ai_enabled", True)
    monkeypatch.setattr(index_ai_document, "get_object_bytes", lambda **kwargs: b"changed")
    monkeypatch.setattr(index_ai_document, "extract_document_chunks", extract)
    monkeypatch.setattr(index_ai_document, "log_activity", MagicMock())

    index_ai_document.index_ai_document(db, {"document_id": str(document_id)})

    extract.assert_not_called()
    assert "DELETE FROM ai_document_chunks" in str(db.execute.call_args_list[1].args[0])
    assert db.commit.call_count == 2


def test_indexer_persists_scan_digest_and_extractor_version(monkeypatch):
    document_id = uuid4()
    source = b"clean document"
    source_sha256 = hashlib.sha256(source).hexdigest()
    document = {
        "id": document_id,
        "case_id": uuid4(),
        "file_path": "clean/org/case/document.pdf",
        "file_type": "application/pdf",
        "scan_status": "clean",
        "scan_completed_at": "now",
        "file_hash": source_sha256,
        "organization_id": uuid4(),
        "client_id": uuid4(),
    }
    db = MagicMock()
    db.execute.side_effect = [
        FakeResult(rows=[document]),
        FakeResult(
            rows=[
                {
                    "file_path": document["file_path"],
                    "file_hash": source_sha256,
                    "scan_status": "clean",
                    "scan_completed_at": "now",
                }
            ]
        ),
        FakeResult(),
        FakeResult(),
    ]
    monkeypatch.setattr(index_ai_document.settings, "ai_enabled", True)
    monkeypatch.setattr(index_ai_document, "get_object_bytes", lambda **kwargs: source)
    monkeypatch.setattr(
        index_ai_document,
        "extract_document_chunks",
        lambda payload, content_type: [
            ExtractedChunk(page_number=1, content="Client evidence")
        ],
    )
    monkeypatch.setattr(index_ai_document, "log_activity", MagicMock())

    index_ai_document.index_ai_document(db, {"document_id": str(document_id)})

    insert_params = db.execute.call_args_list[3].args[1]
    assert insert_params["source_sha256"] == source_sha256
    assert insert_params["extractor_version"] == index_ai_document.EXTRACTOR_VERSION
    assert db.commit.call_count == 2
