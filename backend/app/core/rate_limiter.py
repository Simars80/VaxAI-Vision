"""Rate limiting configuration for VaxAI Vision API.

Uses slowapi (Starlette-compatible wrapper around limits) with Redis as the
distributed backend so limits are consistent across multiple worker processes.

Limit tiers
-----------
- auth      : 5 req / minute  — per IP  (login, register, demo-login)
- file      : 10 req / minute — per authenticated user
- api       : 100 req / minute — per authenticated user
- public    : 30 req / minute  — per IP  (health, /version, /metrics)
"""

from __future__ import annotations

import logging
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from limits.storage import RedisStorage
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _get_user_or_ip(request: Request) -> str:
    """Key function: use authenticated user-id when available, else remote IP."""
    user = getattr(request.state, "current_user", None)
    if user is not None:
        uid = getattr(user, "id", None)
        if uid is not None:
            return str(uid)
    return get_remote_address(request)


def _build_storage_uri() -> str:
    """Convert the app REDIS_URL to a limits-compatible storage URI."""
    # limits / slowapi expect a URI with scheme "redis://" or "rediss://"
    return settings.REDIS_URL


# ── Limiter instance ───────────────────────────────────────────────────────────

limiter = Limiter(
    key_func=_get_user_or_ip,
    storage_uri=_build_storage_uri(),
    # Swallow storage errors gracefully — don't block requests if Redis is down.
    swallow_errors=True,
)

# ── Convenience decorators (import these in route handlers) ────────────────────

#: 5 requests per minute — intended for auth endpoints keyed by IP.
rate_limit_auth: Callable = limiter.limit("5/minute", key_func=get_remote_address)

#: 100 requests per minute — general API endpoints keyed by user/IP.
rate_limit_api: Callable = limiter.limit("100/minute", key_func=_get_user_or_ip)

#: 30 requests per minute — public / health endpoints keyed by IP.
rate_limit_public: Callable = limiter.limit("30/minute", key_func=get_remote_address)

#: 10 requests per minute — file upload endpoints keyed by user/IP.
rate_limit_upload: Callable = limiter.limit("10/minute", key_func=_get_user_or_ip)


# ── 429 handler ────────────────────────────────────────────────────────────────


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """Return a JSON 429 with a Retry-After header."""
    retry_after: int = getattr(exc, "retry_after", 60) or 60
    logger.warning(
        "Rate limit exceeded | path=%s key=%s limit=%s",
        request.url.path,
        exc.detail,
        str(exc),
    )
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please slow down.",
            "retry_after_seconds": retry_after,
        },
        headers={"Retry-After": str(retry_after)},
    )
