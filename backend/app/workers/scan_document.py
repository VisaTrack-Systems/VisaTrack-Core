"""Quarantined document validation and antivirus promotion handler."""

from __future__ import annotations

import shlex
import subprocess
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.audit import log_activity
from app.services.jobs import register_handler
from app.services.storage import copy_object, delete_object, download_object


def _matches_declared_type(path: Path, content_type: str) -> bool:
    with path.open("rb") as source:
        header = source.read(16)
    if content_type == "application/pdf":
        return header.startswith(b"%PDF-")
    if content_type in {"image/jpeg", "image/jpg"}:
        return header.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        if not header.startswith(b"PK"):
            return False
        try:
            with zipfile.ZipFile(path) as archive:
                names = set(archive.namelist())
                return "[Content_Types].xml" in names and any(
                    name.startswith("word/") for name in names
                )
        except (OSError, zipfile.BadZipFile):
            return False
    return False


def _scan(path: Path) -> tuple[bool, str, str]:
    command = [*shlex.split(settings.document_scanner_command), "--no-summary", str(path)]
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=settings.document_scan_timeout_seconds,
        check=False,
    )
    output = (completed.stdout or completed.stderr or "").strip()
    if completed.returncode == 0:
        return True, output, _scanner_version()
    if completed.returncode == 1:
        return False, output or "Malware detected", _scanner_version()
    raise RuntimeError(f"Document scanner failed: {output or completed.returncode}")


def _scanner_version() -> str:
    command = [*shlex.split(settings.document_scanner_command), "--version"]
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=10,
        check=False,
    )
    return (completed.stdout or completed.stderr or "unknown").strip()[:100]


@register_handler("scan_document")
def scan_document(db: Session, payload: dict) -> None:
    document_id = UUID(str(payload["document_id"]))
    document = db.execute(
        text(
            """
            SELECT
                cd.id,
                cd.case_id,
                cd.file_path,
                cd.file_type,
                cd.scan_status,
                c.organization_id,
                c.client_id
            FROM case_documents cd
            JOIN cases c ON c.id = cd.case_id
            WHERE cd.id = :document_id AND cd.deleted_at IS NULL
            FOR UPDATE OF cd
            """
        ),
        {"document_id": str(document_id)},
    ).mappings().first()
    if document is None:
        return
    if document["scan_status"] == "clean":
        return

    db.execute(
        text(
            "UPDATE case_documents SET scan_status = 'scanning', updated_at = NOW() "
            "WHERE id = :document_id"
        ),
        {"document_id": str(document_id)},
    )
    db.commit()

    source_key = str(document["file_path"])
    with tempfile.NamedTemporaryFile() as temporary:
        try:
            download_object(object_key=source_key, destination=temporary)
            path = Path(temporary.name)
            if not _matches_declared_type(path, str(document["file_type"])):
                _reject(
                    db,
                    document,
                    source_key=source_key,
                    scan_status="invalid",
                    reason="File signature does not match declared content type",
                )
                return

            clean, detail, engine_version = _scan(path)
            if not clean:
                _reject(
                    db,
                    document,
                    source_key=source_key,
                    scan_status="infected",
                    reason=detail,
                    engine_version=engine_version,
                )
                return

            prefix = f"{settings.s3_quarantine_prefix}/"
            if not source_key.startswith(prefix):
                raise RuntimeError("Document is outside the quarantine prefix")
            clean_key = f"{settings.s3_clean_prefix}/{source_key[len(prefix):]}"
            copy_object(source_key=source_key, destination_key=clean_key)
            delete_object(object_key=source_key)
            db.execute(
                text(
                    """
                    UPDATE case_documents
                    SET file_path = :clean_key,
                        scan_status = 'clean',
                        scan_engine = :scan_engine,
                        scan_signature_version = :scan_signature_version,
                        scan_completed_at = NOW(),
                        scan_failure_reason = NULL,
                        status = 'received',
                        updated_at = NOW()
                    WHERE id = :document_id
                    """
                ),
                {
                    "clean_key": clean_key,
                    "scan_engine": "ClamAV",
                    "scan_signature_version": engine_version,
                    "document_id": str(document_id),
                },
            )
            log_activity(
                db,
                organization_id=document["organization_id"],
                user_id=None,
                action="scan_clean",
                entity_type="document",
                entity_id=document_id,
                case_id=document["case_id"],
                client_id=document["client_id"],
                new_values={"scan_engine": "ClamAV"},
            )
            db.commit()
        except Exception as exc:
            db.rollback()
            db.execute(
                text(
                    """
                    UPDATE case_documents
                    SET scan_status = 'failed',
                        scan_failure_reason = :reason,
                        updated_at = NOW()
                    WHERE id = :document_id
                    """
                ),
                {"reason": str(exc)[:2000], "document_id": str(document_id)},
            )
            db.commit()
            raise


def _reject(
    db: Session,
    document,
    *,
    source_key: str,
    scan_status: str,
    reason: str,
    engine_version: str | None = None,
) -> None:
    delete_object(object_key=source_key)
    db.execute(
        text(
            """
            UPDATE case_documents
            SET scan_status = :scan_status,
                scan_engine = 'ClamAV',
                scan_signature_version = :scan_signature_version,
                scan_completed_at = NOW(),
                scan_failure_reason = :reason,
                status = 'rejected',
                updated_at = NOW()
            WHERE id = :document_id
            """
        ),
        {
            "scan_status": scan_status,
            "scan_signature_version": engine_version,
            "reason": reason[:2000],
            "document_id": str(document["id"]),
        },
    )
    log_activity(
        db,
        organization_id=document["organization_id"],
        user_id=None,
        action=f"scan_{scan_status}",
        entity_type="document",
        entity_id=document["id"],
        case_id=document["case_id"],
        client_id=document["client_id"],
        new_values={"reason": reason[:500]},
    )
    db.commit()
