"""Tenant-scoped privacy access, correction, and deletion request workflow."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, get_auth_context, require_roles
from app.db.deps import get_db
from app.models.privacy_request import PrivacyRequest
from app.schemas.privacy import (
    PrivacyRequestCreate,
    PrivacyRequestResponse,
    PrivacyRequestReview,
)
from app.services.audit import log_activity

router = APIRouter(prefix="/privacy", tags=["privacy"])


def _response(item: PrivacyRequest) -> PrivacyRequestResponse:
    return PrivacyRequestResponse(
        id=item.id,
        request_type=item.request_type,
        status=item.status,
        details=item.details,
        resolution_note=item.resolution_note,
        due_at=item.due_at,
        completed_at=item.completed_at,
        created_at=item.created_at,
    )


@router.post("/requests", response_model=PrivacyRequestResponse, status_code=status.HTTP_201_CREATED)
def create_privacy_request(
    payload: PrivacyRequestCreate,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> PrivacyRequestResponse:
    now = datetime.now(timezone.utc)
    existing = db.scalar(
        select(PrivacyRequest).where(
            PrivacyRequest.organization_id == auth.organization_id,
            PrivacyRequest.requested_by == auth.user_id,
            PrivacyRequest.request_type == payload.request_type,
            PrivacyRequest.status.in_(("submitted", "in_review", "blocked_legal_hold")),
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="An active request of this type already exists")

    item = PrivacyRequest(
        id=uuid4(),
        organization_id=auth.organization_id,
        requested_by=auth.user_id,
        request_type=payload.request_type,
        status="submitted",
        details=(payload.details or "").strip() or None,
        due_at=now + timedelta(days=30),
        created_at=now,
        updated_at=now,
    )
    db.add(item)
    log_activity(
        db,
        organization_id=auth.organization_id,
        user_id=auth.user_id,
        action="privacy_request_submitted",
        entity_type="privacy_request",
        entity_id=item.id,
        new_values={"request_type": item.request_type},
    )
    db.commit()
    return _response(item)


@router.get("/requests", response_model=list[PrivacyRequestResponse])
def list_own_privacy_requests(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[PrivacyRequestResponse]:
    items = db.scalars(
        select(PrivacyRequest)
        .where(
            PrivacyRequest.organization_id == auth.organization_id,
            PrivacyRequest.requested_by == auth.user_id,
        )
        .order_by(PrivacyRequest.created_at.desc())
    ).all()
    return [_response(item) for item in items]


@router.get("/admin/requests", response_model=list[PrivacyRequestResponse])
def list_organization_privacy_requests(
    auth: AuthContext = Depends(require_roles("org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> list[PrivacyRequestResponse]:
    items = db.scalars(
        select(PrivacyRequest)
        .where(PrivacyRequest.organization_id == auth.organization_id)
        .order_by(PrivacyRequest.due_at, PrivacyRequest.created_at)
    ).all()
    return [_response(item) for item in items]


@router.patch("/admin/requests/{request_id}", response_model=PrivacyRequestResponse)
def review_privacy_request(
    request_id: UUID,
    payload: PrivacyRequestReview,
    auth: AuthContext = Depends(require_roles("org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> PrivacyRequestResponse:
    item = db.scalar(
        select(PrivacyRequest)
        .where(
            PrivacyRequest.id == request_id,
            PrivacyRequest.organization_id == auth.organization_id,
        )
        .with_for_update()
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Privacy request not found")

    if item.request_type == "deletion" and payload.status == "completed":
        held_documents = db.scalar(
            text(
                """
                SELECT COUNT(*)
                FROM case_documents cd
                JOIN cases c ON c.id = cd.case_id
                WHERE c.organization_id = :organization_id
                  AND (c.client_id = :user_id OR cd.uploaded_by = :user_id)
                  AND cd.legal_hold = TRUE
                """
            ),
            {
                "organization_id": str(auth.organization_id),
                "user_id": str(item.requested_by),
            },
        )
        if int(held_documents or 0) > 0:
            raise HTTPException(
                status_code=409,
                detail="Deletion cannot complete while related records are under legal hold",
            )

    item.status = payload.status
    item.resolution_note = payload.resolution_note.strip()
    item.assigned_to = auth.user_id
    item.updated_at = datetime.now(timezone.utc)
    item.completed_at = (
        item.updated_at if payload.status in {"completed", "denied"} else None
    )
    db.add(item)
    log_activity(
        db,
        organization_id=auth.organization_id,
        user_id=auth.user_id,
        action="privacy_request_reviewed",
        entity_type="privacy_request",
        entity_id=item.id,
        new_values={"status": item.status},
    )
    db.commit()
    return _response(item)
