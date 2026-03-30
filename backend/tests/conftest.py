"""Test Configuration and Fixtures: Provides pytest fixtures for common test objects
(users, auth contexts, database sessions) and mock data builders for testing.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.api.deps.auth import AuthContext


@pytest.fixture
def make_user():
    def _make_user(**overrides):
        defaults = {
            'id': uuid4(),
            'organization_id': uuid4(),
            'email': 'user@example.com',
            'first_name': 'Test',
            'last_name': 'User',
            'status': 'active',
            'password_hash': 'secret',
            'login_attempts': 0,
            'locked_until': None,
            'last_login_at': None,
            'phone': None,
            'avatar_url': None,
            'email_verified': True,
            'phone_verified': False,
            'mfa_enabled': False,
            'timezone': 'America/Toronto',
            'locale': 'en-CA',
            'deleted_at': None,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
        }
        defaults.update(overrides)
        return SimpleNamespace(**defaults)

    return _make_user


@pytest.fixture
def make_auth_context(make_user):
    def _make_auth_context(user=None, roles=None, permissions=None):
        resolved_user = user or make_user()
        return AuthContext(
            user=resolved_user,
            organization_id=resolved_user.organization_id,
            roles=roles or ['lawyer'],
            active_role=(roles or ['lawyer'])[0],
            permissions=permissions or set(),
        )

    return _make_auth_context
