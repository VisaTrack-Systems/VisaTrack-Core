import os
from pathlib import Path

from dotenv import load_dotenv


REPO_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(REPO_ROOT / ".env")


class Settings:
    app_name: str = os.getenv("APP_NAME", "VisaTrack API")
    app_version: str = os.getenv("APP_VERSION", "0.1.0")
    app_env: str = os.getenv("APP_ENV", "development")

    database_url: str = os.getenv(
        "DATABASE_URL", "postgresql://localhost/visatrack"
    )
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
    auth_secret_key: str = os.getenv("AUTH_SECRET_KEY", "dev-only-change-me")
    auth_algorithm: str = os.getenv("AUTH_ALGORITHM", "HS256")
    auth_access_token_minutes: int = int(os.getenv("AUTH_ACCESS_TOKEN_MINUTES", "60"))
    invitation_expiry_hours: int = int(os.getenv("INVITATION_EXPIRY_HOURS", "72"))
    aws_region: str = os.getenv("AWS_REGION", "us-east-1")
    s3_bucket_name: str = os.getenv("S3_BUCKET_NAME", "")
    aws_kms_key_id: str = os.getenv("AWS_KMS_KEY_ID", "")
    s3_endpoint_url: str = os.getenv("S3_ENDPOINT_URL", "")
    s3_presign_expires_seconds: int = int(os.getenv("S3_PRESIGN_EXPIRES_SECONDS", "900"))
    s3_max_upload_bytes: int = int(os.getenv("S3_MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))
    resend_api_key: str = os.getenv("RESEND_API_KEY", "")
    resend_from_email: str = os.getenv("RESEND_FROM_EMAIL", "noreply@visatrack.app")
    resend_from_name: str = os.getenv("RESEND_FROM_NAME", "VisaTrack")

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
