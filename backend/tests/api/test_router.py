from __future__ import annotations

from app.api.router import api_router


def test_api_router_includes_expected_paths():
    paths = {route.path for route in api_router.routes}

    assert '/health' in paths
    assert '/api/v1/auth/login' in paths
    assert '/api/v1/cases/by-number/{case_number}/workspace' in paths
    assert '/api/v1/lawyer/clients' in paths
    assert '/api/v1/feedback/bug-report' in paths
