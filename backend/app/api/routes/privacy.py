"""Tenant-scoped privacy access, correction, and deletion request workflow."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import String, cast, func, select, text
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, get_auth_context, require_roles
from app.db.deps import get_db
from app.models.organization import Organization
from app.models.privacy_request import PrivacyRequest
from app.models.user import User
from app.models.user_profile import UserProfile
from app.schemas.privacy import (
    PrivacyRequestCreate,
    PrivacyRequestResponse,
    PrivacyRequestReview,
    PublicDeletionRequest,
    PublicDeletionResponse,
    UnsubscribeRequest,
    UnsubscribeResponse,
)
from app.services.audit import log_activity
from app.services.email_compliance import verify_unsubscribe_token

_PUBLIC_DELETION_MESSAGE = (
    "If an account matches this email, we will review the deletion request within 30 days."
)
_EMAIL_PREF_KEYS = (
    "email_case_updates",
    "email_documents",
    "email_payments",
    "sms_urgent",
)

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


@router.post(
    "/deletion-requests",
    response_model=PublicDeletionResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def request_account_deletion(
    payload: PublicDeletionRequest,
    db: Session = Depends(get_db),
) -> PublicDeletionResponse:
    """Record a deletion request without revealing whether the account exists."""
    slug = payload.organization_slug.strip().lower()
    email = payload.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=422, detail="Enter the email on the account")

    organization = db.scalar(
        select(Organization).where(
            func.lower(cast(Organization.slug, String)) == slug,
            Organization.deleted_at.is_(None),
        )
    )
    user = None
    if organization is not None:
        user = db.scalar(
            select(User).where(
                User.organization_id == organization.id,
                func.lower(cast(User.email, String)) == email,
                User.deleted_at.is_(None),
            )
        )

    if user is not None and organization is not None:
        existing = db.scalar(
            select(PrivacyRequest).where(
                PrivacyRequest.organization_id == organization.id,
                PrivacyRequest.requested_by == user.id,
                PrivacyRequest.request_type == "deletion",
                PrivacyRequest.status.in_(("submitted", "in_review", "blocked_legal_hold")),
            )
        )
        if existing is None:
            now = datetime.now(timezone.utc)
            item = PrivacyRequest(
                id=uuid4(),
                organization_id=organization.id,
                requested_by=user.id,
                request_type="deletion",
                status="submitted",
                details=(payload.details or "").strip() or None,
                due_at=now + timedelta(days=30),
                created_at=now,
                updated_at=now,
            )
            db.add(item)
            log_activity(
                db,
                organization_id=organization.id,
                user_id=user.id,
                action="privacy_request_submitted",
                entity_type="privacy_request",
                entity_id=item.id,
                new_values={"request_type": "deletion", "source": "public_form"},
            )
            db.commit()

    return PublicDeletionResponse(status="accepted", message=_PUBLIC_DELETION_MESSAGE)


@router.post("/unsubscribe", response_model=UnsubscribeResponse)
def unsubscribe_from_emails(
    payload: UnsubscribeRequest,
    db: Session = Depends(get_db),
) -> UnsubscribeResponse:
    email = payload.email.strip().lower()
    if not verify_unsubscribe_token(email, payload.token):
        raise HTTPException(status_code=400, detail="This unsubscribe link is invalid")

    users = db.scalars(
        select(User).where(
            func.lower(cast(User.email, String)) == email,
            User.deleted_at.is_(None),
        )
    ).all()
    for user in users:
        profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
        if profile is None:
            continue
        preferences = dict(profile.notification_prefs or {})
        for key in _EMAIL_PREF_KEYS:
            preferences[key] = False
        profile.notification_prefs = preferences
        db.add(profile)
    if users:
        db.commit()

    return UnsubscribeResponse(status="unsubscribed")
