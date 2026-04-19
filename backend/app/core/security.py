"""JWT creation/verification and password hashing utilities."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import jwt
from passlib.context import CryptContext

from app.config import get_settings

settings = get_settings()

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password helpers ───────────────────────────────────────────────────────────


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


# ── Token helpers ──────────────────────────────────────────────────────────────


def _create_token(data: dict[str, Any], expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(UTC) + expires_delta
    payload["iat"] = datetime.now(UTC)
    payload["jti"] = str(uuid.uuid4())
    return jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def _tenant_claims(
    country_id: uuid.UUID | str | None = None,
    organization_id: uuid.UUID | str | None = None,
    facility_id: uuid.UUID | str | None = None,
    district: str | None = None,
) -> dict[str, Any]:
    """Build the tenant-scoping claims for a JWT payload."""
    claims: dict[str, Any] = {}
    if country_id is not None:
        claims["country_id"] = str(country_id)
    if organization_id is not None:
        claims["organization_id"] = str(organization_id)
    if facility_id is not None:
        claims["facility_id"] = str(facility_id)
    if district is not None:
        claims["district"] = district
    return claims


def create_access_token(
    user_id: str,
    role: str,
    *,
    country_id: uuid.UUID | str | None = None,
    organization_id: uuid.UUID | str | None = None,
    facility_id: uuid.UUID | str | None = None,
    district: str | None = None,
) -> str:
    payload: dict[str, Any] = {
        "sub": user_id,
        "role": role,
        "type": "access",
    }
    payload.update(_tenant_claims(country_id, organization_id, facility_id, district))
    return _create_token(
        payload,
        timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        {"sub": user_id, "type": "refresh"},
        timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    )


def create_demo_access_token(user_id: str) -> str:
    """Create a 2-hour read-only access token for the demo user."""
    return _create_token(
        {"sub": user_id, "role": "viewer", "type": "access", "is_demo": True},
        timedelta(minutes=120),
    )


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT. Raises JWTError on failure."""
    payload = jwt.decode(
        token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )
    # Validate tenant fields if present — each must be a valid UUID string or absent
    for tenant_field in ("country_id", "organization_id", "facility_id"):
        value = payload.get(tenant_field)
        if value is not None:
            try:
                uuid.UUID(value)
            except (ValueError, AttributeError):
                from jose import JWTError
                raise JWTError(f"Invalid UUID in JWT claim '{tenant_field}'")
    return payload


def is_token_revoked_key(jti: str) -> str:
    """Redis key for revoked JTI tracking."""
    return f"revoked_jti:{jti}"
