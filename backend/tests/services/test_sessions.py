from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.services import sessions
from tests.support import row


def test_refresh_tokens_are_keyed_and_not_stored_verbatim(monkeypatch):
    monkeypatch.setattr(sessions.settings, "auth_secret_key", "x" * 32)
    assert sessions.hash_refresh_token("secret-token") != "secret-token"
    assert sessions.hash_refresh_token("secret-token") == sessions.hash_refresh_token(
        "secret-token"
    )


def test_create_session_stores_only_refresh_hash(monkeypatch, make_user):
    monkeypatch.setattr(sessions.settings, "auth_secret_key", "x" * 32)
    user = make_user(token_version=3)
    db = MagicMock()

    credentials = sessions.create_session(
        db,
        user=user,
        active_role="lawyer",
        user_agent="Browser",
        ip_address="192.0.2.1",
    )

    assert credentials.refresh_token
    added = [call.args[0] for call in db.add.call_args_list]
    assert added[0].token_version == 3
    assert added[1].token_hash == sessions.hash_refresh_token(credentials.refresh_token)
    assert credentials.refresh_token not in added[1].token_hash


def test_reused_refresh_token_revokes_entire_family(monkeypatch):
    now = datetime.now(timezone.utc)
    family_id = uuid4()
    session_id = uuid4()
    refresh = row(
        session_id=session_id,
        used_at=now - timedelta(seconds=1),
        expires_at=now + timedelta(days=1),
    )
    browser_session = row(
        id=session_id,
        family_id=family_id,
        expires_at=now + timedelta(days=1),
        revoked_at=None,
    )
    db = MagicMock()
    db.scalar.side_effect = [refresh, browser_session]

    with pytest.raises(sessions.RefreshTokenReuse):
        sessions.rotate_refresh_token(db, "replayed-token")

    db.execute.assert_called_once()
    db.flush.assert_called_once()
