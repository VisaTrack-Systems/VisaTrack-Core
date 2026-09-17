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

    held_draft_sources = db.execute(
        text(
            """
            SELECT COUNT(*)
            FROM ai_form_drafts fd
            LEFT JOIN case_documents source ON source.id = fd.source_document_id
            WHERE (
                    fd.source_document_id = :document_id
                    OR EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements(fd.citations) target
                        WHERE target->>'case_document_id' = :document_id
                    )
                  )
              AND (
                    source.legal_hold = TRUE
                    OR EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements(fd.citations) citation
                        JOIN case_documents cited
                          ON cited.id = (citation->>'case_document_id')::uuid
                        WHERE cited.legal_hold = TRUE
                    )
                  )
            """
        ),
        {"document_id": str(document_id)},
    ).scalar_one()
    if int(held_draft_sources or 0) > 0:
        raise RuntimeError("An AI form draft derived from this document cites a legal hold")

    form_drafts = db.execute(
        text(
            """
            SELECT id, file_path
            FROM ai_form_drafts
            WHERE source_document_id = :document_id
               OR EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(citations) citation
                    WHERE citation->>'case_document_id' = :document_id
               )
            FOR UPDATE
            """
        ),
        {"document_id": str(document_id)},
    ).mappings().all()
    for draft in form_drafts:
        delete_object(object_key=str(draft["file_path"]))
    delete_object(object_key=str(document["file_path"]))
    db.execute(
        text("DELETE FROM ai_document_chunks WHERE case_document_id = :document_id"),
        {"document_id": str(document_id)},
    )
    for draft in form_drafts:
        db.execute(
            text("DELETE FROM ai_form_drafts WHERE id = :draft_id"),
            {"draft_id": str(draft["id"])},
        )
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
        new_values={
            "ai_document_chunks_purged": True,
            "ai_form_drafts_purged": len(form_drafts),
        },
    )
    db.commit()
