import uuid

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


# ── Request schemas ────────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    role: UserRole = UserRole.viewer
    country_code: str | None = Field(default=None, min_length=2, max_length=2)


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


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    country_code: str | None

    model_config = {"from_attributes": True}


class MeResponse(UserResponse):
    pass
