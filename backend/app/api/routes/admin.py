import re
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, and_, cast, func, select
from sqlalchemy.orm import Session, aliased

from app.api.deps.auth import AuthContext, require_permissions, require_roles
from app.core.security import hash_password
from app.db.deps import get_db
from app.models.case import Case
from app.models.organization import Organization
from app.models.role import Role
from app.models.user import User
from app.models.user_role import UserRole
from app.schemas.admin import (
    AdminAssignRoleRequest,
    AdminCreateOrganizationRequest,
    AdminCreateUserRequest,
    AdminOverviewCase,
    AdminOverviewOrganization,
    AdminOverviewResponse,
    AdminOverviewStats,
    AdminOverviewUser,
    AdminRoleItem,
)
from app.schemas.organization import OrganizationRead
from app.schemas.user import UserListItem
from app.services.audit import log_activity
from app.services.rbac import assign_role_to_user

router = APIRouter(prefix="/admin", tags=["admin"])


def _slugify(value: str) -> str:
    lowered = value.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")
    return slug


def _normalize_email(value: str) -> str:
    normalized = value.strip().lower()
    if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
        raise HTTPException(status_code=400, detail="Invalid email address")
    return normalized


def _is_super_admin(auth: AuthContext) -> bool:
    return "super_admin" in auth.roles


def _require_org_scope(auth: AuthContext, organization_id: UUID) -> None:
    if _is_super_admin(auth):
        return
    if auth.organization_id != organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access is not allowed")


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
            cast(Case.status, String).notin_(["approved", "refused", "withdrawn", "closed"]),
            *org_filter,
        )
    ) or 0
    completed_cases_count = db.scalar(
        select(func.count())
        .select_from(Case)
        .where(
            Case.deleted_at.is_(None),
            cast(Case.status, String).in_(["approved", "closed"]),
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
                status=row.status,
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
    auth: AuthContext = Depends(require_permissions("*")),
    db: Session = Depends(get_db),
) -> OrganizationRead:
    slug = payload.slug.strip().lower() if payload.slug else _slugify(payload.name)
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
    return OrganizationRead.model_validate(new_org)


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

    requested_org_id = organization_id if organization_id is not None else auth.organization_id
    if _is_super_admin(auth):
        if organization_id is not None:
            stmt = stmt.where(User.organization_id == organization_id)
    else:
        _require_org_scope(auth, requested_org_id)
        stmt = stmt.where(User.organization_id == auth.organization_id)

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


@router.post("/users", response_model=UserListItem, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: AdminCreateUserRequest,
    auth: AuthContext = Depends(require_permissions("users:manage")),
    db: Session = Depends(get_db),
) -> UserListItem:
    _require_org_scope(auth, payload.organization_id)

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
        status=payload.status.strip().lower(),
    )
    db.add(new_user)
    db.flush()

    assign_role_to_user(
        db,
        user_id=new_user.id,
        role_slug=payload.role_slug.strip().lower(),
        assigned_by=auth.user_id,
    )

    log_activity(
        db,
        organization_id=payload.organization_id,
        user_id=auth.user_id,
        action="created",
        entity_type="user",
        entity_id=new_user.id,
        new_values={"email": new_user.email, "role": payload.role_slug.strip().lower()},
    )

    db.commit()
    db.refresh(new_user)

    return UserListItem(
        id=new_user.id,
        email=new_user.email,
        full_name=f"{new_user.first_name} {new_user.last_name}",
        status=new_user.status,
        organization_id=new_user.organization_id,
        created_at=new_user.created_at,
    )


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

    assign_role_to_user(
        db,
        user_id=user.id,
        role_slug=payload.role_slug.strip().lower(),
        assigned_by=auth.user_id,
    )

    log_activity(
        db,
        organization_id=user.organization_id,
        user_id=auth.user_id,
        action="assigned",
        entity_type="role",
        entity_id=user.id,
        new_values={"role_slug": payload.role_slug.strip().lower()},
    )

    db.commit()
