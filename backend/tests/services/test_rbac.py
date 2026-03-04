from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.services import rbac
from tests.support import FakeResult, row


def test_ensure_system_role_returns_existing_role():
    existing = row(id=uuid4(), slug='lawyer')
    db = MagicMock()
    db.scalar.return_value = existing

    result = rbac.ensure_system_role(db, 'lawyer')

    assert result is existing
    db.add.assert_not_called()


def test_ensure_system_role_creates_missing_role():
    db = MagicMock()
    db.scalar.return_value = None

    result = rbac.ensure_system_role(db, 'lawyer')

    assert result.slug == 'lawyer'
    assert result.is_system is True
    db.add.assert_called_once()
    db.flush.assert_called_once()


def test_ensure_system_role_rejects_unknown_slug():
    db = MagicMock()
    db.scalar.return_value = None

    with pytest.raises(ValueError):
        rbac.ensure_system_role(db, 'mystery-role')


def test_assign_role_to_user_is_noop_when_role_exists(monkeypatch):
    db = MagicMock()
    db.scalar.return_value = object()
    role = row(id=uuid4())
    monkeypatch.setattr(rbac, 'ensure_system_role', lambda db, role_slug: role)

    rbac.assign_role_to_user(db, user_id=uuid4(), role_slug='lawyer', assigned_by=uuid4())

    db.add.assert_not_called()


def test_get_user_roles_normalizes_and_deduplicates():
    db = MagicMock()
    db.execute.return_value = FakeResult(['LAWYER', 'lawyer', 'client'])

    result = rbac.get_user_roles(db, uuid4(), uuid4())

    assert result == ['client', 'lawyer']
