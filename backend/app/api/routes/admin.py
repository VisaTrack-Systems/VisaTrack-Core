"""Administration Routes: API endpoints for system administration, user invites, and org-level management."""
import re
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import parse_qs, urlparse
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, and_, cast, func, select
from sqlalchemy.orm import Session, aliased

from app.api.deps.auth import AuthContext, require_permissions, require_roles
from app.core.config import settings
from app.core.security import generate_invitation_token, hash_invitation_token, hash_password
from app.db.deps import get_db
from app.models.case import Case
from app.models.organization import Organization
from app.models.role import Role
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.models.user_role import UserRole
from app.schemas.admin import (
    AdminAssignRoleRequest,
    AdminCaseAssignmentRequest,
    AdminCaseAssignmentResponse,
    AdminCreateOrganizationRequest,
    AdminCreateUserRequest,
    AdminCreateUserResponse,
    AdminOperationsResponse,
    InvitationStyles,
    InvitationTemplateRequest,
    InvitationTemplateResponse,
    ResendInvitationResponse,
    SendInvitationEmailRequest,
    AdminOpsCaseItem,
    AdminOpsInvitationItem,
    AdminOpsLawyerWorkloadItem,
    AdminOverviewCase,
    AdminOverviewOrganization,
    AdminOverviewResponse,
    AdminOverviewStats,
    AdminOverviewUser,
    AdminRoleItem,
)
from app.schemas.organization import OrganizationRead
from app.schemas.user import UserListItem
from sqlalchemy.orm.attributes import flag_modified

from app.services.audit import log_activity
from app.services.email import DEFAULT_INVITATION_TEMPLATE, EmailNotConfiguredError, send_invitation_email
from app.services.rbac import assign_role_to_user, canonical_role_slug, revoke_role_from_user

router = APIRouter(prefix="/admin", tags=["admin"])


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


def _slugify(value: str) -> str:
    lowered = value.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")
    return slug


def _normalize_email(value: str) -> str:
    normalized = value.strip().lower()
    if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
        raise HTTPException(status_code=400, detail="Invalid email address")
    return normalized


