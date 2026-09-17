"""Configuration Manager: Loads environment variables and application settings.
Handles APP_NAME, APP_VERSION, database URIs, and environment-specific configurations.
"""

import os
from pathlib import Path
from uuid import UUID

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


def _is_canonical_uuid(value: str) -> bool:
    try:
        return str(UUID(value)) == value
    except ValueError:
        return False


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
    ai_provider_encryption_key: str = os.getenv("AI_PROVIDER_ENCRYPTION_KEY", "")
    ai_provider_encryption_key_previous: tuple[str, ...] = tuple(
        key.strip()
        for key in os.getenv("AI_PROVIDER_ENCRYPTION_KEY_PREVIOUS", "").split(",")
        if key.strip()
    )
    ai_enabled: bool = os.getenv("AI_ENABLED", "false").lower() == "true"
    ai_enabled_organization_ids: set[str] = {
        value.strip().lower()
        for value in os.getenv("AI_ENABLED_ORGANIZATION_IDS", "").split(",")
        if value.strip()
    }
    ai_enabled_user_ids: set[str] = {
        value.strip().lower()
        for value in os.getenv("AI_ENABLED_USER_IDS", "").split(",")
        if value.strip()
    }
    ai_allowed_models: set[str] = {
        value.strip()
        for value in os.getenv("AI_ALLOWED_MODELS", "").split(",")
        if value.strip()
    }
    ai_form_drafts_enabled: bool = os.getenv(
        "AI_FORM_DRAFTS_ENABLED", "false"
    ).lower() == "true"
    ai_require_mfa_for_keys: bool = os.getenv(
        "AI_REQUIRE_MFA_FOR_KEYS",
        "false" if app_env.strip().lower() in {"development", "local", "test"} else "true",
    ).lower() == "true"
    ai_request_timeout_seconds: float = float(os.getenv("AI_REQUEST_TIMEOUT_SECONDS", "60"))
    ai_max_document_chars: int = int(os.getenv("AI_MAX_DOCUMENT_CHARS", "500000"))
    ai_max_context_chunks: int = int(os.getenv("AI_MAX_CONTEXT_CHUNKS", "8"))
    ai_max_history_messages: int = int(os.getenv("AI_MAX_HISTORY_MESSAGES", "12"))
    ai_max_history_chars: int = int(os.getenv("AI_MAX_HISTORY_CHARS", "40000"))
    ai_max_requests_per_hour: int = int(os.getenv("AI_MAX_REQUESTS_PER_HOUR", "60"))
    ai_max_reindex_documents: int = int(os.getenv("AI_MAX_REINDEX_DOCUMENTS", "100"))
    ai_approved_form_sha256: set[str] = {
        digest.strip().lower()
        for digest in os.getenv("AI_APPROVED_FORM_SHA256", "").split(",")
        if digest.strip()
    }
    stripe_secret_key: str = os.getenv("STRIPE_SECRET_KEY", "")
    stripe_webhook_secret: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    stripe_currency: str = os.getenv("STRIPE_CURRENCY", "cad").strip().lower()

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

        if self.ai_enabled and (
            not self.ai_provider_encryption_key
            or len(self.ai_provider_encryption_key.encode("utf-8")) < 32
            or self.ai_provider_encryption_key in {self.auth_secret_key, self.mfa_encryption_key}
        ):
            problems.append(
                "AI_PROVIDER_ENCRYPTION_KEY must be configured independently of authentication keys"
            )

        if self.ai_enabled and (
            self.ai_provider_encryption_key in self.ai_provider_encryption_key_previous
            or len(set(self.ai_provider_encryption_key_previous))
            != len(self.ai_provider_encryption_key_previous)
            or any(
                len(key.encode("utf-8")) < 32
                or key in {self.auth_secret_key, self.mfa_encryption_key}
                for key in self.ai_provider_encryption_key_previous
            )
        ):
            problems.append(
                "AI_PROVIDER_ENCRYPTION_KEY_PREVIOUS contains duplicate or reused keys"
            )

        if self.ai_enabled and not self.ai_require_mfa_for_keys:
            problems.append(
                "AI_REQUIRE_MFA_FOR_KEYS must be true outside local environments"
            )

        if self.ai_enabled and not self.ai_enabled_organization_ids:
            problems.append(
                "AI_ENABLED_ORGANIZATION_IDS must explicitly scope production AI access"
            )

        if self.ai_enabled and not self.ai_allowed_models:
            problems.append(
                "AI_ALLOWED_MODELS must explicitly list production-approved models"
            )

        if self.ai_enabled and not self.ai_enabled_user_ids:
            problems.append(
                "AI_ENABLED_USER_IDS must explicitly scope production AI access"
            )

        if any(
            ":" not in value
            or value.split(":", 1)[0] not in {"openai", "anthropic"}
            or not value.split(":", 1)[1]
            for value in self.ai_allowed_models
        ):
            problems.append("AI_ALLOWED_MODELS contains an invalid provider:model entry")

        if any(
            value != "*" and not _is_canonical_uuid(value)
            for value in self.ai_enabled_organization_ids
        ):
            problems.append("AI_ENABLED_ORGANIZATION_IDS contains an invalid UUID")

        if any(
            value != "*" and not _is_canonical_uuid(value)
            for value in self.ai_enabled_user_ids
        ):
            problems.append("AI_ENABLED_USER_IDS contains an invalid UUID")

        if self.ai_form_drafts_enabled and not self.ai_enabled:
            problems.append("AI_FORM_DRAFTS_ENABLED requires AI_ENABLED")

        if self.ai_form_drafts_enabled and not self.ai_approved_form_sha256:
            problems.append(
                "AI_APPROVED_FORM_SHA256 must contain approved template hashes "
                "when AI form drafts are enabled"
            )

        if any(
            len(digest) != 64
            or any(character not in "0123456789abcdef" for character in digest)
            for digest in self.ai_approved_form_sha256
        ):
            problems.append("AI_APPROVED_FORM_SHA256 contains an invalid SHA-256 digest")

        if self.ai_enabled and (
            self.ai_request_timeout_seconds <= 0
            or self.ai_max_document_chars <= 0
            or not 1 <= self.ai_max_context_chunks <= 50
            or not 1 <= self.ai_max_history_messages <= 50
            or not 1000 <= self.ai_max_history_chars <= 500000
            or not 1 <= self.ai_max_requests_per_hour <= 1000
            or not 1 <= self.ai_max_reindex_documents <= 1000
        ):
            problems.append("AI numeric limits are outside supported production bounds")

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

        if not self.stripe_secret_key or not self.stripe_webhook_secret:
            problems.append(
                "STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are required outside local environments"
            )

        if len(self.stripe_currency) != 3 or not self.stripe_currency.isalpha():
            problems.append("STRIPE_CURRENCY must be a three-letter ISO currency code")

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

    def ai_enabled_for_organization(self, organization_id: object) -> bool:
        if not self.ai_enabled:
            return False
        if not self.ai_enabled_organization_ids:
            return True
        return (
            "*"
            in self.ai_enabled_organization_ids
            or str(organization_id).lower() in self.ai_enabled_organization_ids
        )

    def allowed_ai_models_for(self, provider: str) -> set[str]:
        prefix = f"{provider.strip().lower()}:"
        return {
            value[len(prefix) :]
            for value in self.ai_allowed_models
            if value.startswith(prefix)
        }

    def ai_enabled_for_user(self, user_id: object) -> bool:
        if not self.ai_enabled:
            return False
        return (
            "*"
            in self.ai_enabled_user_ids
            or str(user_id).lower() in self.ai_enabled_user_ids
        )


settings = Settings()
settings.validate_security()
