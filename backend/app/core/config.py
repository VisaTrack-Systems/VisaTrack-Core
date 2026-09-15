"""Configuration Manager: Loads environment variables and application settings.
Handles APP_NAME, APP_VERSION, database URIs, and environment-specific configurations.
"""

import os
from pathlib import Path

from dotenv import load_dotenv


REPO_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(REPO_ROOT / ".env")

LOCAL_ENVIRONMENTS = {"development", "local", "test"}
DEFAULT_AUTH_SECRET_KEY = "dev-only-change-me"
DEFAULT_DATABASE_URL = "postgresql://localhost/visatrack"


def normalize_database_url(raw: str) -> str:
    """Return a SQLAlchemy-compatible URL.

    Managed Postgres providers hand out `postgres://` URLs, which SQLAlchemy 2
    refuses to load because it has no driver registered under that name.
    """
    url = raw.strip()
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://") :]
    return url


class Settings:
    app_name: str = os.getenv("APP_NAME", "VisaTrack API")
    app_version: str = os.getenv("APP_VERSION", "0.1.0")
    app_env: str = os.getenv("APP_ENV", "development")

    database_url: str = normalize_database_url(
        os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    )
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
    auth_secret_key: str = os.getenv("AUTH_SECRET_KEY", "dev-only-change-me")
    auth_algorithm: str = os.getenv("AUTH_ALGORITHM", "HS256")
    auth_access_token_minutes: int = int(os.getenv("AUTH_ACCESS_TOKEN_MINUTES", "15"))
    auth_refresh_token_days: int = int(os.getenv("AUTH_REFRESH_TOKEN_DAYS", "30"))
    auth_refresh_cookie_name: str = os.getenv(
        "AUTH_REFRESH_COOKIE_NAME", "visatrack_refresh"
    )
    auth_cookie_secure: bool = os.getenv(
        "AUTH_COOKIE_SECURE",
        "false" if app_env.strip().lower() in {"development", "local", "test"} else "true",
    ).lower() == "true"
    auth_cookie_samesite: str = os.getenv("AUTH_COOKIE_SAMESITE", "lax").lower()
    mfa_encryption_key: str = os.getenv("MFA_ENCRYPTION_KEY", "")
    mfa_required_roles: set[str] = {
        role.strip().lower()
        for role in os.getenv("MFA_REQUIRED_ROLES", "super_admin,org_admin").split(",")
        if role.strip()
    }
    mfa_enforcement_enabled: bool = (
        os.getenv("MFA_ENFORCEMENT_ENABLED", "false").lower() == "true"
    )
    invitation_expiry_hours: int = int(os.getenv("INVITATION_EXPIRY_HOURS", "72"))
    aws_region: str = os.getenv("AWS_REGION", "us-east-1")
    s3_bucket_name: str = os.getenv("S3_BUCKET_NAME", "")
    aws_kms_key_id: str = os.getenv("AWS_KMS_KEY_ID", "")
    s3_endpoint_url: str = os.getenv("S3_ENDPOINT_URL", "")
    s3_presign_expires_seconds: int = int(os.getenv("S3_PRESIGN_EXPIRES_SECONDS", "900"))
    s3_max_upload_bytes: int = int(os.getenv("S3_MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))
    s3_quarantine_prefix: str = os.getenv("S3_QUARANTINE_PREFIX", "quarantine").strip("/")
    s3_clean_prefix: str = os.getenv("S3_CLEAN_PREFIX", "clean").strip("/")
    document_scanner_command: str = os.getenv("DOCUMENT_SCANNER_COMMAND", "clamscan")
    document_scan_timeout_seconds: int = int(
        os.getenv("DOCUMENT_SCAN_TIMEOUT_SECONDS", "120")
    )
    document_retention_days: int = int(os.getenv("DOCUMENT_RETENTION_DAYS", "2555"))
    audit_archive_bucket: str = os.getenv("AUDIT_ARCHIVE_BUCKET", "")
    audit_retention_days: int = int(os.getenv("AUDIT_RETENTION_DAYS", "2555"))
    resend_api_key: str = os.getenv("RESEND_API_KEY", "")
    resend_from_email: str = os.getenv("RESEND_FROM_EMAIL", "noreply@visatrack.ca")
    resend_from_name: str = os.getenv("RESEND_FROM_NAME", "VisaTrack")
    bug_report_to_email: str = os.getenv("BUG_REPORT_TO_EMAIL", "visatrack.support@gmail.com")

    def validate_security(self) -> None:
        """Reject unsafe authentication settings outside local development.

        Every violation is reported in a single error so a failed container
        start names all of the variables that still need to be supplied.
        """
        if self.app_env.strip().lower() in LOCAL_ENVIRONMENTS:
            return

        problems: list[str] = []

        if (
            self.auth_secret_key == DEFAULT_AUTH_SECRET_KEY
            or len(self.auth_secret_key.encode("utf-8")) < 32
        ):
            problems.append(
                "AUTH_SECRET_KEY must be configured with at least 32 bytes"
            )

        if self.auth_algorithm != "HS256":
            problems.append("AUTH_ALGORITHM must be HS256")

        if not self.mfa_encryption_key or self.mfa_encryption_key == self.auth_secret_key:
            problems.append(
                "MFA_ENCRYPTION_KEY must be configured separately from AUTH_SECRET_KEY"
            )

        if not self.auth_cookie_secure:
            problems.append("AUTH_COOKIE_SECURE must be true")

        if self.auth_cookie_samesite not in {"lax", "strict", "none"}:
            problems.append("AUTH_COOKIE_SAMESITE must be lax, strict, or none")

        for name, value in (
            ("S3_BUCKET_NAME", self.s3_bucket_name),
            ("AWS_KMS_KEY_ID", self.aws_kms_key_id),
            ("AUDIT_ARCHIVE_BUCKET", self.audit_archive_bucket),
        ):
            if not value:
                problems.append(f"{name} is required")

        if not self.database_url or self.database_url == DEFAULT_DATABASE_URL:
            problems.append("DATABASE_URL must point at the deployed database")

        if problems:
            raise RuntimeError(
                f"Invalid configuration for APP_ENV={self.app_env.strip()}: "
                + "; ".join(problems)
            )

    @property
    def frontend_origins(self) -> list[str]:
        raw = self.frontend_origin.strip()
        if not raw:
            return ["http://localhost:3000", "http://127.0.0.1:3000"]

        origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
        if not origins:
            origins = ["http://localhost:3000"]

        localhost_aliases = {"http://localhost:3000", "http://127.0.0.1:3000"}
        if localhost_aliases.intersection(origins):
            origins = sorted(set(origins) | localhost_aliases)

        return origins


settings = Settings()
settings.validate_security()
