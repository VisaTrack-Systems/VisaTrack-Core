"""Lawyer Routes: API endpoints for lawyer profile, workload, and lawyer-specific operations."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, func, select, text
from sqlalchemy.orm import Session, aliased

from app.api.deps.auth import AuthContext, require_roles
from app.core.config import settings
from app.core.security import generate_invitation_token, hash_invitation_token, hash_password
from app.db.deps import get_db
from app.models.case import Case
from app.models.case_client import CaseClient
from app.models.organization import Organization
from app.models.role import Role
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.models.user_profile import UserProfile
from app.models.user_role import UserRole
from app.schemas.case import CaseListItem
from app.schemas.lawyer import (
    InviteClientRequest,
    InviteClientResponse,
    LawyerCaseCreateRequest,
    LawyerClientCreateRequest,
    LawyerClientCreateResponse,
    LawyerProfileResponse,
    LawyerProfileUpsertRequest,
)
from app.schemas.user import UserListItem
from app.services.audit import log_activity
from app.services.rbac import assign_role_to_user

router = APIRouter(prefix="/lawyer", tags=["lawyer"])

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


def _normalize_email(value: str) -> str:
    normalized = value.strip().lower()
    if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
        raise HTTPException(status_code=400, detail="Invalid email address")
    return normalized


def _case_number_next(db: Session, organization_id: UUID) -> str:
    year = datetime.now(timezone.utc).year
    prefix_like = f"C-{year}-%"
    capture_pattern = f"^C-{year}-([0-9]+)$"
    max_suffix = db.execute(
        text(
            """
            SELECT COALESCE(MAX(CAST(substring(case_number FROM :capture_pattern) AS INTEGER)), 0)
            FROM cases
            WHERE organization_id = :organization_id
              AND deleted_at IS NULL
              AND case_number LIKE :prefix_like
            """
        ),
        {
            "organization_id": organization_id,
            "prefix_like": prefix_like,
            "capture_pattern": capture_pattern,
        },
    ).scalar_one()
    return f"C-{year}-{int(max_suffix) + 1:03d}"


@router.get("/profile", response_model=LawyerProfileResponse)
def get_lawyer_profile(
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> LawyerProfileResponse:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == auth.user_id))
    if profile is None:
        return LawyerProfileResponse(
            user_id=auth.user_id,
            user_type="lawyer",
            bar_number=None,
            specialties=[],
            years_experience=None,
            bio=None,
            hourly_rate=None,
            onboarding_complete=False,
        )

    onboarding_complete = bool((profile.bar_number or "").strip())
    return LawyerProfileResponse(
        user_id=auth.user_id,
        user_type=profile.user_type,
        bar_number=profile.bar_number,
        specialties=profile.specialties or [],
        years_experience=profile.years_experience,
        bio=profile.bio,
        hourly_rate=float(profile.hourly_rate) if profile.hourly_rate is not None else None,
        onboarding_complete=onboarding_complete,
    )


@router.get("/clients", response_model=list[UserListItem])
def list_lawyer_clients(
    search: Optional[str] = Query(default=None, max_length=120),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> list[UserListItem]:
    now = datetime.now(timezone.utc)
    stmt = (
        select(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(
            User.organization_id == auth.organization_id,
            User.deleted_at.is_(None),
            cast(User.status, String).in_(["active", "invited"]),
            cast(Role.slug, String) == "client",
            (UserRole.expires_at.is_(None) | (UserRole.expires_at > now)),
            (Role.organization_id.is_(None) | (Role.organization_id == auth.organization_id)),
        )
        .distinct()
        .order_by(User.created_at.desc())
    )

    if search:
        normalized = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            func.lower(User.email).like(normalized)
            | func.lower(User.first_name).like(normalized)
            | func.lower(User.last_name).like(normalized)
        )

    users = db.scalars(stmt.limit(limit).offset(offset)).all()
    return [
        UserListItem(
            id=user.id,
            email=user.email,
            full_name=f"{user.first_name} {user.last_name}",
            status=user.status,
            organization_id=user.organization_id,
            created_at=user.created_at,
        )
        for user in users
    ]


@router.post("/clients", response_model=LawyerClientCreateResponse, status_code=status.HTTP_201_CREATED)
def create_lawyer_client(
    payload: LawyerClientCreateRequest,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> LawyerClientCreateResponse:
    now = datetime.now(timezone.utc)
    email = _normalize_email(payload.email)

    user = db.scalar(
        select(User).where(
            cast(User.email, String) == email,
            User.organization_id == auth.organization_id,
            User.deleted_at.is_(None),
        )
    )

    created_new = False
    if user is None:
        user = User(
            organization_id=auth.organization_id,
            email=email,
            password_hash=hash_password(generate_invitation_token()),
            first_name=payload.first_name.strip(),
            last_name=payload.last_name.strip(),
            status="invited",
        )
        db.add(user)
        db.flush()
        created_new = True
    else:
        if not user.first_name.strip():
            user.first_name = payload.first_name.strip()
        if not user.last_name.strip():
            user.last_name = payload.last_name.strip()
        db.add(user)
        db.flush()

    assign_role_to_user(db, user_id=user.id, role_slug="client", assigned_by=auth.user_id)

    invitation_url = None
    if payload.send_invite:
        plain_token = generate_invitation_token()
        invitation = UserInvitation(
            organization_id=auth.organization_id,
            user_id=user.id,
            email=email,
            role_slug="client",
            token_hash=hash_invitation_token(plain_token),
            expires_at=now + timedelta(hours=settings.invitation_expiry_hours),
            invited_by=auth.user_id,
        )
        db.add(invitation)
        invitation_url = f"{settings.frontend_origin.split(',')[0].strip().rstrip('/')}/invite#token={plain_token}"

    log_activity(
        db,
        organization_id=auth.organization_id,
        user_id=auth.user_id,
        action="created" if created_new else "assigned",
        entity_type="client",
        entity_id=user.id,
        client_id=user.id,
        new_values={
            "email": user.email,
            "status": user.status,
        },
    )

    db.commit()

    org = db.scalar(select(Organization).where(Organization.id == auth.organization_id))
    org_name = org.name if org else "VisaTrack"

    return LawyerClientCreateResponse(
        user_id=user.id,
        email=user.email,
        full_name=f"{user.first_name} {user.last_name}",
        status=user.status,
        organization_name=org_name,
        invitation_url=invitation_url,
    )


@router.put("/profile", response_model=LawyerProfileResponse)
def upsert_lawyer_profile(
    payload: LawyerProfileUpsertRequest,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> LawyerProfileResponse:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == auth.user_id))
    if profile is None:
        profile = UserProfile(user_id=auth.user_id, user_type="lawyer")

    profile.user_type = "lawyer"
    profile.bar_number = payload.bar_number.strip() if payload.bar_number else None
    profile.specialties = [item.strip() for item in payload.specialties if item.strip()]
    profile.years_experience = payload.years_experience
    profile.bio = payload.bio
    profile.hourly_rate = payload.hourly_rate
    profile.updated_at = datetime.now(timezone.utc)

    db.add(profile)
    log_activity(
        db,
        organization_id=auth.organization_id,
        user_id=auth.user_id,
        action="updated",
        entity_type="user_profile",
        entity_id=auth.user_id,
        new_values={
            "bar_number": profile.bar_number,
            "specialties": profile.specialties,
        },
    )
    db.commit()

    onboarding_complete = bool((profile.bar_number or "").strip())
    return LawyerProfileResponse(
        user_id=auth.user_id,
        user_type=profile.user_type,
        bar_number=profile.bar_number,
        specialties=profile.specialties or [],
        years_experience=profile.years_experience,
        bio=profile.bio,
        hourly_rate=float(profile.hourly_rate) if profile.hourly_rate is not None else None,
        onboarding_complete=onboarding_complete,
    )


@router.get("/cases", response_model=list[CaseListItem])
def list_lawyer_cases(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> list[CaseListItem]:
    client_user = aliased(User)
    lawyer_user = aliased(User)

    stmt = (
        select(
            Case,
            client_user.first_name,
            client_user.last_name,
            lawyer_user.first_name,
            lawyer_user.last_name,
        )
        .join(client_user, client_user.id == Case.client_id)
        .outerjoin(lawyer_user, lawyer_user.id == Case.primary_lawyer_id)
        .where(Case.deleted_at.is_(None), Case.organization_id == auth.organization_id)
        .order_by(Case.created_at.desc())
    )

    if auth.active_role not in {"super_admin", "org_admin"}:
        stmt = stmt.where((Case.primary_lawyer_id == auth.user_id) | (Case.created_by == auth.user_id))

    rows = db.execute(stmt.limit(limit).offset(offset)).all()

    return [
        CaseListItem(
            id=case.id,
            organization_id=case.organization_id,
            case_number=case.case_number,
            case_type=case.case_type,
            status=_normalized_case_status(case.status),
            priority=case.priority,
            client_name=f"{client_first} {client_last}",
            primary_lawyer_name=(
                f"{lawyer_first} {lawyer_last}" if case.primary_lawyer_id else None
            ),
            target_filing_date=case.target_filing_date,
            created_at=case.created_at,
        )
        for case, client_first, client_last, lawyer_first, lawyer_last in rows
    ]


@router.post("/cases", response_model=CaseListItem, status_code=status.HTTP_201_CREATED)
def create_lawyer_case(
    payload: LawyerCaseCreateRequest,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> CaseListItem:
    client_user = db.scalar(
        select(User).where(
            User.id == payload.client_user_id,
            User.organization_id == auth.organization_id,
            User.deleted_at.is_(None),
        )
    )
    if client_user is None:
        raise HTTPException(status_code=400, detail="Client user not found in organization")

    case_number = _case_number_next(db, auth.organization_id)

    new_case = Case(
        organization_id=auth.organization_id,
        case_number=case_number,
        client_id=client_user.id,
        primary_lawyer_id=auth.user_id,
        case_type=payload.case_type.strip(),
        status="intake",
        priority=payload.priority.strip().lower(),
        target_filing_date=payload.target_filing_date,
        description=payload.description,
        created_by=auth.user_id,
    )
    db.add(new_case)
    db.flush()

    db.add(
        CaseClient(
            case_id=new_case.id,
            client_user_id=client_user.id,
            relationship_type="primary",
            status="active",
            invited_by=auth.user_id,
        )
    )

    log_activity(
        db,
        organization_id=auth.organization_id,
        user_id=auth.user_id,
        action="created",
        entity_type="case",
        entity_id=new_case.id,
        case_id=new_case.id,
        client_id=client_user.id,
        new_values={
            "case_number": new_case.case_number,
            "case_type": new_case.case_type,
            "priority": new_case.priority,
        },
    )

    db.commit()
    db.refresh(new_case)

    return CaseListItem(
        id=new_case.id,
        organization_id=new_case.organization_id,
        case_number=new_case.case_number,
        case_type=new_case.case_type,
        status=_normalized_case_status(new_case.status),
        priority=new_case.priority,
        client_name=f"{client_user.first_name} {client_user.last_name}",
        primary_lawyer_name=f"{auth.user.first_name} {auth.user.last_name}",
        target_filing_date=new_case.target_filing_date,
        created_at=new_case.created_at,
    )


@router.post("/cases/{case_number}/clients/invite", response_model=InviteClientResponse)
def invite_client_to_case(
    case_number: str,
    payload: InviteClientRequest,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> InviteClientResponse:
    case = db.scalar(
        select(Case).where(
            Case.case_number == case_number,
            Case.organization_id == auth.organization_id,
            Case.deleted_at.is_(None),
        )
    )
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    if auth.active_role not in {"super_admin", "org_admin"}:
        if case.primary_lawyer_id != auth.user_id and case.created_by != auth.user_id:
            raise HTTPException(status_code=403, detail="Not authorized to invite clients for this case")

    email = _normalize_email(payload.email)

    invited_user = db.scalar(
        select(User).where(
            cast(User.email, String) == email,
            User.organization_id == auth.organization_id,
            User.deleted_at.is_(None),
        )
    )

    if invited_user is None:
        placeholder_password = hash_password(generate_invitation_token())
        invited_user = User(
            organization_id=auth.organization_id,
            email=email,
            password_hash=placeholder_password,
            first_name=payload.first_name.strip(),
            last_name=payload.last_name.strip(),
            status="invited",
        )
        db.add(invited_user)
        db.flush()

    assign_role_to_user(db, user_id=invited_user.id, role_slug="client", assigned_by=auth.user_id)

    case_client = db.scalar(
        select(CaseClient).where(
            CaseClient.case_id == case.id,
            CaseClient.client_user_id == invited_user.id,
            CaseClient.removed_at.is_(None),
        )
    )
    if case_client is None:
        db.add(
            CaseClient(
                case_id=case.id,
                client_user_id=invited_user.id,
                relationship_type=payload.relationship_type.strip().lower(),
                status="active",
                invited_by=auth.user_id,
            )
        )

    plain_token = generate_invitation_token()
    invitation = UserInvitation(
        organization_id=auth.organization_id,
        user_id=invited_user.id,
        email=email,
        role_slug="client",
        token_hash=hash_invitation_token(plain_token),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.invitation_expiry_hours),
        invited_by=auth.user_id,
    )
    db.add(invitation)

    log_activity(
        db,
        organization_id=auth.organization_id,
        user_id=auth.user_id,
        action="invited",
        entity_type="client",
        entity_id=invited_user.id,
        case_id=case.id,
        client_id=invited_user.id,
        metadata={"case_number": case.case_number, "email": email},
    )

    db.commit()

    invitation_url = f"{settings.frontend_origin.split(',')[0].strip().rstrip('/')}/invite#token={plain_token}"
    return InviteClientResponse(
        case_number=case.case_number,
        client_email=email,
        invited_user_id=invited_user.id,
        invitation_url=invitation_url,
    )
