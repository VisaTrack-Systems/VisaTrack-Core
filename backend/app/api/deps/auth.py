from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.deps import get_db
from app.models.role import Role
from app.models.user import User
from app.models.user_role import UserRole
from app.services.rbac import canonical_role_slug, select_default_active_role

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    user: User
    organization_id: UUID
    roles: list[str]
    active_role: str
    permissions: set[str]

    @property
    def user_id(self) -> UUID:
        return self.user.id


def _http_401(detail: str = "Authentication required") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def get_auth_context(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AuthContext:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _http_401()

    token = credentials.credentials

    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError as exc:
        raise _http_401("Invalid or expired token") from exc

    user_id = payload.get("sub")
    org_id = payload.get("org")
    token_roles = payload.get("roles", [])
    token_active_role = canonical_role_slug(str(payload.get("active_role") or ""))

    if not user_id or not org_id:
        raise _http_401("Malformed token")

    user = db.scalar(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    if user is None:
        raise _http_401("User not found")

    if str(user.organization_id) != str(org_id):
        raise _http_401("Tenant mismatch")

    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise _http_401("User account is locked")

    now = datetime.now(timezone.utc)
    db_role_rows = db.execute(
        select(Role.slug, Role.permissions)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(
            UserRole.user_id == user.id,
            (UserRole.expires_at.is_(None) | (UserRole.expires_at > now)),
            Role.organization_id.is_(None) | (Role.organization_id == user.organization_id),
        )
    ).all()

    normalized_roles = sorted(
        {canonical_role_slug(str(row.slug)) for row in db_role_rows}
        | {canonical_role_slug(str(role)) for role in token_roles}
    )
    active_role = token_active_role if token_active_role in normalized_roles else select_default_active_role(normalized_roles)
    if active_role is None:
        raise _http_401("No active role assigned")

    role_permissions: dict[str, set[str]] = {}
    for row in db_role_rows:
        role_slug = canonical_role_slug(str(row.slug))
        role_permissions.setdefault(role_slug, set())
        for perm in (row.permissions or []):
            cleaned = str(perm).strip()
            if cleaned:
                role_permissions[role_slug].add(cleaned)

    permissions = set(role_permissions.get(active_role, set()))

    # Backward compatible: if token roles include a super admin role but DB perms are missing,
    # treat it as full access (DB should still be source of truth).
    if active_role == "super_admin" and "super_admin" in normalized_roles:
        permissions.add("*")

    return AuthContext(
        user=user,
        organization_id=user.organization_id,
        roles=normalized_roles,
        active_role=active_role,
        permissions=permissions,
    )


def require_roles(*required_roles: str):
    required = {role.lower() for role in required_roles}

    def _dependency(auth: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if required and not required.intersection(set(auth.roles)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role privileges")
        return auth

    return _dependency


def require_permissions(*required_permissions: str):
    required = {perm.strip() for perm in required_permissions if perm and perm.strip()}

    def _dependency(auth: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if not required:
            return auth

        if "*" in auth.permissions:
            return auth

        if not required.intersection(auth.permissions):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permission privileges")

        return auth

    return _dependency
