"""Queue controlled antivirus provenance backfill before legacy AI indexing."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from uuid import UUID

from sqlalchemy import text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.jobs import enqueue_job


def queue(organization_id: UUID, *, execute: bool) -> int:
    if not settings.ai_enabled_for_organization(organization_id):
        raise RuntimeError("AI is not enabled for this organization")
    with SessionLocal() as db:
        rows = db.execute(
            text(
                """
                SELECT cd.id
                FROM case_documents cd
                JOIN cases c ON c.id = cd.case_id
                WHERE c.organization_id = :organization_id
                  AND cd.deleted_at IS NULL
                  AND cd.scan_status = 'clean'
                  AND (cd.scan_completed_at IS NULL OR cd.file_hash IS NULL)
                  AND cd.file_type IN (
                      'application/pdf',
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                  )
                ORDER BY cd.created_at, cd.id
                """
            ),
            {"organization_id": str(organization_id)},
        ).all()
        if not execute:
            return len(rows)
        for row in rows:
            document_id = row[0]
            enqueue_job(
                db,
                organization_id=organization_id,
                job_type="scan_document",
                idempotency_key=f"ai-rescan-backfill:{document_id}:v1",
                payload={"document_id": str(document_id)},
                max_attempts=8,
            )
        db.commit()
        return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--organization-id", type=UUID, required=True)
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Queue jobs; without this flag the command is a read-only dry run.",
    )
    args = parser.parse_args()
    count = queue(args.organization_id, execute=args.execute)
    action = "queued" if args.execute else "eligible"
    print(f"{count} document(s) {action} for scan-provenance backfill.")


if __name__ == "__main__":
    main()
