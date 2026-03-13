from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import cast, select, String
from sqlalchemy.orm import Session

from app.models.role import Role
from app.models.user_role import UserRole


SYSTEM_ROLE_DEFINITIONS: dict[str, tuple[str, list[str]]] = {
    "super_admin": ("Super Admin", ["*"]),
    "org_admin": (
        "Organization Admin",
        [
            "users:manage",
            "roles:manage",
            "cases:view",
            "cases:create",
            "cases:edit",
            "cases:assign",
            "clients:view",
            "clients:create",
            "clients:edit",
            "documents:view",
            "documents:upload",
            "documents:approve",
            "reminders:view",
            "reminders:create",
            "reports:view",
            "settings:view",
            "settings:edit",
        ],
    ),
    "lawyer": (
        "Lawyer",
        [
            "cases:view",
            "cases:create",
            "cases:edit",
            "cases:assign",
            "clients:view",
            "clients:create",
            "clients:edit",
            "documents:view",
            "documents:upload",
            "documents:approve",
            "reminders:create",
            "reminders:view",
        ],
    ),
    "client": (
        "Client",
        [
            "own_case:view",
            "own_documents:upload",
            "own_reminders:view",
            "own_reminders:acknowledge",
            "own_payments:view",
        ],
    ),
}

ROLE_SLUG_ALIASES: dict[str, str] = {
    "admin": "org_admin",
}


def canonical_role_slug(value: str) -> str:
    normalized = value.strip().lower()
    return ROLE_SLUG_ALIASES.get(normalized, normalized)

ROLE_SWITCH_PRIORITY: tuple[str, ...] = (
    "lawyer",
    "org_admin",
    "super_admin",
    "client",
)


def ensure_system_role(db: Session, slug: str) -> Role:
    normalized_slug = canonical_role_slug(slug)
    role = db.scalar(
        select(Role).where(
            cast(Role.slug, String) == normalized_slug,
            Role.organization_id.is_(None),
        )
    )
    if role is not None:
        return role

    if normalized_slug not in SYSTEM_ROLE_DEFINITIONS:
        raise ValueError(f"Unknown role slug: {normalized_slug}")

    name, permissions = SYSTEM_ROLE_DEFINITIONS[normalized_slug]
    role = Role(
        organization_id=None,
        name=name,
        slug=normalized_slug,
        is_system=True,
        permissions=permissions,
    )
    db.add(role)
    db.flush()
    return role


def assign_role_to_user(
    db: Session,
    *,
    user_id: UUID,
    role_slug: str,
    assigned_by: Optional[UUID],
) -> None:
    role = ensure_system_role(db, role_slug)

    existing = db.scalar(
        select(UserRole).where(UserRole.user_id == user_id, UserRole.role_id == role.id)
    )
    if existing is not None:
        return

    db.add(
        UserRole(
            user_id=user_id,
            role_id=role.id,
            assigned_by=assigned_by,
            assigned_at=datetime.now(timezone.utc),
        )
    )


def get_user_roles(db: Session, user_id: UUID, organization_id: UUID) -> list[str]:
    rows = db.execute(
        select(Role.slug)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(
            UserRole.user_id == user_id,
            UserRole.expires_at.is_(None),
            (Role.organization_id.is_(None) | (Role.organization_id == organization_id)),
        )
    ).scalars().all()
    return sorted({str(row).lower() for row in rows})


def select_default_active_role(roles: list[str]) -> str | None:
    normalized = {canonical_role_slug(str(role)) for role in roles if str(role).strip()}
    for role in ROLE_SWITCH_PRIORITY:
        if role in normalized:
            return role
    if not normalized:
        return None
    return sorted(normalized)[0]


def revoke_role_from_user(
    db: Session,
    *,
    user_id: UUID,
    role_slug: str,
) -> bool:
    role = ensure_system_role(db, role_slug)
    existing = db.scalar(
        select(UserRole).where(UserRole.user_id == user_id, UserRole.role_id == role.id)
    )
    if existing is None:
        return False

    db.delete(existing)
    db.flush()
    return True
