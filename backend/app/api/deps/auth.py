"""Authentication Dependencies: FastAPI dependency functions for JWT validation, user extraction, and role-based access enforcement."""
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
from app.services.sessions import get_active_session

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    user: User
    organization_id: UUID
    roles: list[str]
    active_role: str
    permissions: set[str]
    session_id: UUID

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
    session_id_raw = payload.get("sid")
    token_version_raw = payload.get("tv")
    token_active_role = canonical_role_slug(str(payload.get("active_role") or ""))

    if not user_id or not org_id or not session_id_raw or token_version_raw is None:
        raise _http_401("Malformed token")

    try:
        parsed_user_id = UUID(str(user_id))
        parsed_session_id = UUID(str(session_id_raw))
        token_version = int(token_version_raw)
    except (TypeError, ValueError) as exc:
        raise _http_401("Malformed token") from exc

    user = db.scalar(
        select(User).where(User.id == parsed_user_id, User.deleted_at.is_(None))
    )
    if user is None:
        raise _http_401("User not found")

    if str(user.organization_id) != str(org_id):
        raise _http_401("Tenant mismatch")

    if (user.status or "").strip().lower() != "active":
        raise _http_401("User account is not active")

    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise _http_401("User account is locked")

    if int(user.token_version or 0) != token_version:
        raise _http_401("Session has been revoked")

    if (
        get_active_session(
            db,
            session_id=parsed_session_id,
            user_id=parsed_user_id,
            token_version=token_version,
        )
        is None
    ):
        raise _http_401("Session has been revoked")

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

    return AuthContext(
        user=user,
        organization_id=user.organization_id,
        roles=normalized_roles,
        active_role=active_role,
        permissions=permissions,
        session_id=parsed_session_id,
    )


def require_roles(*required_roles: str):
    required = {canonical_role_slug(role) for role in required_roles}

    def _dependency(auth: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if required and auth.active_role not in required:
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

        if not required.issubset(auth.permissions):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permission privileges")

        return auth

    return _dependency
