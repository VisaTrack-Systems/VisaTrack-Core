from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.workers import purge_document
from tests.support import FakeResult


def _deleted_document(document_id):
    return {
        "id": document_id,
        "case_id": uuid4(),
        "file_path": "clean/org/case/source.pdf",
        "legal_hold": False,
        "retention_delete_after": datetime.now(timezone.utc) - timedelta(days=1),
        "storage_purged_at": None,
        "organization_id": uuid4(),
        "client_id": uuid4(),
    }


def test_purge_removes_extracted_chunks_and_derived_form_objects(monkeypatch):
    document_id = uuid4()
    draft_id = uuid4()
    db = MagicMock()
    db.execute.side_effect = [
        FakeResult(rows=[_deleted_document(document_id)]),
        FakeResult(scalar_value=0),
        FakeResult(
            rows=[
                {
                    "id": draft_id,
                    "file_path": "clean/org/case/ai-form-drafts/draft.pdf",
                }
            ]
        ),
        FakeResult(),
        FakeResult(),
        FakeResult(),
    ]
    delete = MagicMock()
    audit = MagicMock()
    monkeypatch.setattr(purge_document, "delete_object", delete)
    monkeypatch.setattr(purge_document, "log_activity", audit)

    purge_document.purge_document(db, {"document_id": str(document_id)})

    assert [call.kwargs["object_key"] for call in delete.call_args_list] == [
        "clean/org/case/ai-form-drafts/draft.pdf",
        "clean/org/case/source.pdf",
    ]
    statements = [str(call.args[0]) for call in db.execute.call_args_list]
    assert any("DELETE FROM ai_document_chunks" in statement for statement in statements)
    assert any("DELETE FROM ai_form_drafts" in statement for statement in statements)
    assert audit.call_args.kwargs["new_values"]["ai_form_drafts_purged"] == 1
    db.commit.assert_called_once()


def test_purge_preserves_draft_when_any_cited_source_is_held(monkeypatch):
    document_id = uuid4()
    db = MagicMock()
    db.execute.side_effect = [
        FakeResult(rows=[_deleted_document(document_id)]),
        FakeResult(scalar_value=1),
    ]
    delete = MagicMock()
    monkeypatch.setattr(purge_document, "delete_object", delete)

    with pytest.raises(RuntimeError, match="cites a legal hold"):
        purge_document.purge_document(db, {"document_id": str(document_id)})

    delete.assert_not_called()
