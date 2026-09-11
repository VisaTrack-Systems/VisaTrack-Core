"""Export audit outbox events to an S3 Object Lock compliance bucket."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.storage import put_immutable_audit_event


def export_pending_audit_events(db: Session, *, limit: int = 100) -> int:
    events = db.execute(
        text(
            """
            SELECT id, event_id, event_type, payload, created_at
            FROM audit_outbox
            WHERE exported_at IS NULL
            ORDER BY created_at
            FOR UPDATE SKIP LOCKED
            LIMIT :limit
            """
        ),
        {"limit": limit},
    ).mappings().all()
    exported = 0
    for event in events:
        created_at = event["created_at"]
        object_key = (
            f"audit/{created_at:%Y/%m/%d}/{event['event_type']}/"
            f"{event['event_id']}.json"
        )
        payload = json.dumps(
            event["payload"],
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        ).encode("utf-8")
        try:
            put_immutable_audit_event(
                object_key=object_key,
                payload=payload,
                retain_until=datetime.now(timezone.utc)
                + timedelta(days=settings.audit_retention_days),
            )
        except Exception as exc:
            db.execute(
                text(
                    """
                    UPDATE audit_outbox
                    SET export_attempts = export_attempts + 1,
                        last_error = :last_error
                    WHERE id = :id
                    """
                ),
                {"id": str(event["id"]), "last_error": str(exc)[:2000]},
            )
            db.commit()
            continue
        db.execute(
            text(
                """
                UPDATE audit_outbox
                SET exported_at = NOW(),
                    export_attempts = export_attempts + 1,
                    last_error = NULL
                WHERE id = :id
                """
            ),
            {"id": str(event["id"])},
        )
        db.commit()
        exported += 1
    return exported
