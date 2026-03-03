from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.deps import get_db
from app.models.role import Role
from app.models.user import User
from app.models.user_role import UserRole

# RLS: session variables set per-request (Phase 2 pattern).
# app.org_id / app.user_id / app.role drive tenant + client/lawyer policies.
# Super-admin can bypass with app.bypass_rls = true.
RLS_ORG_ID_VAR = "app.org_id"
RLS_USER_ID_VAR = "app.user_id"
RLS_ROLE_VAR = "app.role"
RLS_BYPASS_VAR = "app.bypass_rls"
# Legacy name (downgraded RLS migration may still reference this)
RLS_LEGACY_ORG_VAR = "app.current_organization_id"

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    user: User
    organization_id: UUID
    roles: list[str]
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
        {str(row.slug).lower() for row in db_role_rows} | {str(role).lower() for role in token_roles}
    )

    permissions: set[str] = set()
    for row in db_role_rows:
        for perm in (row.permissions or []):
            permissions.add(str(perm).strip())

    # Backward compatible: if token roles include a super admin role but DB perms are missing,
    # treat it as full access (DB should still be source of truth).
    if "super_admin" in normalized_roles:
        permissions.add("*")

    # Set RLS session variables (Phase 2: app.org_id, app.user_id, app.role, app.bypass_rls).
    # set_config(..., true) = transaction-local; resets at commit/rollback, safe for connection pooling.
    db.execute(
        text("SELECT set_config(:var, :val, true)"),
        {"var": RLS_ORG_ID_VAR, "val": str(user.organization_id)},
    )
    db.execute(
        text("SELECT set_config(:var, :val, true)"),
        {"var": RLS_USER_ID_VAR, "val": str(user.id)},
    )
    # Primary role for RLS policy: client > lawyer > org_admin > super_admin (most restrictive first).
    rls_role = "client" if "client" in normalized_roles else (
        "lawyer" if "lawyer" in normalized_roles else (
            "org_admin" if "org_admin" in normalized_roles else "super_admin"
        )
    )
    db.execute(
        text("SELECT set_config(:var, :val, true)"),
        {"var": RLS_ROLE_VAR, "val": rls_role},
    )
    db.execute(
        text("SELECT set_config(:var, :val, true)"),
        {"var": RLS_BYPASS_VAR, "val": "true" if "super_admin" in normalized_roles else "false"},
    )
    # Legacy: some environments may still use app.current_organization_id (e.g. before Phase 2 migration).
    db.execute(
        text("SELECT set_config(:var, :val, true)"),
        {"var": RLS_LEGACY_ORG_VAR, "val": str(user.organization_id)},
    )

    return AuthContext(
        user=user,
        organization_id=user.organization_id,
        roles=normalized_roles,
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
