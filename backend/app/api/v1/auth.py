"""Authentication endpoints: register, login, refresh, logout, me."""

from datetime import UTC, datetime

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config import get_settings
from app.core.security import (
    create_access_token,
    create_demo_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    is_token_revoked_key,
    verify_password,
)
from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.redis_client import get_redis
from app.schemas.auth import (
    LoginRequest,
    MeResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _build_access_token(user: User) -> str:
    """Create an access token with all tenant claims embedded."""
    return create_access_token(
        user_id=str(user.id),
        role=user.role,
        country_id=user.country_id,
        organization_id=user.organization_id,
        facility_id=user.facility_id,
    )


@router.post(
    "/register", response_model=MeResponse, status_code=status.HTTP_201_CREATED
)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> User:
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered.",
        )
    user = User(
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=body.role,
        country_code=body.country_code,
        # Tenant assignment from registration request (all optional)
        country_id=body.country_id,
        organization_id=body.organization_id,
        facility_id=body.facility_id,
    )
    db.add(user)
    await db.flush()
    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account.",
        )
    return TokenResponse(
        access_token=_build_access_token(user),
        refresh_token=create_refresh_token(str(user.id)),
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        tenant_context={
            "country_id": str(user.country_id) if user.country_id else None,
            "organization_id": str(user.organization_id) if user.organization_id else None,
            "facility_id": str(user.facility_id) if user.facility_id else None,
        },
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> TokenResponse:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token.",
    )
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise credentials_exc
        user_id: str = payload["sub"]
        jti: str = payload["jti"]
    except (JWTError, KeyError):
        raise credentials_exc

    # Check revocation
    if await redis.get(is_token_revoked_key(jti)):
        raise credentials_exc

    import uuid as _uuid

    result = await db.execute(select(User).where(User.id == _uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise credentials_exc

    # Revoke the used refresh token
    exp = payload.get("exp", 0)
    ttl = max(int(exp - datetime.now(UTC).timestamp()), 1)
    await redis.setex(is_token_revoked_key(jti), ttl, "1")

    return TokenResponse(
        access_token=_build_access_token(user),
        refresh_token=create_refresh_token(str(user.id)),
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        tenant_context={
            "country_id": str(user.country_id) if user.country_id else None,
            "organization_id": str(user.organization_id) if user.organization_id else None,
            "facility_id": str(user.facility_id) if user.facility_id else None,
        },
    )


DEMO_USER_EMAIL = "demo@vaxaivision.com"


@router.post("/demo-login", response_model=TokenResponse)
async def demo_login(db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Issue a 2-hour JWT for the fixed demo account — no credentials required."""
    result = await db.execute(select(User).where(User.email == DEMO_USER_EMAIL))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Demo mode is temporarily unavailable.",
        )
    return TokenResponse(
        access_token=create_demo_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        expires_in=120 * 60,
        is_demo=True,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    current_user: User = Depends(get_current_active_user),
    redis: aioredis.Redis = Depends(get_redis),
) -> None:
    # Revocation is handled client-side token discard + refresh blacklisting on /refresh.
    # For access tokens, short TTL suffices; production can extend this with JTI blacklist.
    pass


@router.get("/me", response_model=MeResponse)
async def me(current_user: User = Depends(get_current_active_user)) -> User:
    return current_user
