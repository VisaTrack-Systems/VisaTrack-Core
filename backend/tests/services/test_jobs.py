from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

from app.services import jobs


def test_enqueue_job_is_idempotent():
    existing = object()
    db = MagicMock()
    db.scalar.return_value = existing

    result = jobs.enqueue_job(
        db,
        organization_id=uuid4(),
        job_type="scan_document",
        idempotency_key="scan:document-1",
        payload={"document_id": "document-1"},
    )

    assert result is existing
    db.add.assert_not_called()


def test_enqueue_job_creates_durable_record():
    db = MagicMock()
    db.scalar.return_value = None
    organization_id = uuid4()

    result = jobs.enqueue_job(
        db,
        organization_id=organization_id,
        job_type="scan_document",
        idempotency_key="scan:document-1",
        payload={"document_id": "document-1"},
    )

    assert result.organization_id == organization_id
    assert result.idempotency_key == "scan:document-1"
    db.add.assert_called_once_with(result)
    db.flush.assert_called_once()
