"""Extract searchable text from clean case documents without external AI calls."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.ai_documents import DocumentExtractionError, extract_document_chunks
from app.services.audit import log_activity
from app.services.jobs import register_handler
from app.services.storage import get_object_bytes


@register_handler("index_ai_document")
def index_ai_document(db: Session, payload: dict) -> None:
    document_id = UUID(str(payload["document_id"]))
    document = db.execute(
        text(
            """
            SELECT cd.id, cd.case_id, cd.file_path, cd.file_type, cd.scan_status,
                   c.organization_id, c.client_id
            FROM case_documents cd
            JOIN cases c ON c.id = cd.case_id
            WHERE cd.id = :document_id
              AND cd.deleted_at IS NULL
            FOR UPDATE OF cd
            """
        ),
        {"document_id": str(document_id)},
    ).mappings().first()
    if document is None or document["scan_status"] != "clean":
        return

    source = get_object_bytes(object_key=str(document["file_path"]))
    try:
        chunks = extract_document_chunks(source, str(document["file_type"]))
    except DocumentExtractionError as exc:
        db.execute(
            text("DELETE FROM ai_document_chunks WHERE case_document_id = :document_id"),
            {"document_id": str(document_id)},
        )
        log_activity(
            db,
            organization_id=document["organization_id"],
            user_id=None,
            action="ai_index_skipped",
            entity_type="document",
            entity_id=document_id,
            case_id=document["case_id"],
            client_id=document["client_id"],
            new_values={"reason": str(exc)[:300]},
        )
        db.commit()
        return

    db.execute(
        text("DELETE FROM ai_document_chunks WHERE case_document_id = :document_id"),
        {"document_id": str(document_id)},
    )
    for index, chunk in enumerate(chunks):
        db.execute(
            text(
                """
                INSERT INTO ai_document_chunks (
                    organization_id, case_id, case_document_id, page_number,
                    chunk_index, content
                ) VALUES (
                    :organization_id, :case_id, :document_id, :page_number,
                    :chunk_index, :content
                )
                """
            ),
            {
                "organization_id": str(document["organization_id"]),
                "case_id": str(document["case_id"]),
                "document_id": str(document_id),
                "page_number": chunk.page_number,
                "chunk_index": index,
                "content": chunk.content,
            },
        )
    log_activity(
        db,
        organization_id=document["organization_id"],
        user_id=None,
        action="ai_indexed",
        entity_type="document",
        entity_id=document_id,
        case_id=document["case_id"],
        client_id=document["client_id"],
        new_values={"chunk_count": len(chunks)},
    )
    db.commit()
