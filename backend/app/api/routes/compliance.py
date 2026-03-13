"""Compliance routes: data deletion requests and consents (SOC 2 / privacy)."""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, require_roles
from app.db.deps import get_db
from app.schemas.compliance import (
    ConsentCreate,
    ConsentItem,
    DataDeletionRequestCreate,
    DataDeletionRequestItem,
)

router = APIRouter(prefix="/compliance", tags=["compliance"])


def _table_exists(db: Session, table: str) -> bool:
    r = db.execute(
        text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :t"
        ),
        {"t": table},
    )
    return r.scalar() is not None


# ---- Data deletion requests ----


@router.post(
    "/data-deletion-requests",
    response_model=DataDeletionRequestItem,
    status_code=status.HTTP_201_CREATED,
)
def create_data_deletion_request(
    payload: DataDeletionRequestCreate,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> DataDeletionRequestItem:
    if not _table_exists(db, "data_deletion_requests"):
        raise HTTPException(status_code=501, detail="Table not available; run Phase 5 migration")
    try:
        r = db.execute(
            text(
                """
                INSERT INTO data_deletion_requests
                (organization_id, requester_user_id, subject_type, subject_id, scope, status, notes)
                VALUES (:organization_id, :requester_user_id, :subject_type, :subject_id, :scope, 'pending', :notes)
                RETURNING id, organization_id, requester_user_id, subject_type, subject_id, scope, status,
                          approved_by, approved_at, completed_at, notes, created_at
                """
            ),
            {
                "organization_id": str(auth.organization_id),
                "requester_user_id": str(auth.user_id),
                "subject_type": payload.subject_type,
                "subject_id": str(payload.subject_id),
                "scope": payload.scope,
                "notes": payload.notes,
            },
        ).first()
        db.commit()
        m = r._mapping if hasattr(r, "_mapping") else r
        return DataDeletionRequestItem(
            id=m["id"],
            organization_id=m["organization_id"],
            requester_user_id=m["requester_user_id"],
            subject_type=m["subject_type"],
            subject_id=m["subject_id"],
            scope=m["scope"],
            status=m["status"],
            approved_by=m["approved_by"],
            approved_at=m["approved_at"],
            completed_at=m["completed_at"],
            notes=m["notes"],
            created_at=m["created_at"],
        )
    except ProgrammingError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get(
    "/data-deletion-requests",
    response_model=List[DataDeletionRequestItem],
)
def list_data_deletion_requests(
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> List[DataDeletionRequestItem]:
    if not _table_exists(db, "data_deletion_requests"):
        return []
    try:
        rows = db.execute(
            text(
                """
                SELECT id, organization_id, requester_user_id, subject_type, subject_id, scope, status,
                       approved_by, approved_at, completed_at, notes, created_at
                FROM data_deletion_requests
                WHERE organization_id = :org_id
                ORDER BY created_at DESC
                """
            ),
            {"org_id": str(auth.organization_id)},
        ).fetchall()
        return [_row_to_deletion_request(r) for r in rows]
    except ProgrammingError:
        return []


def _row_to_deletion_request(r) -> DataDeletionRequestItem:
    m = r._mapping if hasattr(r, "_mapping") else r
    return DataDeletionRequestItem(
        id=m["id"],
        organization_id=m["organization_id"],
        requester_user_id=m["requester_user_id"],
        subject_type=m["subject_type"],
        subject_id=m["subject_id"],
        scope=m["scope"],
        status=m["status"],
        approved_by=m["approved_by"],
        approved_at=m["approved_at"],
        completed_at=m["completed_at"],
        notes=m["notes"],
        created_at=m["created_at"],
    )


# ---- Consents ----


@router.post(
    "/consents",
    response_model=ConsentItem,
    status_code=status.HTTP_201_CREATED,
)
def create_consent(
    payload: ConsentCreate,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> ConsentItem:
    if not _table_exists(db, "consents"):
        raise HTTPException(status_code=501, detail="Table not available; run Phase 5 migration")
    try:
        import json
        r = db.execute(
            text(
                """
                INSERT INTO consents
                (organization_id, subject_type, subject_id, consent_type, granted, granted_by, metadata)
                VALUES (:organization_id, :subject_type, :subject_id, :consent_type, :granted, :granted_by, CAST(:metadata AS jsonb))
                RETURNING id, organization_id, subject_type, subject_id, consent_type, granted, granted_at,
                          granted_by, revoked_at, metadata, created_at
                """
            ),
            {
                "organization_id": str(auth.organization_id),
                "subject_type": payload.subject_type,
                "subject_id": str(payload.subject_id),
                "consent_type": payload.consent_type,
                "granted": payload.granted,
                "granted_by": str(auth.user_id),
                "metadata": json.dumps(payload.metadata) if payload.metadata else None,
            },
        ).first()
        db.commit()
        m = r._mapping if hasattr(r, "_mapping") else r
        return ConsentItem(
            id=m["id"],
            organization_id=m["organization_id"],
            subject_type=m["subject_type"],
            subject_id=m["subject_id"],
            consent_type=m["consent_type"],
            granted=m["granted"],
            granted_at=m["granted_at"],
            granted_by=m["granted_by"],
            revoked_at=m["revoked_at"],
            metadata=m["metadata"],
            created_at=m["created_at"],
        )
    except ProgrammingError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get(
    "/consents",
    response_model=List[ConsentItem],
)
def list_consents(
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> List[ConsentItem]:
    if not _table_exists(db, "consents"):
        return []
    try:
        rows = db.execute(
            text(
                """
                SELECT id, organization_id, subject_type, subject_id, consent_type, granted, granted_at,
                       granted_by, revoked_at, metadata, created_at
                FROM consents
                WHERE organization_id = :org_id
                ORDER BY created_at DESC
                """
            ),
            {"org_id": str(auth.organization_id)},
        ).fetchall()
        def _row_to_consent(r):
            m = r._mapping if hasattr(r, "_mapping") else r
            return ConsentItem(
                id=m["id"],
                organization_id=m["organization_id"],
                subject_type=m["subject_type"],
                subject_id=m["subject_id"],
                consent_type=m["consent_type"],
                granted=m["granted"],
                granted_at=m["granted_at"],
                granted_by=m["granted_by"],
                revoked_at=m["revoked_at"],
                metadata=m["metadata"],
                created_at=m["created_at"],
            )
        return [_row_to_consent(r) for r in rows]
    except ProgrammingError:
        return []
