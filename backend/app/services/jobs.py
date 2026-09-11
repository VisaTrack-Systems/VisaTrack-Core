"""Durable database-backed job queue with idempotency and bounded retries."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Callable
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.background_job import BackgroundJob

JobHandler = Callable[[Session, dict[str, Any]], None]
_handlers: dict[str, JobHandler] = {}


def register_handler(job_type: str):
    def decorator(handler: JobHandler) -> JobHandler:
        _handlers[job_type] = handler
        return handler

    return decorator


def enqueue_job(
    db: Session,
    *,
    organization_id: UUID,
    job_type: str,
    idempotency_key: str,
    payload: dict[str, Any],
    max_attempts: int = 5,
    scheduled_at: datetime | None = None,
) -> BackgroundJob:
    existing = db.scalar(
        select(BackgroundJob).where(
            BackgroundJob.organization_id == organization_id,
            BackgroundJob.idempotency_key == idempotency_key,
        )
    )
    if existing is not None:
        return existing

    job = BackgroundJob(
        id=uuid4(),
        organization_id=organization_id,
        job_type=job_type,
        idempotency_key=idempotency_key,
        payload=payload,
        max_attempts=max_attempts,
        scheduled_at=scheduled_at or datetime.now(timezone.utc),
    )
    db.add(job)
    db.flush()
    return job


def claim_next_job(db: Session) -> BackgroundJob | None:
    now = datetime.now(timezone.utc)
    job = db.scalar(
        select(BackgroundJob)
        .where(
            BackgroundJob.status.in_(("pending", "retry")),
            BackgroundJob.scheduled_at <= now,
        )
        .order_by(BackgroundJob.created_at)
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    if job is None:
        return None
    job.status = "running"
    job.attempts = int(job.attempts or 0) + 1
    job.started_at = now
    db.add(job)
    db.commit()
    return job


def execute_job(db: Session, job: BackgroundJob) -> None:
    handler = _handlers.get(job.job_type)
    if handler is None:
        _mark_failed(db, job, f"Unknown job type: {job.job_type}", retryable=False)
        return

    try:
        handler(db, dict(job.payload or {}))
    except Exception as exc:
        db.rollback()
        _mark_failed(db, job, str(exc), retryable=True)
        return

    job.status = "completed"
    job.completed_at = datetime.now(timezone.utc)
    job.last_error = None
    db.add(job)
    db.commit()


def _mark_failed(
    db: Session,
    job: BackgroundJob,
    message: str,
    *,
    retryable: bool,
) -> None:
    job = db.get(BackgroundJob, job.id) or job
    attempts = int(job.attempts or 0)
    exhausted = attempts >= int(job.max_attempts or 1)
    if not retryable or exhausted:
        job.status = "failed"
        job.completed_at = datetime.now(timezone.utc)
    else:
        job.status = "retry"
        delay_seconds = min(3600, 2 ** min(attempts, 10))
        job.scheduled_at = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
    job.last_error = message[:4000]
    db.add(job)
    db.commit()
