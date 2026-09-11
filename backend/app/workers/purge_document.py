"""Idempotent storage purge handler honoring retention and legal holds."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.audit import log_activity
from app.services.jobs import register_handler
from app.services.storage import delete_object


@register_handler("purge_document")
def purge_document(db: Session, payload: dict) -> None:
    document_id = UUID(str(payload["document_id"]))
    document = db.execute(
        text(
            """
            SELECT cd.id, cd.case_id, cd.file_path, cd.legal_hold,
                   cd.retention_delete_after, cd.storage_purged_at,
                   c.organization_id, c.client_id
            FROM case_documents cd
            JOIN cases c ON c.id = cd.case_id
            WHERE cd.id = :document_id AND cd.deleted_at IS NOT NULL
            FOR UPDATE OF cd
            """
        ),
        {"document_id": str(document_id)},
    ).mappings().first()
    if document is None or document["storage_purged_at"] is not None:
        return
    if document["legal_hold"]:
        raise RuntimeError("Document is under legal hold")
    if (
        document["retention_delete_after"] is None
        or document["retention_delete_after"] > datetime.now(timezone.utc)
    ):
        raise RuntimeError("Document retention period has not elapsed")

    delete_object(object_key=str(document["file_path"]))
    db.execute(
        text(
            "UPDATE case_documents SET storage_purged_at = NOW(), updated_at = NOW() "
            "WHERE id = :document_id"
        ),
        {"document_id": str(document_id)},
    )
    log_activity(
        db,
        organization_id=document["organization_id"],
        user_id=None,
        action="storage_purged",
        entity_type="document",
        entity_id=document_id,
        case_id=document["case_id"],
        client_id=document["client_id"],
    )
    db.commit()
