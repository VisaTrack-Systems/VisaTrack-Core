from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
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


def test_claim_only_selects_job_types_registered_by_this_worker(monkeypatch):
    db = MagicMock()
    db.scalar.return_value = None
    monkeypatch.setattr(jobs, "_handlers", {"scan_document": lambda db, payload: None})

    assert jobs.claim_next_job(db) is None

    statement = str(db.scalar.call_args.args[0])
    assert "background_jobs.job_type IN" in statement


def test_claim_recovers_stale_running_job(monkeypatch):
    stale_started_at = datetime.now(timezone.utc) - timedelta(minutes=20)
    job = SimpleNamespace(
        status="running",
        attempts=1,
        max_attempts=5,
        started_at=stale_started_at,
        last_error=None,
    )
    db = MagicMock()
    db.scalar.return_value = job
    monkeypatch.setattr(jobs, "_handlers", {"index_ai_document": lambda db, payload: None})

    claimed = jobs.claim_next_job(db)

    assert claimed is job
    assert job.status == "running"
    assert job.attempts == 2
    assert job.started_at > stale_started_at
    assert job.last_error == "Recovered stale running job"
    db.commit.assert_called_once()
