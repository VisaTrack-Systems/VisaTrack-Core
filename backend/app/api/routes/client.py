"""Client Routes: API endpoints for client management, profiles, and client-specific operations."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.api.deps.auth import AuthContext, require_roles
from app.db.deps import get_db
from app.models.case import Case
from app.models.case_client import CaseClient
from app.models.user import User
from app.schemas.client import ClientCaseListItem

router = APIRouter(prefix="/client", tags=["client"])

LEGACY_CASE_STATUS_MAP = {
    "document_collection": "awaiting_client",
    "additional_documents_requested": "awaiting_client",
    "rfe_received": "awaiting_client",
    "document_review": "in_progress",
    "application_prep": "in_progress",
    "ready_to_submit": "in_progress",
    "submitted": "in_progress",
    "under_review": "in_progress",
    "decision_pending": "in_progress",
    "approved": "closed",
    "refused": "closed",
    "withdrawn": "closed",
}


def _normalized_case_status(value: str) -> str:
    token = str(value).strip().lower().replace(" ", "_").replace("-", "_")
    return LEGACY_CASE_STATUS_MAP.get(token, token)


@router.get("/cases", response_model=list[ClientCaseListItem])
def list_client_cases(
    auth: AuthContext = Depends(require_roles("client")),
    db: Session = Depends(get_db),
) -> list[ClientCaseListItem]:
    lawyer_user = aliased(User)
    rows = db.execute(
        select(
            Case,
            lawyer_user.first_name,
            lawyer_user.last_name,
        )
        .join(CaseClient, CaseClient.case_id == Case.id)
        .outerjoin(lawyer_user, lawyer_user.id == Case.primary_lawyer_id)
        .where(
            Case.organization_id == auth.organization_id,
            Case.deleted_at.is_(None),
            CaseClient.client_user_id == auth.user_id,
            CaseClient.removed_at.is_(None),
        )
        .order_by(Case.created_at.desc())
    ).all()

    return [
        ClientCaseListItem(
            id=case.id,
            case_number=case.case_number,
            case_type=case.case_type,
            status=_normalized_case_status(case.status),
            priority=case.priority,
            primary_lawyer_name=(
                f"{lawyer_first} {lawyer_last}" if lawyer_first and lawyer_last else None
            ),
            target_filing_date=case.target_filing_date,
            created_at=case.created_at,
        )
        for case, lawyer_first, lawyer_last in rows
    ]


@router.get("/cases/{case_number}", response_model=ClientCaseListItem)
def get_client_case(
    case_number: str,
    auth: AuthContext = Depends(require_roles("client")),
    db: Session = Depends(get_db),
) -> ClientCaseListItem:
    lawyer_user = aliased(User)
    row = db.execute(
        select(
            Case,
            lawyer_user.first_name,
            lawyer_user.last_name,
        )
        .join(CaseClient, CaseClient.case_id == Case.id)
        .outerjoin(lawyer_user, lawyer_user.id == Case.primary_lawyer_id)
        .where(
            Case.organization_id == auth.organization_id,
            Case.case_number == case_number,
            Case.deleted_at.is_(None),
            CaseClient.client_user_id == auth.user_id,
            CaseClient.removed_at.is_(None),
        )
        .limit(1)
    ).first()

    if row is None:
        raise HTTPException(status_code=404, detail="Case not found")

    case, lawyer_first, lawyer_last = row
    return ClientCaseListItem(
        id=case.id,
        case_number=case.case_number,
        case_type=case.case_type,
        status=_normalized_case_status(case.status),
        priority=case.priority,
        primary_lawyer_name=(
            f"{lawyer_first} {lawyer_last}" if lawyer_first and lawyer_last else None
        ),
        target_filing_date=case.target_filing_date,
        created_at=case.created_at,
    )
