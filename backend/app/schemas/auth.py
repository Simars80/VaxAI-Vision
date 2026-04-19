from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


# ── Request schemas ────────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    role: UserRole = UserRole.viewer
    # Legacy alpha-2 code (kept for compatibility)
    country_code: str | None = Field(default=None, min_length=2, max_length=2)
    # Tenant assignment — all optional at registration
    country_id: uuid.UUID | None = None
    organization_id: uuid.UUID | None = None
    facility_id: uuid.UUID | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Response schemas ───────────────────────────────────────────────────────────


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    is_demo: bool = False
    # Tenant context surfaced to the frontend so it can route/display correctly
    tenant_context: dict[str, Any] | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    # Legacy field
    country_code: str | None
    # Tenant fields
    country_id: uuid.UUID | None = None
    organization_id: uuid.UUID | None = None
    facility_id: uuid.UUID | None = None

    model_config = {"from_attributes": True}


class MeResponse(UserResponse):
    pass
