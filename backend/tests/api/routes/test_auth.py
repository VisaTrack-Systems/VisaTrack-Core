from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException, Request, Response

from app.api.routes import auth
from app.schemas.auth import (
    AcceptInvitationRequest,
    ChangePasswordRequest,
    LoginRequest,
    UpdateCurrentUserSettingsRequest,
    VerifyInvitationRequest,
)
from tests.support import FakeResult, row


def browser_request() -> Request:
    return Request({
        'type': 'http',
        'method': 'POST',
        'path': '/api/v1/auth/login',
        'headers': [(b'origin', b'http://localhost:3000')],
        'client': ('127.0.0.1', 12345),
    })


def test_auth_helpers_normalize_and_detect_onboarding(make_user):
    user = make_user()
    db = MagicMock()
    db.scalar.return_value = None

    assert auth._normalize_email(' USER@EXAMPLE.COM ') == 'user@example.com'
    assert auth._lawyer_onboarding_required(db, user, ['lawyer']) is True


def test_login_rejects_locked_account(monkeypatch, make_user):
    organization = row(id=uuid4(), slug='acme')
    user = make_user(organization_id=organization.id, locked_until=datetime.now(timezone.utc) + timedelta(minutes=5))
    db = MagicMock()
    db.scalar.side_effect = [organization, user]

    with pytest.raises(HTTPException) as exc:
        auth.login(
            payload=row(organization_slug='acme', email='user@example.com', password='secret'),
            request=browser_request(),
            response=Response(),
            db=db,
        )

    assert exc.value.status_code == 423


def test_login_invalid_password_increments_attempts(monkeypatch, make_user):
    organization = row(id=uuid4(), slug='acme')
    user = make_user(organization_id=organization.id, login_attempts=1)
    db = MagicMock()
    db.scalar.side_effect = [organization, user]
    monkeypatch.setattr(auth, 'verify_password', lambda password, stored_hash: False)

    with pytest.raises(HTTPException) as exc:
        auth.login(
            payload=row(organization_slug='acme', email='user@example.com', password='bad'),
            request=browser_request(),
            response=Response(),
            db=db,
        )

    assert exc.value.status_code == 401
    assert user.login_attempts == 2
    db.commit.assert_called_once()


def test_me_returns_current_user_payload(monkeypatch, make_auth_context):
    auth_context = make_auth_context(roles=['lawyer'])
    db = MagicMock()
    monkeypatch.setattr(auth, '_lawyer_onboarding_required', lambda db, user, roles: True)

    result = auth.me(auth=auth_context, db=db)

    assert result.email == auth_context.user.email
    assert result.active_role == 'lawyer'
    assert result.onboarding_required is True


def test_update_me_settings_rejects_duplicate_email(make_auth_context):
    auth_context = make_auth_context()
    db = MagicMock()
    db.scalar.return_value = uuid4()
    payload = row(email='taken@example.com', first_name=None, last_name=None, phone=None, avatar_url=None, mfa_enabled=None, timezone=None, locale=None)

    with pytest.raises(HTTPException) as exc:
        auth.update_me_settings(payload=payload, auth=auth_context, db=db)

    assert exc.value.status_code == 409


def test_login_success_returns_access_token(monkeypatch, make_user):
    organization = row(id=uuid4(), slug='acme')
    user = make_user(organization_id=organization.id, status='active')
    db = MagicMock()
    db.scalar.side_effect = [organization, user]
    db.execute.return_value = FakeResult(rows=['lawyer'])
    monkeypatch.setattr(auth, 'verify_password', lambda password, stored_hash: True)
    monkeypatch.setattr(auth, 'create_access_token', lambda *args, **kwargs: 'token-123')
    monkeypatch.setattr(
        auth,
        'create_session',
        lambda *args, **kwargs: row(session=row(id=uuid4()), refresh_token='refresh-token'),
    )

    result = auth.login(
        payload=LoginRequest(organization_slug='acme', email='user@example.com', password='secret'),
        request=browser_request(),
        response=Response(),
        db=db,
    )

    assert result.access_token == 'token-123'
    assert user.login_attempts == 0
    db.commit.assert_called_once()


def test_login_requires_second_factor_for_enrolled_user(monkeypatch, make_user):
    organization = row(id=uuid4(), slug='acme')
    user = make_user(
        organization_id=organization.id,
        status='active',
        mfa_enabled=True,
        mfa_secret='encrypted',
    )
    db = MagicMock()
    db.scalar.side_effect = [organization, user]
    db.execute.return_value = FakeResult(rows=['org_admin'])
    monkeypatch.setattr(auth, 'verify_password', lambda password, stored_hash: True)

    with pytest.raises(HTTPException) as exc:
        auth.login(
            payload=LoginRequest(
                organization_slug='acme',
                email='user@example.com',
                password='secret',
            ),
            request=browser_request(),
            response=Response(),
            db=db,
        )

    assert exc.value.status_code == 401
    assert exc.value.detail == 'MFA code required'


