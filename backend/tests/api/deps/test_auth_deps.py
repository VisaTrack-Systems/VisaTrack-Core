from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.deps import auth as auth_deps
from tests.support import FakeResult, row


def test_get_auth_context_success(monkeypatch, make_user):
    user = make_user()
    db = MagicMock()
    db.scalar.return_value = user
    db.execute.return_value = FakeResult([
        row(slug='lawyer', permissions=['cases:view']),
        row(slug='LAWYER', permissions=['documents:view']),
    ])
    monkeypatch.setattr(
        auth_deps,
        'decode_access_token',
        lambda token: {'sub': str(user.id), 'org': str(user.organization_id), 'roles': ['client']},
    )
    credentials = row(scheme='Bearer', credentials='token')

    result = auth_deps.get_auth_context(credentials=credentials, db=db)

    assert result.user is user
    assert result.roles == ['lawyer']
    assert result.permissions == {'cases:view', 'documents:view'}


def test_get_auth_context_rejects_locked_user(monkeypatch, make_user):
    user = make_user(locked_until=datetime.now(timezone.utc) + timedelta(minutes=5))
    db = MagicMock()
    db.scalar.return_value = user
    db.execute.return_value = FakeResult([])
    monkeypatch.setattr(
        auth_deps,
        'decode_access_token',
        lambda token: {'sub': str(user.id), 'org': str(user.organization_id), 'roles': []},
    )

    with pytest.raises(HTTPException) as exc:
        auth_deps.get_auth_context(credentials=row(scheme='Bearer', credentials='token'), db=db)

    assert exc.value.status_code == 401
    assert 'locked' in exc.value.detail.lower()


def test_require_roles_and_permissions(make_auth_context):
    auth = make_auth_context(roles=['lawyer'], permissions={'documents:view'})

    assert auth_deps.require_roles('lawyer')(auth) is auth
    assert auth_deps.require_permissions('documents:view')(auth) is auth

    with pytest.raises(HTTPException):
        auth_deps.require_roles('client')(auth)

    with pytest.raises(HTTPException):
        auth_deps.require_permissions('cases:edit')(auth)


def test_get_auth_context_rejects_inactive_user(monkeypatch, make_user):
    user = make_user(status='disabled')
    db = MagicMock()
    db.scalar.return_value = user
    monkeypatch.setattr(
        auth_deps,
        'decode_access_token',
        lambda token: {'sub': str(user.id), 'org': str(user.organization_id)},
    )

    with pytest.raises(HTTPException) as exc:
        auth_deps.get_auth_context(
            credentials=row(scheme='Bearer', credentials='token'),
            db=db,
        )

    assert exc.value.status_code == 401
    assert 'not active' in exc.value.detail.lower()


def test_role_checks_use_active_role_and_permissions_require_all(make_auth_context):
    auth = make_auth_context(
        roles=['lawyer', 'org_admin'],
        permissions={'users:manage'},
    )
    auth.active_role = 'lawyer'

    assert auth_deps.require_roles('lawyer')(auth) is auth

    with pytest.raises(HTTPException):
        auth_deps.require_roles('org_admin')(auth)

    with pytest.raises(HTTPException):
        auth_deps.require_permissions('users:manage', 'roles:manage')(auth)
