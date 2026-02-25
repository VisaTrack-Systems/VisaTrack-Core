import os


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


settings = Settings()
