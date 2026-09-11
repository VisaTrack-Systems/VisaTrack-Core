from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import OperationalError

from app.api.routes.health import health, liveness, readiness, root_health


def test_health_endpoints_return_ok():
    assert root_health() == {'status': 'ok'}
    assert health() == {'status': 'ok'}
    assert liveness() == {'status': 'ok'}


def test_readiness_checks_database():
    db = MagicMock()
    assert readiness(db=db) == {'status': 'ready', 'database': 'ok'}
    db.execute.assert_called_once()


def test_readiness_returns_503_when_database_is_unavailable():
    db = MagicMock()
    db.execute.side_effect = OperationalError('SELECT 1', {}, Exception('down'))

    with pytest.raises(HTTPException) as exc:
        readiness(db=db)

    assert exc.value.status_code == 503
