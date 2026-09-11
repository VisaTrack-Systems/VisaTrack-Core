"""Authentication Routes: API endpoints for login, token refresh, logout, and user session management."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import cast, delete, select, String
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, get_auth_context
from app.core.config import settings
from app.core.security import (
    create_access_token,
    hash_invitation_token,
    hash_password,
    verify_password,
)
from app.db.deps import get_db
from app.models.organization import Organization
from app.models.mfa_recovery_code import MfaRecoveryCode
from app.models.role import Role
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.models.user_profile import UserProfile
from app.models.user_role import UserRole
from app.models.user_session import UserSession
from app.schemas.auth import (
    AcceptInvitationRequest,
    AcceptInvitationResponse,
    AuthTokenResponse,
    ChangePasswordRequest,
    CurrentUserResponse,
    CurrentUserSettingsResponse,
    LoginRequest,
    MfaDisableRequest,
    MfaEnrollRequest,
    MfaEnrollResponse,
    MfaVerifyEnrollmentRequest,
    MfaVerifyEnrollmentResponse,
    SessionResponse,
    SwitchActiveRoleRequest,
    SwitchActiveRoleResponse,
    UpdateCurrentUserSettingsRequest,
    VerifyInvitationRequest,
    VerifyInvitationResponse,
)
from app.services.audit import log_activity
from app.services.mfa import (
    decrypt_secret,
    encrypt_secret,
    generate_totp_secret,
    provisioning_uri,
    replace_recovery_codes,
    verify_totp,
    verify_user_mfa,
)
from app.services.rbac import canonical_role_slug, select_default_active_role
from app.services.sessions import (
    InvalidRefreshToken,
    RefreshTokenReuse,
    create_session,
    revoke_all_user_sessions,
    revoke_session,
    rotate_refresh_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.auth_refresh_cookie_name,
        value=token,
        max_age=settings.auth_refresh_token_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        path="/api/v1/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.auth_refresh_cookie_name,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        path="/api/v1/auth",
    )


def _require_trusted_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin not in settings.frontend_origins:
        raise HTTPException(status_code=403, detail="Untrusted request origin")


def _normalize_email(value: str) -> str:
    normalized = value.strip().lower()
    if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
        raise HTTPException(status_code=400, detail="Invalid email address")
    return normalized


def _lawyer_onboarding_required(db: Session, user: User, roles: list[str]) -> bool:
    if "lawyer" not in roles:
        return False

    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    if profile is None:
        return True

    return not bool((profile.bar_number or "").strip())


def _to_current_user_settings(user: User) -> CurrentUserSettingsResponse:
    return CurrentUserSettingsResponse(
        id=user.id,
        organization_id=user.organization_id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        avatar_url=user.avatar_url,
        email_verified=bool(user.email_verified),
        phone_verified=bool(user.phone_verified),
        mfa_enabled=bool(user.mfa_enabled),
        timezone=user.timezone,
        locale=user.locale,
        status=user.status,
    )


@router.post("/login", response_model=AuthTokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthTokenResponse:
    normalized_slug = payload.organization_slug.strip().lower()
    normalized_email = _normalize_email(payload.email)

    organization = db.scalar(
        select(Organization).where(
            cast(Organization.slug, String) == normalized_slug,
            Organization.deleted_at.is_(None),
        )
    )
    if organization is None:
        raise HTTPException(status_code=401, detail="Invalid organization or credentials")

    user = db.scalar(
        select(User).where(
            User.organization_id == organization.id,
            cast(User.email, String) == normalized_email,
            User.deleted_at.is_(None),
        ).with_for_update()
    )
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid organization or credentials")

    now = datetime.now(timezone.utc)
    if user.locked_until and user.locked_until > now:
        raise HTTPException(status_code=423, detail="Account locked. Try again later")

    if not verify_password(payload.password, user.password_hash):
        current_attempts = int(user.login_attempts or 0) + 1
        user.login_attempts = current_attempts
        if current_attempts >= MAX_LOGIN_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
            user.login_attempts = 0
        db.add(user)
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid organization or credentials")

    if (user.status or "").lower() not in {"active", "invited"}:
        raise HTTPException(status_code=403, detail="User account is not active")

    role_rows = db.execute(
        select(Role.slug)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(
            UserRole.user_id == user.id,
            (UserRole.expires_at.is_(None) | (UserRole.expires_at > now)),
            (Role.organization_id.is_(None) | (Role.organization_id == organization.id)),
        )
    ).scalars().all()
    roles = sorted({str(role).lower() for role in role_rows})

    if not roles:
        raise HTTPException(status_code=403, detail="No roles assigned. Contact admin")

    if user.status.lower() == "invited":
        raise HTTPException(status_code=403, detail="Invitation pending acceptance")

    active_role = select_default_active_role(roles)
    if active_role is None:
        raise HTTPException(status_code=403, detail="No active role assigned. Contact admin")

    privileged_mfa_required = bool(settings.mfa_required_roles.intersection(roles))
    if user.mfa_enabled:
        if not payload.mfa_code:
            raise HTTPException(status_code=401, detail="MFA code required")
        if not verify_user_mfa(db, user, payload.mfa_code):
            raise HTTPException(status_code=401, detail="Invalid MFA code")
    elif settings.mfa_enforcement_enabled and privileged_mfa_required:
        raise HTTPException(
            status_code=403,
            detail="MFA enrollment required for privileged accounts",
        )

    credentials = create_session(
        db,
        user=user,
        active_role=active_role,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    token = create_access_token(
        str(user.id),
        str(organization.id),
        roles,
        active_role,
        session_id=credentials.session.id,
        token_version=int(user.token_version or 0),
    )

    user.login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    db.add(user)
    db.commit()
    _set_refresh_cookie(response, credentials.refresh_token)

    return AuthTokenResponse(
        access_token=token,
        expires_in_seconds=settings.auth_access_token_minutes * 60,
    )


@router.post("/refresh", response_model=AuthTokenResponse)
def refresh_access_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthTokenResponse:
    _require_trusted_origin(request)
    raw_token = request.cookies.get(settings.auth_refresh_cookie_name)
    if not raw_token:
        raise HTTPException(status_code=401, detail="Refresh token required")

    try:
        credentials = rotate_refresh_token(db, raw_token)
    except RefreshTokenReuse as exc:
        db.commit()
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=401,
            detail="Refresh token reuse detected; session revoked",
        ) from exc
    except InvalidRefreshToken as exc:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Invalid refresh token") from exc

    browser_session = credentials.session
    user = db.scalar(
        select(User).where(
            User.id == browser_session.user_id,
            User.deleted_at.is_(None),
        )
    )
    if (
        user is None
        or (user.status or "").lower() != "active"
        or int(user.token_version or 0) != browser_session.token_version
    ):
        revoke_session(db, browser_session.id, reason="account_state_changed")
        db.commit()
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Session has been revoked")

    now = datetime.now(timezone.utc)
    role_rows = db.execute(
        select(Role.slug)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(
            UserRole.user_id == user.id,
            (UserRole.expires_at.is_(None) | (UserRole.expires_at > now)),
            (Role.organization_id.is_(None) | (Role.organization_id == user.organization_id)),
        )
    ).scalars().all()
    roles = sorted({canonical_role_slug(str(role)) for role in role_rows})
    active_role = (
        browser_session.active_role
        if browser_session.active_role in roles
        else select_default_active_role(roles)
    )
    if active_role is None:
        revoke_session(db, browser_session.id, reason="roles_revoked")
        db.commit()
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="No active role assigned")

    browser_session.active_role = active_role
    db.add(browser_session)
    access_token = create_access_token(
        str(user.id),
        str(user.organization_id),
        roles,
        active_role,
        session_id=browser_session.id,
        token_version=browser_session.token_version,
    )
    db.commit()
    _set_refresh_cookie(response, credentials.refresh_token)
    return AuthTokenResponse(
        access_token=access_token,
        expires_in_seconds=settings.auth_access_token_minutes * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> None:
    _require_trusted_origin(request)
    revoke_session(db, auth.session_id, reason="logout")
    db.commit()
    _clear_refresh_cookie(response)


@router.get("/sessions", response_model=list[SessionResponse])
def list_sessions(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[SessionResponse]:
    sessions = db.scalars(
        select(UserSession)
        .where(
            UserSession.user_id == auth.user_id,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > datetime.now(timezone.utc),
        )
        .order_by(UserSession.last_seen_at.desc())
    ).all()
    return [
        SessionResponse(
            id=session.id,
            active_role=session.active_role,
            user_agent=session.user_agent,
            created_at=session.created_at,
            last_seen_at=session.last_seen_at,
            expires_at=session.expires_at,
            current=session.id == auth.session_id,
        )
        for session in sessions
    ]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: UUID,
    response: Response,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> None:
    owned_session = db.scalar(
        select(UserSession.id).where(
            UserSession.id == session_id,
            UserSession.user_id == auth.user_id,
        )
    )
    if owned_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    revoke_session(db, session_id, reason="user_revoked")
    db.commit()
    if session_id == auth.session_id:
        _clear_refresh_cookie(response)


@router.get("/me", response_model=CurrentUserResponse)
def me(auth: AuthContext = Depends(get_auth_context), db: Session = Depends(get_db)) -> CurrentUserResponse:
    onboarding_required = _lawyer_onboarding_required(db, auth.user, auth.roles)
    return CurrentUserResponse(
        id=auth.user.id,
        organization_id=auth.organization_id,
        email=auth.user.email,
        full_name=f"{auth.user.first_name} {auth.user.last_name}",
        status=auth.user.status,
        roles=auth.roles,
        active_role=auth.active_role,
        onboarding_required=onboarding_required,
        last_login_at=auth.user.last_login_at,
    )


@router.post("/switch-role", response_model=SwitchActiveRoleResponse)
def switch_active_role(
    payload: SwitchActiveRoleRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> SwitchActiveRoleResponse:
    requested_role = canonical_role_slug(payload.role)
    if requested_role not in auth.roles:
        raise HTTPException(status_code=403, detail="Requested role is not assigned to this user")

    token = create_access_token(
        str(auth.user_id),
        str(auth.organization_id),
        auth.roles,
        requested_role,
        session_id=auth.session_id,
        token_version=int(auth.user.token_version or 0),
    )
    browser_session = db.scalar(
        select(UserSession).where(UserSession.id == auth.session_id).with_for_update()
    )
    if browser_session is None or browser_session.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Session has been revoked")
    browser_session.active_role = requested_role
    browser_session.last_seen_at = datetime.now(timezone.utc)
    db.add(browser_session)
    db.commit()
    return SwitchActiveRoleResponse(
        access_token=token,
        expires_in_seconds=settings.auth_access_token_minutes * 60,
        active_role=requested_role,
        roles=auth.roles,
    )


@router.get("/me/settings", response_model=CurrentUserSettingsResponse)
def me_settings(auth: AuthContext = Depends(get_auth_context)) -> CurrentUserSettingsResponse:
    return _to_current_user_settings(auth.user)


@router.put("/me/settings", response_model=CurrentUserSettingsResponse)
def update_me_settings(
    payload: UpdateCurrentUserSettingsRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> CurrentUserSettingsResponse:
    now = datetime.now(timezone.utc)
    user = auth.user

    old_values = {
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "avatar_url": user.avatar_url,
        "mfa_enabled": bool(user.mfa_enabled),
        "timezone": user.timezone,
        "locale": user.locale,
    }

    if payload.email is not None:
        normalized_email = _normalize_email(payload.email)
        email_exists = db.scalar(
            select(User.id).where(
                cast(User.email, String) == normalized_email,
                User.organization_id == auth.organization_id,
                User.id != auth.user_id,
                User.deleted_at.is_(None),
            )
        )
        if email_exists is not None:
            raise HTTPException(status_code=409, detail="Email already exists in organization")
        user.email = normalized_email

    if payload.first_name is not None:
        normalized_first_name = payload.first_name.strip()
        if not normalized_first_name:
            raise HTTPException(status_code=400, detail="First name cannot be empty")
        user.first_name = normalized_first_name

    if payload.last_name is not None:
        normalized_last_name = payload.last_name.strip()
        if not normalized_last_name:
            raise HTTPException(status_code=400, detail="Last name cannot be empty")
        user.last_name = normalized_last_name

    if payload.phone is not None:
        normalized_phone = payload.phone.strip()
        user.phone = normalized_phone or None

    if payload.avatar_url is not None:
        normalized_avatar_url = payload.avatar_url.strip()
        user.avatar_url = normalized_avatar_url or None

    if payload.mfa_enabled is not None:
        raise HTTPException(
            status_code=400,
            detail="Use the dedicated MFA enrollment or disable endpoint",
        )

    if payload.timezone is not None:
        normalized_timezone = payload.timezone.strip()
        if not normalized_timezone:
            raise HTTPException(status_code=400, detail="Timezone cannot be empty")
        user.timezone = normalized_timezone

    if payload.locale is not None:
        normalized_locale = payload.locale.strip()
        if not normalized_locale:
            raise HTTPException(status_code=400, detail="Locale cannot be empty")
        user.locale = normalized_locale

    user.updated_at = now
    db.add(user)

    new_values = {
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "avatar_url": user.avatar_url,
        "mfa_enabled": bool(user.mfa_enabled),
        "timezone": user.timezone,
        "locale": user.locale,
    }
    log_activity(
        db,
        organization_id=auth.organization_id,
        user_id=auth.user_id,
        action="updated",
        entity_type="user_settings",
        entity_id=auth.user_id,
        old_values=old_values,
        new_values=new_values,
    )

    db.commit()
    db.refresh(user)
    return _to_current_user_settings(user)


@router.post("/mfa/enroll", response_model=MfaEnrollResponse)
def enroll_mfa(
    payload: MfaEnrollRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> MfaEnrollResponse:
    if not verify_password(payload.current_password, auth.user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if auth.user.mfa_enabled:
        raise HTTPException(status_code=409, detail="MFA is already enabled")

    secret = generate_totp_secret()
    auth.user.mfa_secret = encrypt_secret(secret)
    auth.user.mfa_enrolled_at = None
    db.add(auth.user)
    db.commit()
    return MfaEnrollResponse(
        secret=secret,
        provisioning_uri=provisioning_uri(secret=secret, email=auth.user.email),
    )


@router.post("/mfa/verify", response_model=MfaVerifyEnrollmentResponse)
def verify_mfa_enrollment(
    payload: MfaVerifyEnrollmentRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> MfaVerifyEnrollmentResponse:
    if auth.user.mfa_enabled:
        raise HTTPException(status_code=409, detail="MFA is already enabled")
    if not auth.user.mfa_secret:
        raise HTTPException(status_code=400, detail="Start MFA enrollment first")
    try:
        secret = decrypt_secret(auth.user.mfa_secret)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="MFA enrollment is invalid") from exc
    if not verify_totp(secret, payload.code):
        raise HTTPException(status_code=400, detail="Invalid MFA code")

    recovery_codes = replace_recovery_codes(db, auth.user)
    auth.user.mfa_enabled = True
    auth.user.mfa_enrolled_at = datetime.now(timezone.utc)
    db.add(auth.user)
    db.commit()
    return MfaVerifyEnrollmentResponse(recovery_codes=recovery_codes)


@router.post("/mfa/disable", status_code=status.HTTP_204_NO_CONTENT)
def disable_mfa(
    payload: MfaDisableRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> None:
    if not auth.user.mfa_enabled or not auth.user.mfa_secret:
        raise HTTPException(status_code=409, detail="MFA is not enabled")
    if not verify_password(payload.current_password, auth.user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if not verify_user_mfa(db, auth.user, payload.code):
        raise HTTPException(status_code=400, detail="Invalid MFA code")

    auth.user.mfa_enabled = False
    auth.user.mfa_secret = None
    auth.user.mfa_enrolled_at = None
    auth.user.token_version = int(auth.user.token_version or 0) + 1
    db.execute(delete(MfaRecoveryCode).where(MfaRecoveryCode.user_id == auth.user_id))
    revoke_all_user_sessions(db, auth.user_id, reason="mfa_disabled")
    db.add(auth.user)
    db.commit()


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> None:
    if not verify_password(payload.current_password, auth.user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    auth.user.password_hash = hash_password(payload.new_password)
    auth.user.token_version = int(auth.user.token_version or 0) + 1
    auth.user.updated_at = datetime.now(timezone.utc)
    db.add(auth.user)
    revoke_all_user_sessions(
        db,
        auth.user_id,
        reason="password_changed",
    )
    db.commit()


@router.post("/verify-invitation", response_model=VerifyInvitationResponse)
def verify_invitation(
    payload: VerifyInvitationRequest,
    db: Session = Depends(get_db),
) -> VerifyInvitationResponse:
    now = datetime.now(timezone.utc)
    token_hash = hash_invitation_token(payload.token)

    invitation = db.scalar(
        select(UserInvitation).where(
            UserInvitation.token_hash == token_hash,
            UserInvitation.accepted_at.is_(None),
            UserInvitation.revoked_at.is_(None),
        )
    )
    if invitation is None:
        raise HTTPException(status_code=400, detail="Invitation is invalid")

    if invitation.expires_at < now:
        raise HTTPException(status_code=400, detail="Invitation has expired")

    user = db.scalar(
        select(User).where(User.id == invitation.user_id, User.deleted_at.is_(None))
    )
    if user is None:
        raise HTTPException(status_code=400, detail="Invited user no longer exists")

    organization = db.scalar(
        select(Organization).where(
            Organization.id == user.organization_id,
            Organization.deleted_at.is_(None),
        )
    )
    if organization is None:
        raise HTTPException(status_code=400, detail="Organization no longer exists")

    return VerifyInvitationResponse(
        email=user.email,
        full_name=f"{user.first_name} {user.last_name}",
        organization_id=user.organization_id,
        organization_slug=organization.slug,
        expires_at=invitation.expires_at,
    )


@router.post("/accept-invitation", response_model=AcceptInvitationResponse)
def accept_invitation(
    payload: AcceptInvitationRequest,
    db: Session = Depends(get_db),
) -> AcceptInvitationResponse:
    now = datetime.now(timezone.utc)
    token_hash = hash_invitation_token(payload.token)

    invitation = db.scalar(
        select(UserInvitation).where(
            UserInvitation.token_hash == token_hash,
            UserInvitation.accepted_at.is_(None),
            UserInvitation.revoked_at.is_(None),
        ).with_for_update()
    )
    if invitation is None:
        raise HTTPException(status_code=400, detail="Invitation is invalid")

    if invitation.expires_at < now:
        raise HTTPException(status_code=400, detail="Invitation has expired")

    user = db.scalar(
        select(User).where(User.id == invitation.user_id, User.deleted_at.is_(None))
    )
    if user is None:
        raise HTTPException(status_code=400, detail="Invited user no longer exists")

    user.password_hash = hash_password(payload.password)
    user.status = "active"
    user.updated_at = now
    invitation.accepted_at = now

    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    if profile is None:
        profile_user_type = "client" if invitation.role_slug == "client" else "lawyer"
        db.add(UserProfile(user_id=user.id, user_type=profile_user_type))

    db.add(user)
    db.add(invitation)
    db.commit()

    return AcceptInvitationResponse(
        message="Invitation accepted. You can now sign in.",
        email=user.email,
        organization_id=user.organization_id,
    )
