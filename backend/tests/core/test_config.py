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


def test_production_reports_every_missing_variable():
    from app.core.config import Settings

    candidate = Settings()
    candidate.app_env = 'production'
    candidate.auth_secret_key = 'x' * 32
    candidate.mfa_encryption_key = 'y' * 32
    candidate.auth_cookie_secure = True
    candidate.s3_bucket_name = ''
    candidate.aws_kms_key_id = ''
    candidate.audit_archive_bucket = ''
    candidate.database_url = 'postgresql://localhost/visatrack'

    with pytest.raises(RuntimeError) as failure:
        candidate.validate_security()

    message = str(failure.value)
    assert 'S3_BUCKET_NAME' in message
    assert 'AWS_KMS_KEY_ID' in message
    assert 'AUDIT_ARCHIVE_BUCKET' in message
    assert 'DATABASE_URL' in message


def test_production_accepts_complete_configuration():
    from app.core.config import Settings

    candidate = Settings()
    candidate.app_env = 'production'
    candidate.auth_secret_key = 'x' * 32
    candidate.mfa_encryption_key = 'y' * 32
    candidate.auth_cookie_secure = True
    candidate.s3_bucket_name = 'visatrack-docs-prod'
    candidate.aws_kms_key_id = 'arn:aws:kms:us-east-1:1:key/2'
    candidate.audit_archive_bucket = 'visatrack-audit-prod'
    candidate.database_url = 'postgresql://user:pw@db.internal:5432/visatrack'

    candidate.validate_security()


def test_database_url_normalizes_managed_postgres_scheme(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'postgres://user:pw@db.internal:5432/visatrack')
    import app.core.config as config_module

    importlib.reload(config_module)

    assert config_module.settings.database_url == (
        'postgresql://user:pw@db.internal:5432/visatrack'
    )


def test_database_url_keeps_supported_schemes(monkeypatch):
    monkeypatch.setenv(
        'DATABASE_URL', ' postgresql+psycopg2://user:pw@db.internal:5432/visatrack '
    )
    import app.core.config as config_module

    importlib.reload(config_module)

    assert config_module.settings.database_url == (
        'postgresql+psycopg2://user:pw@db.internal:5432/visatrack'
    )
