from __future__ import annotations

from app.api.routes.health import health, root_health


def test_health_endpoints_return_ok():
    assert root_health() == {'status': 'ok'}
    assert health() == {'status': 'ok'}
