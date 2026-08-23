import os
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env", override=False)


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


class Config:
    ENV = os.getenv("APP_ENV", "development").lower()
    TESTING = _bool("TESTING")
    DEBUG = _bool("DEBUG")
    SECRET_KEY = os.getenv("SECRET_KEY", "")

    USE_SQLITE = _bool("USE_SQLITE", ENV != "production")
    SQLITE_PATH = os.getenv("SQLITE_PATH", str(PROJECT_ROOT / "backend" / "dev.db"))
    DATABASE_URL = os.getenv("DATABASE_URL", "")
    PG_HOST = os.getenv("PG_HOST", "")
    PG_PORT = os.getenv("PG_PORT", "5432")
    PG_USER = os.getenv("PG_USER", "")
    PG_PASSWORD = os.getenv("PG_PASSWORD", "")
    PG_DATABASE = os.getenv("PG_DATABASE", "")
    PG_SSLMODE = os.getenv("PG_SSLMODE", "prefer" if ENV != "production" else "require")

    MAX_CONTENT_LENGTH = int(os.getenv("MAX_REQUEST_BYTES", str(6 * 1024 * 1024)))
    MAX_POST_LENGTH = int(os.getenv("MAX_POST_LENGTH", "5000"))
    MAX_COMMENT_LENGTH = int(os.getenv("MAX_COMMENT_LENGTH", "1000"))
    MAX_MESSAGE_LENGTH = int(os.getenv("MAX_MESSAGE_LENGTH", "4000"))
    # UPLOAD_FOLDER is retained as a fallback for existing local deployments.
    # Set UPLOAD_DIR to a persistent volume in production.
    UPLOAD_DIR = os.getenv(
        "UPLOAD_DIR",
        os.getenv("UPLOAD_FOLDER", str(PROJECT_ROOT / "backend" / "app" / "static" / "uploads")),
    )
    UPLOAD_FOLDER = UPLOAD_DIR
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
    CORS_ORIGINS = [v.strip() for v in os.getenv("CORS_ORIGINS", "http://localhost:8888").split(",") if v.strip()]
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8888")

    SESSION_TTL_HOURS = int(os.getenv("SESSION_TTL_HOURS", "168"))
    OTP_TTL_MINUTES = int(os.getenv("OTP_TTL_MINUTES", "10"))
    OTP_RESEND_SECONDS = int(os.getenv("OTP_RESEND_SECONDS", "60"))
    OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))
    PASSWORD_RESET_TTL_MINUTES = int(os.getenv("PASSWORD_RESET_TTL_MINUTES", "30"))

    RECAPTCHA_SITE_KEY = os.getenv("RECAPTCHA_SITE_KEY", "")
    RECAPTCHA_SECRET_KEY = os.getenv("RECAPTCHA_SECRET_KEY", "")
    RECAPTCHA_DISABLED = _bool("RECAPTCHA_DISABLED", ENV != "production")
    SKIP_EMAIL_VERIFICATION = _bool("SKIP_EMAIL_VERIFICATION", ENV != "production")
    GMAIL_CLIENT_ID = os.getenv("GMAIL_CLIENT_ID", "")
    GMAIL_CLIENT_SECRET = os.getenv("GMAIL_CLIENT_SECRET", "")
    GMAIL_REFRESH_TOKEN = os.getenv("GMAIL_REFRESH_TOKEN", "")
    EMAIL_FROM = os.getenv("EMAIL_FROM", "")

    SMS_PROVIDER = os.getenv("SMS_PROVIDER", "disabled").lower()
    SMS_WEBHOOK_URL = os.getenv("SMS_WEBHOOK_URL", "")
    SMS_WEBHOOK_TOKEN = os.getenv("SMS_WEBHOOK_TOKEN", "")
    SMS_FROM = os.getenv("SMS_FROM", "Novogramm")

    @classmethod
    def validate(cls, settings=None) -> None:
        """Validate either the class defaults or the active Flask configuration."""
        def value(name):
            if settings is None:
                return getattr(cls, name)
            return settings[name]

        errors = []
        environment = str(value("ENV")).lower()
        if environment == "production" and (not value("SECRET_KEY") or value("SECRET_KEY").startswith("change-me")):
            errors.append("SECRET_KEY must be a strong, non-default value")
        if not value("USE_SQLITE") and not value("DATABASE_URL") and not all(
            [value("PG_HOST"), value("PG_USER"), value("PG_PASSWORD"), value("PG_DATABASE")]
        ):
            errors.append("DATABASE_URL or all PG_HOST/PG_USER/PG_PASSWORD/PG_DATABASE values are required")
        if environment == "production" and value("USE_SQLITE"):
            errors.append("USE_SQLITE=false is required in production")
        if environment == "production" and value("RECAPTCHA_DISABLED"):
            errors.append("RECAPTCHA_DISABLED=false is required in production")
        if environment == "production" and not value("RECAPTCHA_SECRET_KEY"):
            errors.append("RECAPTCHA_SECRET_KEY is required in production")
        if environment == "production" and value("SKIP_EMAIL_VERIFICATION"):
            errors.append("SKIP_EMAIL_VERIFICATION=false is required in production")
        if environment == "production" and not value("GMAIL_CLIENT_ID"):
            errors.append("GMAIL_CLIENT_ID is required in production")
        if environment == "production" and not value("GMAIL_CLIENT_SECRET"):
            errors.append("GMAIL_CLIENT_SECRET is required in production")
        if environment == "production" and not value("GMAIL_REFRESH_TOKEN"):
            errors.append("GMAIL_REFRESH_TOKEN is required in production")
        if environment == "production" and not value("EMAIL_FROM"):
            errors.append("EMAIL_FROM is required in production")
        if errors:
            raise RuntimeError("Invalid application configuration: " + "; ".join(errors))