def test_switch_active_role_reissues_token(monkeypatch, make_auth_context):
    auth_context = make_auth_context(roles=['lawyer', 'org_admin'])
    captured = {}

    def fake_create_access_token(user_id, org_id, roles, active_role=None, **kwargs):
        captured['user_id'] = user_id
        captured['org_id'] = org_id
        captured['roles'] = roles
        captured['active_role'] = active_role
        return 'token-role-switch'

    monkeypatch.setattr(auth, 'create_access_token', fake_create_access_token)

    db = MagicMock()
    db.scalar.return_value = row(revoked_at=None)
    result = auth.switch_active_role(payload=row(role='org_admin'), auth=auth_context, db=db)

    assert result.access_token == 'token-role-switch'
    assert result.active_role == 'org_admin'
    assert captured['active_role'] == 'org_admin'


def test_me_settings_returns_current_user_settings(make_auth_context):
    auth_context = make_auth_context()

    result = auth.me_settings(auth=auth_context)

    assert result.email == auth_context.user.email
    assert result.timezone == auth_context.user.timezone


def test_update_me_settings_updates_fields_and_clears_mfa_secret(monkeypatch, make_auth_context):
    auth_context = make_auth_context()
    auth_context.user.mfa_secret = 'secret'
    db = MagicMock()
    db.scalar.return_value = None
    db.refresh.side_effect = lambda obj: None
    monkeypatch.setattr(auth, 'log_activity', lambda *args, **kwargs: None)

    result = auth.update_me_settings(
        payload=UpdateCurrentUserSettingsRequest(
            email='updated@example.com',
            first_name='Updated',
            last_name='User',
            phone='555-0100',
            avatar_url='https://example.com/a.png',
            timezone='America/Vancouver',
            locale='fr-CA',
        ),
        auth=auth_context,
        db=db,
    )

    assert result.email == 'updated@example.com'
    assert auth_context.user.mfa_secret == 'secret'
    db.commit.assert_called_once()


def test_change_password_updates_hash(monkeypatch, make_auth_context):
    auth_context = make_auth_context()
    db = MagicMock()
    monkeypatch.setattr(auth, 'verify_password', lambda current, stored: True)
    monkeypatch.setattr(auth, 'hash_password', lambda password: f'hashed:{password}')

    auth.change_password(
        payload=ChangePasswordRequest(current_password='old-password', new_password='NewPassword123'),
        auth=auth_context,
        db=db,
    )

    assert auth_context.user.password_hash == 'hashed:NewPassword123'
    assert auth_context.user.token_version == 1
    db.execute.assert_called_once()
    db.commit.assert_called_once()


def test_accept_invitation_activates_user_and_creates_profile(monkeypatch, make_user):
    invitation = row(
        organization_id=uuid4(),
        user_id=uuid4(),
        role_slug='client',
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        accepted_at=None,
        revoked_at=None,
    )
    user = make_user(id=invitation.user_id, organization_id=invitation.organization_id, status='invited')
    db = MagicMock()
    db.scalar.side_effect = [invitation, user, None]
    monkeypatch.setattr(auth, 'hash_invitation_token', lambda token: 'token-hash')
    monkeypatch.setattr(auth, 'hash_password', lambda password: 'hashed-password')

    result = auth.accept_invitation(
        payload=AcceptInvitationRequest(token='a' * 16, password='Password123'),
        db=db,
    )

    assert result.email == user.email
    assert user.status == 'active'
    db.commit.assert_called_once()


def test_verify_invitation_returns_organization_slug(monkeypatch, make_user):
    organization_id = uuid4()
    invitation = row(
        organization_id=organization_id,
        user_id=uuid4(),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        accepted_at=None,
        revoked_at=None,
    )
    user = make_user(
        id=invitation.user_id,
        organization_id=organization_id,
        email='invitee@example.com',
        first_name='Invitee',
        last_name='User',
    )
    organization = row(id=organization_id, slug='acme-law')
    db = MagicMock()
    db.scalar.side_effect = [invitation, user, organization]
    monkeypatch.setattr(auth, 'hash_invitation_token', lambda token: 'token-hash')

    result = auth.verify_invitation(payload=VerifyInvitationRequest(token='a' * 16), db=db)

    assert result.email == 'invitee@example.com'
    assert result.full_name == 'Invitee User'
    assert str(result.organization_id) == str(organization_id)
    assert result.organization_slug == 'acme-law'
