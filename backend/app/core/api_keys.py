"""API key management for VaxAI Vision integration endpoints.

Provides:
  - APIKey SQLAlchemy model (stored with hashed key)
  - Secure key generation (prefix: vaxai_)
  - FastAPI dependency for validating API keys in the X-API-Key header
  - Scopes: dhis2:read/write, openlmis:read/write, msupply:read/write
"""

from __future__ import annotations

import hashlib
import logging
import secrets
import uuid
from datetime import UTC, datetime
from enum import Enum
from typing import Sequence

from fastapi import Depends, HTTPException, Security, status
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, get_db

logger = logging.getLogger(__name__)

# ── Scopes ─────────────────────────────────────────────────────────────────────

API_KEY_PREFIX = "vaxai_"

VALID_SCOPES: set[str] = {
    "dhis2:read",
    "dhis2:write",
    "openlmis:read",
    "openlmis:write",
    "msupply:read",
    "msupply:write",
}


class APIKeyScope(str, Enum):
    dhis2_read = "dhis2:read"
    dhis2_write = "dhis2:write"
    openlmis_read = "openlmis:read"
    openlmis_write = "openlmis:write"
    msupply_read = "msupply:read"
    msupply_write = "msupply:write"


# ── SQLAlchemy model ───────────────────────────────────────────────────────────


class APIKey(Base):
    """Stores hashed API keys — the plaintext key is only returned at creation."""

    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # SHA-256 hex digest of the raw key
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    # Comma-separated scope list, e.g. "dhis2:read,openlmis:read"
    scopes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Optional: which user / service account created this key
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), nullable=True
    )

    # ── helpers ────────────────────────────────────────────────────────────────

    @property
    def scope_set(self) -> set[str]:
        return {s.strip() for s in self.scopes.split(",") if s.strip()}

    def has_scope(self, scope: str) -> bool:
        return scope in self.scope_set

    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return datetime.now(UTC) > self.expires_at


# ── Key generation ─────────────────────────────────────────────────────────────


def generate_api_key() -> tuple[str, str]:
    """Generate a new API key.

    Returns
    -------
    (raw_key, key_hash)
        raw_key  — the plaintext key to hand to the caller (shown once only)
        key_hash — the SHA-256 hex digest to persist in the database
    """
    token = secrets.token_urlsafe(32)
    raw_key = f"{API_KEY_PREFIX}{token}"
    key_hash = _hash_key(raw_key)
    return raw_key, key_hash


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


# ── FastAPI dependency ─────────────────────────────────────────────────────────

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def get_api_key(
    raw_key: str | None = Security(_api_key_header),
    db: AsyncSession = Depends(get_db),
) -> APIKey:
    """Dependency: validate the X-API-Key header and return the APIKey record.

    Raises HTTP 401 if the key is missing, unknown, inactive, or expired.
    """
    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required. Provide a valid X-API-Key header.",
        )
    key_hash = _hash_key(raw_key)
    result = await db.execute(select(APIKey).where(APIKey.key_hash == key_hash))
    api_key: APIKey | None = result.scalar_one_or_none()

    if api_key is None or not api_key.is_active:
        logger.warning("Invalid or inactive API key attempt (hash prefix: %s…)", key_hash[:8])
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key.",
        )

    if api_key.is_expired():
        logger.warning("Expired API key used: id=%s name=%s", api_key.id, api_key.name)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key has expired.",
        )

    return api_key


def require_scope(scope: str):
    """Return a dependency that additionally enforces a specific scope."""

    async def _check(api_key: APIKey = Depends(get_api_key)) -> APIKey:
        if not api_key.has_scope(scope):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"API key does not have the required scope: {scope}",
            )
        return api_key

    return _check