def _invitation_token_from_url(invitation_url: str) -> str:
    parsed = urlparse(invitation_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    allowed_origins = {value.rstrip("/") for value in settings.frontend_origins}
    if origin not in allowed_origins or parsed.path.rstrip("/") != "/invite":
        raise HTTPException(status_code=400, detail="Invalid invitation link")

    tokens = parse_qs(parsed.query).get("token", [])
    if len(tokens) != 1 or not tokens[0]:
        raise HTTPException(status_code=400, detail="Invalid invitation link")
    return tokens[0]


def _is_super_admin(auth: AuthContext) -> bool:
    return auth.active_role == "super_admin"


def _require_active_super_admin(auth: AuthContext) -> None:
    if not _is_super_admin(auth):
        raise HTTPException(status_code=403, detail="Super admin role is required for this action")


def _require_org_scope(auth: AuthContext, organization_id: UUID) -> None:
    if _is_super_admin(auth):
        return
    if auth.organization_id != organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access is not allowed")


def _require_delegable_role(auth: AuthContext, role_slug: str) -> str:
    normalized_role = canonical_role_slug(role_slug)
    if normalized_role == "super_admin" and not _is_super_admin(auth):
        raise HTTPException(
            status_code=403,
            detail="Only an active super admin can manage the super admin role",
        )
    return normalized_role


def _list_user_roles(
    db: Session,
    *,
    user_ids: list[UUID],
) -> dict[UUID, list[str]]:
    if not user_ids:
        return {}

    now = datetime.now(timezone.utc)
    rows = db.execute(
        select(UserRole.user_id, Role.slug)
        .join(Role, Role.id == UserRole.role_id)
        .join(User, User.id == UserRole.user_id)
        .where(
            UserRole.user_id.in_(user_ids),
            (UserRole.expires_at.is_(None) | (UserRole.expires_at > now)),
            (Role.organization_id.is_(None) | (Role.organization_id == User.organization_id)),
        )
    ).all()

    roles_by_user: dict[UUID, set[str]] = {user_id: set() for user_id in user_ids}
    for row in rows:
        roles_by_user.setdefault(row.user_id, set()).add(canonical_role_slug(str(row.slug)))

    return {user_id: sorted(roles) for user_id, roles in roles_by_user.items()}


def _is_active_case_status(value: str) -> bool:
    return _normalized_case_status(value) != "closed"


def _resolve_admin_org_scope(auth: AuthContext, organization_id: Optional[UUID]) -> UUID:
    if not isinstance(organization_id, UUID):
        return auth.organization_id
    _require_org_scope(auth, organization_id)
    return organization_id


@router.get("/overview", response_model=AdminOverviewResponse)
def get_admin_overview(
    auth: AuthContext = Depends(require_roles("org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> AdminOverviewResponse:
    org_filter = [] if _is_super_admin(auth) else [Case.organization_id == auth.organization_id]
    user_filter = [] if _is_super_admin(auth) else [User.organization_id == auth.organization_id]
    organization_filter = [] if _is_super_admin(auth) else [Organization.id == auth.organization_id]

    organizations_count = db.scalar(
        select(func.count())
        .select_from(Organization)
        .where(Organization.deleted_at.is_(None), *organization_filter)
    ) or 0
    users_count = db.scalar(
        select(func.count()).select_from(User).where(User.deleted_at.is_(None), *user_filter)
    ) or 0
    active_users_count = db.scalar(
        select(func.count())
        .select_from(User)
        .where(User.deleted_at.is_(None), cast(User.status, String) == "active", *user_filter)
    ) or 0
    active_cases_count = db.scalar(
        select(func.count())
        .select_from(Case)
        .where(
            Case.deleted_at.is_(None),
            cast(Case.status, String) != "closed",
            *org_filter,
        )
    ) or 0
    completed_cases_count = db.scalar(
        select(func.count())
        .select_from(Case)
        .where(
            Case.deleted_at.is_(None),
            cast(Case.status, String) == "closed",
            *org_filter,
        )
    ) or 0

    recent_organizations_rows = db.execute(
        select(Organization)
        .where(Organization.deleted_at.is_(None), *organization_filter)
        .order_by(Organization.created_at.desc())
        .limit(5)
    ).scalars().all()

    recent_users_rows = db.execute(
        select(User)
        .where(User.deleted_at.is_(None), *user_filter)
        .order_by(User.created_at.desc())
        .limit(5)
    ).scalars().all()

    client_user = aliased(User)
    recent_cases_stmt = (
        select(
            Case.id,
            Case.case_number,
            Case.case_type,
            Case.status,
            Case.priority,
            Case.created_at,
            client_user.first_name,
            client_user.last_name,
        )
        .join(client_user, client_user.id == Case.client_id)
        .where(Case.deleted_at.is_(None), *org_filter)
        .order_by(Case.created_at.desc())
        .limit(5)
    )
    recent_cases_rows = db.execute(recent_cases_stmt).all()

    return AdminOverviewResponse(
        stats=AdminOverviewStats(
            organizations=organizations_count,
            users=users_count,
            active_users=active_users_count,
            active_cases=active_cases_count,
            completed_cases=completed_cases_count,
        ),
        recent_organizations=[
            AdminOverviewOrganization(
                id=org.id,
                name=org.name,
                slug=org.slug,
                contact_email=org.contact_email,
                subscription_status=org.subscription_status,
                created_at=org.created_at,
            )
            for org in recent_organizations_rows
        ],
        recent_users=[
            AdminOverviewUser(
                id=user.id,
                organization_id=user.organization_id,
                email=user.email,
                full_name=f"{user.first_name} {user.last_name}",
                status=user.status,
                created_at=user.created_at,
            )
            for user in recent_users_rows
        ],
        recent_cases=[
            AdminOverviewCase(
                id=row.id,
                case_number=row.case_number,
                case_type=row.case_type,
                status=_normalized_case_status(row.status),
                priority=row.priority,
                client_name=f"{row.first_name} {row.last_name}",
                created_at=row.created_at,
            )
            for row in recent_cases_rows
        ],
    )


@router.get("/organizations", response_model=list[OrganizationRead])
def list_admin_organizations(
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(require_permissions("settings:view")),
    db: Session = Depends(get_db),
) -> list[OrganizationRead]:
    stmt = select(Organization).where(Organization.deleted_at.is_(None)).order_by(Organization.created_at.desc())
    if not _is_super_admin(auth):
        stmt = stmt.where(Organization.id == auth.organization_id)
    return list(db.scalars(stmt.limit(limit).offset(offset)).all())


@router.post("/organizations", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
def create_organization(
    payload: AdminCreateOrganizationRequest,
    auth: AuthContext = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> OrganizationRead:
    _require_active_super_admin(auth)

    slug = _slugify(payload.slug)
    if not slug:
        raise HTTPException(status_code=400, detail="Invalid organization slug")

    existing_slug = db.scalar(
        select(Organization.id).where(
            cast(Organization.slug, String) == slug,
            Organization.deleted_at.is_(None),
        )
    )
    if existing_slug is not None:
        raise HTTPException(status_code=409, detail="Organization slug already exists")

    new_org = Organization(
        name=payload.name.strip(),
        slug=slug,
        contact_email=_normalize_email(payload.contact_email),
        subscription_tier=payload.subscription_tier.strip().lower(),
        subscription_status=payload.subscription_status.strip().lower(),
    )
    db.add(new_org)
    db.flush()

    log_activity(
        db,
        organization_id=new_org.id,
        user_id=auth.user_id,
        action="created",
        entity_type="organization",
        entity_id=new_org.id,
        new_values={"name": new_org.name, "slug": new_org.slug},
    )

    db.commit()
    db.refresh(new_org)
    return new_org


@router.delete("/organizations/{organization_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization(
    organization_id: UUID,
    auth: AuthContext = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> None:
    _require_active_super_admin(auth)

    organization = db.scalar(
        select(Organization).where(Organization.id == organization_id, Organization.deleted_at.is_(None))
    )
    if organization is None:
        raise HTTPException(status_code=404, detail="Organization not found")

    if organization.id == auth.organization_id:
        raise HTTPException(status_code=400, detail="You cannot delete your active organization")

    now = datetime.now(timezone.utc)
    organization.deleted_at = now
    db.add(organization)

    log_activity(
        db,
        organization_id=organization.id,
        user_id=auth.user_id,
        action="deleted",
        entity_type="organization",
        entity_id=organization.id,
        new_values={"name": organization.name, "slug": organization.slug},
    )

    db.commit()


@router.get("/operations", response_model=AdminOperationsResponse)
def get_admin_operations(
    organization_id: Optional[UUID] = Query(default=None),
    auth: AuthContext = Depends(require_roles("org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> AdminOperationsResponse:
    scoped_org_id = _resolve_admin_org_scope(auth, organization_id)
    now = datetime.now(timezone.utc)

    primary_lawyer = aliased(User)
    active_case_rows = db.execute(
        select(
            Case.id,
            Case.case_number,
            Case.case_type,
            Case.status,
            Case.priority,
            Case.created_at,
            Case.primary_lawyer_id,
            primary_lawyer.first_name,
            primary_lawyer.last_name,
        )
        .outerjoin(primary_lawyer, primary_lawyer.id == Case.primary_lawyer_id)
        .where(
            Case.organization_id == scoped_org_id,
            Case.deleted_at.is_(None),
        )
        .order_by(Case.created_at.asc())
    ).all()

    active_case_items = []
    for row in active_case_rows:
        if not _is_active_case_status(row.status):
            continue
        days_open = max(0, (now - row.created_at).days)
        lawyer_name = None
        if row.first_name and row.last_name:
            lawyer_name = f"{row.first_name} {row.last_name}"
        active_case_items.append(
            AdminOpsCaseItem(
                case_id=row.id,
                case_number=row.case_number,
                case_type=row.case_type,
                status=_normalized_case_status(row.status),
                priority=row.priority,
                created_at=row.created_at,
                days_open=days_open,
                primary_lawyer_id=row.primary_lawyer_id,
                primary_lawyer_name=lawyer_name,
            )
        )

    unassigned_cases = sorted(
        [item for item in active_case_items if item.primary_lawyer_id is None],
        key=lambda item: item.created_at,
    )[:20]
    aging_cases = sorted(active_case_items, key=lambda item: item.days_open, reverse=True)[:20]

    lawyer_rows = db.execute(
        select(User.id, User.first_name, User.last_name)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(
            User.organization_id == scoped_org_id,
            User.deleted_at.is_(None),
            cast(User.status, String) == "active",
            cast(Role.slug, String) == "lawyer",
            (UserRole.expires_at.is_(None) | (UserRole.expires_at > now)),
            (Role.organization_id.is_(None) | (Role.organization_id == scoped_org_id)),
        )
        .distinct()
        .order_by(User.first_name.asc(), User.last_name.asc())
    ).all()
    case_count_by_lawyer: dict[UUID, int] = {}
    for item in active_case_items:
        if item.primary_lawyer_id is None:
            continue
        case_count_by_lawyer[item.primary_lawyer_id] = case_count_by_lawyer.get(item.primary_lawyer_id, 0) + 1

    lawyer_workload = [
        AdminOpsLawyerWorkloadItem(
            lawyer_user_id=row.id,
            full_name=f"{row.first_name} {row.last_name}",
            active_cases=case_count_by_lawyer.get(row.id, 0),
        )
        for row in lawyer_rows
    ]

    invited_by_user = aliased(User)
    invitation_rows = db.execute(
        select(
            UserInvitation.id,
            UserInvitation.user_id,
            UserInvitation.email,
            UserInvitation.role_slug,
            UserInvitation.created_at,
            UserInvitation.expires_at,
            UserInvitation.accepted_at,
            UserInvitation.revoked_at,
            invited_by_user.first_name,
            invited_by_user.last_name,
        )
        .outerjoin(invited_by_user, invited_by_user.id == UserInvitation.invited_by)
        .where(UserInvitation.organization_id == scoped_org_id)
        .order_by(UserInvitation.created_at.desc())
        .limit(100)
    ).all()

    invitations: list[AdminOpsInvitationItem] = []
    for row in invitation_rows:
        if row.accepted_at is not None:
            status_value = "accepted"
        elif row.revoked_at is not None:
            status_value = "revoked"
        elif row.expires_at < now:
            status_value = "expired"
        else:
            status_value = "pending"

        # Skip accepted and revoked; include pending and expired
        if status_value in ("accepted", "revoked"):
            continue

        invited_by_name = None
        if row.first_name and row.last_name:
            invited_by_name = f"{row.first_name} {row.last_name}"

        invitations.append(
            AdminOpsInvitationItem(
                invitation_id=row.id,
                user_id=row.user_id,
                email=row.email,
                role_slug=row.role_slug,
                created_at=row.created_at,
                expires_at=row.expires_at,
                status=status_value,
                invited_by_name=invited_by_name,
            )
        )

    return AdminOperationsResponse(
        organization_id=scoped_org_id,
        unassigned_cases=unassigned_cases,
        aging_cases=aging_cases,
        lawyer_workload=lawyer_workload,
        invitations=invitations,
    )


@router.post("/cases/{case_number}/assign", response_model=AdminCaseAssignmentResponse)
def assign_case_lawyer(
    case_number: str,
    payload: AdminCaseAssignmentRequest,
    auth: AuthContext = Depends(require_roles("org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> AdminCaseAssignmentResponse:
    case_stmt = select(Case).where(Case.case_number == case_number, Case.deleted_at.is_(None))
    if not _is_super_admin(auth):
        case_stmt = case_stmt.where(Case.organization_id == auth.organization_id)

    case = db.scalar(case_stmt)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    _require_org_scope(auth, case.organization_id)

    assigned_lawyer_name: Optional[str] = None
    if payload.lawyer_user_id is not None:
        now = datetime.now(timezone.utc)
        lawyer = db.scalar(
            select(User)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                User.id == payload.lawyer_user_id,
                User.organization_id == case.organization_id,
                User.deleted_at.is_(None),
                cast(User.status, String) == "active",
                cast(Role.slug, String) == "lawyer",
                (UserRole.expires_at.is_(None) | (UserRole.expires_at > now)),
                (Role.organization_id.is_(None) | (Role.organization_id == case.organization_id)),
            )
        )
        if lawyer is None:
            raise HTTPException(status_code=400, detail="Selected user is not an active lawyer in this organization")
        case.primary_lawyer_id = lawyer.id
        assigned_lawyer_name = f"{lawyer.first_name} {lawyer.last_name}"
    else:
        case.primary_lawyer_id = None

    db.add(case)
    log_activity(
        db,
        organization_id=case.organization_id,
        user_id=auth.user_id,
        action="assigned",
        entity_type="case",
        entity_id=case.id,
        new_values={
            "case_number": case.case_number,
            "primary_lawyer_id": str(case.primary_lawyer_id) if case.primary_lawyer_id else None,
        },
    )
    db.commit()

    return AdminCaseAssignmentResponse(
        case_id=case.id,
        case_number=case.case_number,
        primary_lawyer_id=case.primary_lawyer_id,
        primary_lawyer_name=assigned_lawyer_name,
    )


@router.post("/invitations/{invitation_id}/revoke", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invitation(
    invitation_id: UUID,
    auth: AuthContext = Depends(require_roles("org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> None:
    invitation = db.scalar(select(UserInvitation).where(UserInvitation.id == invitation_id))
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found")

    _require_org_scope(auth, invitation.organization_id)

    if invitation.accepted_at is not None:
        raise HTTPException(status_code=400, detail="Accepted invitation cannot be revoked")
    if invitation.revoked_at is not None:
        return

    invitation.revoked_at = datetime.now(timezone.utc)
    db.add(invitation)
    log_activity(
        db,
        organization_id=invitation.organization_id,
        user_id=auth.user_id,
        action="revoked",
        entity_type="invitation",
        entity_id=invitation.id,
        new_values={"email": invitation.email, "role_slug": invitation.role_slug},
    )
    db.commit()


@router.post("/invitations/{invitation_id}/resend")
def resend_invitation(
    invitation_id: UUID,
    auth: AuthContext = Depends(require_roles("org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> ResendInvitationResponse:
    invitation = db.scalar(select(UserInvitation).where(UserInvitation.id == invitation_id))
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found")

    _require_org_scope(auth, invitation.organization_id)

    if invitation.accepted_at is not None:
        raise HTTPException(status_code=400, detail="Accepted invitations cannot be resent")
    if invitation.revoked_at is not None:
        raise HTTPException(status_code=400, detail="Revoked invitations cannot be resent")

    now = datetime.now(timezone.utc)
    if invitation.expires_at > now:
        raise HTTPException(status_code=400, detail="Invitation has not expired yet")

    plain_token = generate_invitation_token()
    invitation.token_hash = hash_invitation_token(plain_token)
    invitation.expires_at = now + timedelta(hours=settings.invitation_expiry_hours)
    invitation.invited_by = auth.user_id
    db.add(invitation)
    log_activity(
        db,
        organization_id=invitation.organization_id,
        user_id=auth.user_id,
        action="resent",
        entity_type="invitation",
        entity_id=invitation.id,
        new_values={"email": invitation.email, "role_slug": invitation.role_slug},
    )
    db.commit()

    primary_origin = settings.frontend_origin.split(",")[0].strip().rstrip("/")
    invitation_url = f"{primary_origin}/invite?token={plain_token}"
    return ResendInvitationResponse(invitation_url=invitation_url)


@router.post("/send-invitation-email", status_code=status.HTTP_204_NO_CONTENT)
def send_invitation_email_endpoint(
    payload: SendInvitationEmailRequest,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> None:
    normalized_email = _normalize_email(payload.to_email)
    plain_token = _invitation_token_from_url(payload.invitation_url)
    now = datetime.now(timezone.utc)
    invitation = db.scalar(
        select(UserInvitation).where(
            UserInvitation.organization_id == auth.organization_id,
            cast(UserInvitation.email, String) == normalized_email,
            UserInvitation.token_hash == hash_invitation_token(plain_token),
            UserInvitation.accepted_at.is_(None),
            UserInvitation.revoked_at.is_(None),
            UserInvitation.expires_at > now,
        )
    )
    if invitation is None:
        raise HTTPException(status_code=404, detail="Active invitation not found")

    invited_user = db.scalar(
        select(User).where(
            User.id == invitation.user_id,
            User.organization_id == auth.organization_id,
            User.deleted_at.is_(None),
        )
    )
    if invited_user is None:
        raise HTTPException(status_code=404, detail="Invited user not found")

    # Look up the org's custom invitation template and style options.
    org = db.scalar(select(Organization).where(Organization.id == auth.organization_id))
    body_template: str | None = None
    styles_data: dict = {}
    if org is not None:
        email_templates = (org.settings or {}).get("email_templates", {})
        body_template = email_templates.get("invitation") or None
        styles_data = email_templates.get("invitation_styles", {})

    org_name = org.name if org is not None else "VisaTrack"
    recipient_name = f"{invited_user.first_name} {invited_user.last_name}".strip()

    try:
        send_invitation_email(
            to_email=normalized_email,
            recipient_name=recipient_name,
            invitation_url=payload.invitation_url,
            organization_name=org_name,
            body_template=body_template,
            button_color=styles_data.get("button_color", "#dc2626"),
            button_label=styles_data.get("button_label", "Activate my account"),
            subject_template=styles_data.get("subject") or None,
            bold_org_name=styles_data.get("bold_org_name", True),
        )
    except EmailNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail="Invitation email is unavailable") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to send invitation email") from exc


@router.get("/email-templates/invitation")
def get_invitation_template(
    auth: AuthContext = Depends(require_roles("org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> InvitationTemplateResponse:
    org = db.scalar(select(Organization).where(Organization.id == auth.organization_id))
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")

    email_templates = (org.settings or {}).get("email_templates", {})
    custom_body: str | None = email_templates.get("invitation") or None
    invitation_type = email_templates.get("invitation_type", "plain")
    # Discard old HTML templates — the HTML editor no longer exists.
    if invitation_type == "html":
        custom_body = None
    styles_data = email_templates.get("invitation_styles", {})
    styles = InvitationStyles(
        button_color=styles_data.get("button_color", "#dc2626"),
        button_label=styles_data.get("button_label", "Activate my account"),
        subject=styles_data.get("subject", "You have been invited to join {organization_name}"),
        bold_org_name=styles_data.get("bold_org_name", True),
    )
    return InvitationTemplateResponse(
        body=custom_body if custom_body else DEFAULT_INVITATION_TEMPLATE,
        is_custom=custom_body is not None,
        styles=styles,
    )


@router.put("/email-templates/invitation", status_code=status.HTTP_204_NO_CONTENT)
def save_invitation_template(
    payload: InvitationTemplateRequest,
    auth: AuthContext = Depends(require_roles("org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> None:
    org = db.scalar(select(Organization).where(Organization.id == auth.organization_id))
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Build a fresh dict so SQLAlchemy detects the mutation on the JSONB column.
    new_settings = dict(org.settings or {})
    new_settings["email_templates"] = dict(new_settings.get("email_templates", {}))

    raw_body = payload.body.strip()
    if raw_body:
        new_settings["email_templates"]["invitation"] = raw_body
        new_settings["email_templates"]["invitation_type"] = "plain"
        new_settings["email_templates"]["invitation_styles"] = payload.styles.model_dump()
    else:
        # Empty body means "reset to default" — remove body, type, and styles.
        new_settings["email_templates"].pop("invitation", None)
        new_settings["email_templates"].pop("invitation_type", None)
        new_settings["email_templates"].pop("invitation_styles", None)

    org.settings = new_settings
    flag_modified(org, "settings")
    db.add(org)
    log_activity(
        db,
        organization_id=org.id,
        user_id=auth.user_id,
        action="updated",
        entity_type="email_template",
        entity_id=org.id,
        new_values={"template": "invitation", "is_custom": bool(raw_body)},
    )
    db.commit()


@router.get("/roles", response_model=list[AdminRoleItem])
def list_roles(
    auth: AuthContext = Depends(require_permissions("roles:manage")),
    db: Session = Depends(get_db),
) -> list[AdminRoleItem]:
    stmt = select(Role).where(Role.organization_id.is_(None) | (Role.organization_id == auth.organization_id))
    roles = db.scalars(stmt.order_by(Role.is_system.desc(), Role.name.asc())).all()
    return [
        AdminRoleItem(
            id=role.id,
            organization_id=role.organization_id,
            name=role.name,
            slug=role.slug,
            description=role.description,
            is_system=role.is_system,
            permissions=role.permissions,
        )
        for role in roles
    ]


@router.get("/users", response_model=list[UserListItem])
def list_admin_users(
    organization_id: Optional[UUID] = Query(default=None),
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(require_permissions("users:manage")),
    db: Session = Depends(get_db),
) -> list[UserListItem]:
    stmt = select(User).where(User.deleted_at.is_(None)).order_by(User.created_at.desc())

    requested_org_id = organization_id if isinstance(organization_id, UUID) else auth.organization_id
    if _is_super_admin(auth):
        if organization_id is not None:
            stmt = stmt.where(User.organization_id == organization_id)
    else:
        _require_org_scope(auth, requested_org_id)
        stmt = stmt.where(User.organization_id == auth.organization_id)

    users = db.scalars(stmt.limit(limit).offset(offset)).all()
    roles_by_user = _list_user_roles(
        db,
        user_ids=[user.id for user in users],
    )
    return [
        UserListItem(
            id=user.id,
            email=user.email,
            full_name=f"{user.first_name} {user.last_name}",
            status=user.status,
            organization_id=user.organization_id,
            created_at=user.created_at,
            roles=roles_by_user.get(user.id, []),
        )
        for user in users
    ]


@router.post("/users", response_model=AdminCreateUserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: AdminCreateUserRequest,
    auth: AuthContext = Depends(require_permissions("users:manage")),
    db: Session = Depends(get_db),
) -> AdminCreateUserResponse:
    _require_org_scope(auth, payload.organization_id)
    normalized_role = _require_delegable_role(auth, payload.role_slug)

    normalized_status = payload.status.strip().lower()
    is_invited = normalized_status == "invited"

    if not is_invited and not payload.password:
        raise HTTPException(status_code=400, detail="Password is required for non-invited users")

    organization_exists = db.scalar(
        select(Organization.id).where(
            Organization.id == payload.organization_id,
            Organization.deleted_at.is_(None),
        )
    )
    if organization_exists is None:
        raise HTTPException(status_code=400, detail="Organization not found")

    normalized_email = _normalize_email(payload.email)
    existing_user = db.scalar(
        select(User.id).where(
            cast(User.email, String) == normalized_email,
            User.organization_id == payload.organization_id,
            User.deleted_at.is_(None),
        )
    )
    if existing_user is not None:
        raise HTTPException(status_code=409, detail="User email already exists in organization")

    if is_invited:
        password_hash = hash_password(generate_invitation_token())
    else:
        try:
            password_hash = hash_password(payload.password)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    new_user = User(
        organization_id=payload.organization_id,
        email=normalized_email,
        password_hash=password_hash,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        status=normalized_status,
    )
    db.add(new_user)
    db.flush()

    assign_role_to_user(
        db,
        user_id=new_user.id,
        role_slug=normalized_role,
        assigned_by=auth.user_id,
    )

    invitation_url: str | None = None
    if is_invited:
        now = datetime.now(timezone.utc)
        plain_token = generate_invitation_token()
        invitation = UserInvitation(
            organization_id=payload.organization_id,
            user_id=new_user.id,
            email=normalized_email,
            role_slug=normalized_role,
            token_hash=hash_invitation_token(plain_token),
            expires_at=now + timedelta(hours=settings.invitation_expiry_hours),
            invited_by=auth.user_id,
        )
        db.add(invitation)
        primary_origin = settings.frontend_origin.split(",")[0].strip().rstrip("/")
        invitation_url = f"{primary_origin}/invite?token={plain_token}"

    log_activity(
        db,
        organization_id=payload.organization_id,
        user_id=auth.user_id,
        action="created",
        entity_type="user",
        entity_id=new_user.id,
        new_values={"email": new_user.email, "role": normalized_role, "invited": is_invited},
    )

    db.commit()
    db.refresh(new_user)

    return AdminCreateUserResponse(
        id=new_user.id,
        email=new_user.email,
        full_name=f"{new_user.first_name} {new_user.last_name}",
        status=new_user.status,
        organization_id=new_user.organization_id,
        created_at=new_user.created_at,
        roles=[normalized_role],
        invitation_url=invitation_url,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    auth: AuthContext = Depends(require_permissions("users:manage")),
    db: Session = Depends(get_db),
) -> None:
    user = db.scalar(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    _require_org_scope(auth, user.organization_id)

    if user.id == auth.user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    now = datetime.now(timezone.utc)
    user.deleted_at = now
    user.status = "disabled"
    user.updated_at = now
    db.add(user)

    log_activity(
        db,
        organization_id=user.organization_id,
        user_id=auth.user_id,
        action="deleted",
        entity_type="user",
        entity_id=user.id,
        new_values={"email": user.email},
    )

    db.commit()


@router.post("/users/{user_id}/roles", status_code=status.HTTP_204_NO_CONTENT)
def assign_user_role(
    user_id: UUID,
    payload: AdminAssignRoleRequest,
    auth: AuthContext = Depends(require_permissions("users:manage", "roles:manage")),
    db: Session = Depends(get_db),
) -> None:
    user = db.scalar(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    _require_org_scope(auth, user.organization_id)
    normalized_role = _require_delegable_role(auth, payload.role_slug)

    assign_role_to_user(
        db,
        user_id=user.id,
        role_slug=normalized_role,
        assigned_by=auth.user_id,
    )

    log_activity(
        db,
        organization_id=user.organization_id,
        user_id=auth.user_id,
        action="assigned",
        entity_type="role",
        entity_id=user.id,
        new_values={"role_slug": normalized_role},
    )

    db.commit()


@router.delete("/users/{user_id}/roles/{role_slug}", status_code=status.HTTP_204_NO_CONTENT)
def remove_user_role(
    user_id: UUID,
    role_slug: str,
    auth: AuthContext = Depends(require_permissions("users:manage", "roles:manage")),
    db: Session = Depends(get_db),
) -> None:
    user = db.scalar(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    _require_org_scope(auth, user.organization_id)

    normalized_role = _require_delegable_role(auth, role_slug)
    if user.id == auth.user_id and normalized_role in {"org_admin", "super_admin"}:
        raise HTTPException(status_code=400, detail="You cannot remove your own admin role")

    removed = revoke_role_from_user(
        db,
        user_id=user.id,
        role_slug=normalized_role,
    )
    if not removed:
        raise HTTPException(status_code=404, detail="Role assignment not found")

    log_activity(
        db,
        organization_id=user.organization_id,
        user_id=auth.user_id,
        action="removed",
        entity_type="role",
        entity_id=user.id,
        new_values={"role_slug": normalized_role},
    )

    db.commit()
