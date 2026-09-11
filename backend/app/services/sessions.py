"""Server-side session creation, refresh rotation, reuse detection, and revocation."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.models.user_session import SessionRefreshToken, UserSession


class InvalidRefreshToken(Exception):
    pass


class RefreshTokenReuse(InvalidRefreshToken):
    pass


@dataclass(frozen=True)
class SessionCredentials:
    session: UserSession
    refresh_token: str


def hash_refresh_token(token: str) -> str:
    return hmac.new(
        settings.auth_secret_key.encode("utf-8"),
        token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def hash_ip_address(ip_address: str | None) -> str | None:
    if not ip_address:
        return None
    return hmac.new(
        settings.auth_secret_key.encode("utf-8"),
        ip_address.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def create_session(
    db: Session,
    *,
    user: User,
    active_role: str,
    user_agent: str | None,
    ip_address: str | None,
) -> SessionCredentials:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=settings.auth_refresh_token_days)
    browser_session = UserSession(
        id=uuid4(),
        user_id=user.id,
        family_id=uuid4(),
        active_role=active_role,
        token_version=int(user.token_version or 0),
        user_agent=(user_agent or "")[:512] or None,
        ip_address_hash=hash_ip_address(ip_address),
        created_at=now,
        last_seen_at=now,
        expires_at=expires_at,
    )
    raw_token = _new_refresh_token()
    db.add(browser_session)
    db.add(
        SessionRefreshToken(
            session_id=browser_session.id,
            token_hash=hash_refresh_token(raw_token),
            created_at=now,
            expires_at=expires_at,
        )
    )
    db.flush()
    return SessionCredentials(session=browser_session, refresh_token=raw_token)


def rotate_refresh_token(db: Session, raw_token: str) -> SessionCredentials:
    now = datetime.now(timezone.utc)
    token_hash = hash_refresh_token(raw_token)
    refresh = db.scalar(
        select(SessionRefreshToken)
        .where(SessionRefreshToken.token_hash == token_hash)
        .with_for_update()
    )
    if refresh is None:
        raise InvalidRefreshToken()

    browser_session = db.scalar(
        select(UserSession).where(UserSession.id == refresh.session_id).with_for_update()
    )
    if browser_session is None:
        raise InvalidRefreshToken()

    if refresh.used_at is not None:
        db.execute(
            update(UserSession)
            .where(UserSession.family_id == browser_session.family_id)
            .values(revoked_at=now, revoke_reason="refresh_token_reuse")
        )
        db.flush()
        raise RefreshTokenReuse()

    if (
        refresh.expires_at <= now
        or browser_session.expires_at <= now
        or browser_session.revoked_at is not None
    ):
        raise InvalidRefreshToken()

    refresh.used_at = now
    browser_session.last_seen_at = now
    replacement = _new_refresh_token()
    db.add(refresh)
    db.add(browser_session)
    db.add(
        SessionRefreshToken(
            session_id=browser_session.id,
            token_hash=hash_refresh_token(replacement),
            created_at=now,
            expires_at=browser_session.expires_at,
        )
    )
    db.flush()
    return SessionCredentials(session=browser_session, refresh_token=replacement)


def revoke_session(db: Session, session_id: UUID, *, reason: str) -> None:
    db.execute(
        update(UserSession)
        .where(UserSession.id == session_id, UserSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc), revoke_reason=reason)
    )


def revoke_all_user_sessions(
    db: Session,
    user_id: UUID,
    *,
    reason: str,
    except_session_id: UUID | None = None,
) -> None:
    statement = update(UserSession).where(
        UserSession.user_id == user_id,
        UserSession.revoked_at.is_(None),
    )
    if except_session_id is not None:
        statement = statement.where(UserSession.id != except_session_id)
    db.execute(
        statement.values(
            revoked_at=datetime.now(timezone.utc),
            revoke_reason=reason,
        )
    )


def get_active_session(
    db: Session,
    *,
    session_id: UUID,
    user_id: UUID,
    token_version: int,
) -> UserSession | None:
    now = datetime.now(timezone.utc)
    return db.scalar(
        select(UserSession).where(
            UserSession.id == session_id,
            UserSession.user_id == user_id,
            UserSession.token_version == token_version,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        )
    )
