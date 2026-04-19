from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Application
    APP_NAME: str = "VaxAI Vision API"
    APP_VERSION: str = "1.0.0"
    ENV: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False
    ENFORCE_HTTPS: bool = True  # Set False when no SSL termination proxy is present

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://vaxai:vaxai_dev_password@localhost:5432/vaxai_vision"
    )

    # Redis
    REDIS_URL: str = Field(default="redis://:vaxai_redis_dev@localhost:6379/0")

    # JWT
    JWT_SECRET_KEY: str = Field(
        default="change-me-in-production-use-strong-secret-32chars"
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://vaxaivision.com",
        "https://www.vaxaivision.com",
        "https://app.vaxaivision.com",
    ]

    # ── Rate limiting ──────────────────────────────────────────────────────────
    RATE_LIMIT_ENABLED: bool = True
    # Default limit string used as fallback (slowapi format: "N/period")
    RATE_LIMIT_DEFAULT: str = "100/minute"

    # ── API key authentication ─────────────────────────────────────────────────
    API_KEY_ENABLED: bool = True

    # ── File uploads ───────────────────────────────────────────────────────────
    # Allowlist of accepted MIME types for uploaded files.
    # An empty list means the module-level defaults in input_sanitizer.py apply.
    ALLOWED_UPLOAD_TYPES: list[str] = []
    # Maximum upload size in bytes (default: 50 MB)
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024

    # ── Encryption at rest ─────────────────────────────────────────────────────
    ENCRYPTION_AT_REST_ENABLED: bool = False
    # AWS KMS CMK ARN for envelope encryption (optional; falls back to local Fernet)
    KMS_KEY_ARN: str = ""
    # Fernet key(s) — comma-separated for rotation support.
    # Generate with: python -c "from app.core.encryption import generate_fernet_key; print(generate_fernet_key())"
    ENCRYPTION_KEY: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
