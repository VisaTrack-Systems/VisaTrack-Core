from __future__ import annotations

import importlib

import pytest


def test_frontend_origins_adds_localhost_aliases(monkeypatch):
    monkeypatch.setenv('FRONTEND_ORIGIN', 'http://localhost:3000')
    import app.core.config as config_module

    importlib.reload(config_module)

    assert config_module.settings.frontend_origins == [
        'http://127.0.0.1:3000',
        'http://localhost:3000',
    ]


def test_frontend_origins_supports_comma_delimited_values(monkeypatch):
    monkeypatch.setenv('FRONTEND_ORIGIN', 'https://app.example.com, http://localhost:3000')
    import app.core.config as config_module

    importlib.reload(config_module)

    assert 'https://app.example.com' in config_module.settings.frontend_origins
    assert 'http://127.0.0.1:3000' in config_module.settings.frontend_origins


def test_production_rejects_default_auth_secret():
    from app.core.config import Settings

    candidate = Settings()
    candidate.app_env = 'production'
    candidate.auth_secret_key = 'dev-only-change-me'

    with pytest.raises(RuntimeError, match='AUTH_SECRET_KEY'):
        candidate.validate_security()
