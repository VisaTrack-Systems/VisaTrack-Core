from unittest.mock import MagicMock
from uuid import uuid4

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
    monkeypatch.setattr(index_ai_document, "get_object_bytes", storage_read)

    index_ai_document.index_ai_document(db, {"document_id": str(document_id)})

    storage_read.assert_not_called()
    db.commit.assert_not_called()
