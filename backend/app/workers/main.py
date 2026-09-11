"""Claim and execute durable background jobs.

Run continuously with ``python -m app.workers.main`` or process one available
job with ``python -m app.workers.main --once``.
"""

from __future__ import annotations

import argparse
import logging
import time

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.jobs import claim_next_job, execute_job
from app.workers.export_audit import export_pending_audit_events
from app.workers import purge_document  # noqa: F401
from app.workers import scan_document  # noqa: F401

logger = logging.getLogger(__name__)


def run_once() -> bool:
    with SessionLocal() as db:
        exported = (
            export_pending_audit_events(db)
            if settings.audit_archive_bucket
            else 0
        )
        job = claim_next_job(db)
        if job is None:
            return exported > 0
        logger.info("processing job id=%s type=%s attempt=%s", job.id, job.job_type, job.attempts)
        execute_job(db, job)
        return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--poll-seconds", type=float, default=2.0)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)

    if args.once:
        run_once()
        return

    while True:
        if not run_once():
            time.sleep(max(0.1, args.poll_seconds))


if __name__ == "__main__":
    main()
