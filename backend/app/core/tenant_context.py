"""Tenant context management using Python contextvars.

Each incoming request sets a TenantContext that scopes all downstream DB queries
to the appropriate country / organization / facility / district.

Usage in route handlers:
    from app.core.tenant_context import get_tenant_context, TenantContext

    @router.get("/some-resource")
    async def handler(ctx: TenantContext = Depends(get_tenant_context)):
        print(ctx.country_id, ctx.facility_id)
"""

from __future__ import annotations

import uuid
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_token
from app.models.user import UserRole

# ── Internal ContextVar storage ───────────────────────────────────────────────

_tenant_ctx_var: ContextVar["TenantContext | None"] = ContextVar(
    "_tenant_ctx_var", default=None
)

_bearer = HTTPBearer(auto_error=False)


# ── TenantContext dataclass ────────────────────────────────────────────────────


@dataclass
class TenantContext:
    """Immutable snapshot of the calling user's tenant scope."""

    user_id: uuid.UUID | None = None
    role: UserRole = UserRole.viewer

    # Tenant assignment — None means "no restriction at that level"
    country_id: uuid.UUID | None = None
    organization_id: uuid.UUID | None = None
    facility_id: uuid.UUID | None = None
    district: str | None = None

    # Convenience flags
    is_demo: bool = False
    is_platform_admin: bool = field(init=False)

    def __post_init__(self) -> None:
        self.is_platform_admin = self.role in (UserRole.platform_admin, UserRole.admin)

    # ── Scope helpers ──────────────────────────────────────────────────────────

    @property
    def is_national_admin(self) -> bool:
        return self.role == UserRole.national_admin

    @property
    def is_district_manager(self) -> bool:
        return self.role == UserRole.district_manager

    @property
    def is_facility_scoped(self) -> bool:
        """Returns True when this user is restricted to a single facility."""
        return self.facility_id is not None and self.role in (
            UserRole.facility_manager,
            UserRole.clinician,
            UserRole.analyst,
            UserRole.viewer,
        )

    def can_access_country(self, country_id: uuid.UUID) -> bool:
        """Platform admins pass; national+ check country match."""
        if self.is_platform_admin:
            return True
        if self.country_id is None:
            return True  # unscoped user treated as platform-level
        return self.country_id == country_id

    def can_access_facility(self, facility_id: uuid.UUID) -> bool:
        """Check if this context may access the given facility."""
        if self.is_platform_admin or self.country_id is None:
            return True
        if self.facility_id is not None:
            return self.facility_id == facility_id
        # district managers or national admins with no facility restriction
        return True

    def to_dict(self) -> dict[str, Any]:
        return {
            "user_id": str(self.user_id) if self.user_id else None,
            "role": self.role,
            "country_id": str(self.country_id) if self.country_id else None,
            "organization_id": str(self.organization_id) if self.organization_id else None,
            "facility_id": str(self.facility_id) if self.facility_id else None,
            "district": self.district,
            "is_demo": self.is_demo,
        }


# ── Context setters / getters ─────────────────────────────────────────────────


def set_tenant_context(ctx: TenantContext) -> None:
    _tenant_ctx_var.set(ctx)


def current_tenant_context() -> TenantContext | None:
    """Retrieve the context set by the middleware (may be None outside a request)."""
    return _tenant_ctx_var.get()


# ── FastAPI dependency ─────────────────────────────────────────────────────────


def _parse_uuid(value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError):
        return None


async def get_tenant_context(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> TenantContext:
    """FastAPI dependency that builds a TenantContext from the JWT payload.

    If no valid token is present the context defaults to an anonymous viewer.
    Actual authentication enforcement is handled by get_current_active_user.
    """
    if credentials is None:
        # Anonymous / no token — return empty context (auth routes will reject)
        return TenantContext()

    try:
        from app.core.security import decode_token as _decode
        payload = _decode(credentials.credentials)
    except Exception:
        return TenantContext()

    if payload.get("type") != "access":
        return TenantContext()

    try:
        role = UserRole(payload.get("role", "viewer"))
    except ValueError:
        role = UserRole.viewer

    ctx = TenantContext(
        user_id=_parse_uuid(payload.get("sub")),
        role=role,
        country_id=_parse_uuid(payload.get("country_id")),
        organization_id=_parse_uuid(payload.get("organization_id")),
        facility_id=_parse_uuid(payload.get("facility_id")),
        district=payload.get("district"),
        is_demo=bool(payload.get("is_demo", False)),
    )
    set_tenant_context(ctx)
    return ctx


# ── Starlette middleware helper ────────────────────────────────────────────────


async def tenant_context_middleware(request: Request, call_next):  # type: ignore[type-arg]
    """ASGI middleware that parses the JWT and populates the context var.

    Register in main.py:
        app.middleware("http")(tenant_context_middleware)
    """
    auth_header = request.headers.get("Authorization", "")
    ctx = TenantContext()

    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            from app.core.security import decode_token as _decode
            payload = _decode(token)
            if payload.get("type") == "access":
                try:
                    role = UserRole(payload.get("role", "viewer"))
                except ValueError:
                    role = UserRole.viewer

                ctx = TenantContext(
                    user_id=_parse_uuid(payload.get("sub")),
                    role=role,
                    country_id=_parse_uuid(payload.get("country_id")),
                    organization_id=_parse_uuid(payload.get("organization_id")),
                    facility_id=_parse_uuid(payload.get("facility_id")),
                    district=payload.get("district"),
                    is_demo=bool(payload.get("is_demo", False)),
                )
        except Exception:
            pass  # leave ctx as empty TenantContext

    set_tenant_context(ctx)
    response = await call_next(request)
    # Reset after response to avoid context leakage in the same thread/task
    _tenant_ctx_var.set(None)
    return response
