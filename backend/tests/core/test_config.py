from __future__ import annotations

import importlib


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
