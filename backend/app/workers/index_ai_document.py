"""Extract searchable text from clean case documents without external AI calls."""

from __future__ import annotations

import hashlib
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.ai_documents import DocumentExtractionError, extract_document_chunks
from app.services.audit import log_activity
from app.services.jobs import register_handler
from app.services.storage import get_object_bytes

EXTRACTOR_VERSION = "local-text-v1"


@register_handler("index_ai_document")
def index_ai_document(db: Session, payload: dict) -> None:
    if not settings.ai_enabled:
        return
    document_id = UUID(str(payload["document_id"]))
    document = db.execute(
        text(
            """
            SELECT cd.id, cd.case_id, cd.file_path, cd.file_type, cd.file_hash,
                   cd.scan_status, cd.scan_completed_at,
                   c.organization_id, c.client_id
            FROM case_documents cd
            JOIN cases c ON c.id = cd.case_id
            WHERE cd.id = :document_id
              AND cd.deleted_at IS NULL
            """
        ),
        {"document_id": str(document_id)},
    ).mappings().first()
    if (
        document is None
        or document["scan_status"] != "clean"
        or document["scan_completed_at"] is None
        or not document["file_hash"]
    ):
        return
    if not settings.ai_enabled_for_organization(document["organization_id"]):
        return
    if not str(document["file_path"]).startswith(f"{settings.s3_clean_prefix}/"):
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
            new_values={"reason": "Document is outside approved clean storage"},
        )
        db.commit()
        return

    db.commit()
    source = get_object_bytes(object_key=str(document["file_path"]))
    source_sha256 = hashlib.sha256(source).hexdigest()
    if source_sha256 != str(document["file_hash"]).lower():
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
            new_values={"reason": "Document digest does not match clean scan provenance"},
        )
        db.commit()
        return
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

    current_document = db.execute(
        text(
            """
            SELECT file_path, file_hash, scan_status, scan_completed_at
            FROM case_documents
            WHERE id = :document_id
              AND deleted_at IS NULL
            FOR UPDATE
            """
        ),
        {"document_id": str(document_id)},
    ).mappings().first()
    if (
        current_document is None
        or current_document["scan_status"] != "clean"
        or current_document["scan_completed_at"] is None
        or str(current_document["file_hash"]).lower() != source_sha256
        or str(current_document["file_path"]) != str(document["file_path"])
    ):
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
                    chunk_index, content, source_sha256, extractor_version
                ) VALUES (
                    :organization_id, :case_id, :document_id, :page_number,
                    :chunk_index, :content, :source_sha256, :extractor_version
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
                "source_sha256": source_sha256,
                "extractor_version": EXTRACTOR_VERSION,
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
        new_values={
            "chunk_count": len(chunks),
            "source_sha256": source_sha256,
            "extractor_version": EXTRACTOR_VERSION,
        },
    )
    db.commit()
