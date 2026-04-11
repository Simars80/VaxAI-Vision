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


@lru_cache
def get_settings() -> Settings:
    return Settings()
