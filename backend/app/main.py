"""VaxAI Vision — FastAPI application entry point."""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.api.health import router as health_router
from app.api.v1.router import router as v1_router
from app.config import get_settings
from app.core.audit import router as audit_router
from app.core.hipaa_middleware import HttpsEnforcementMiddleware, PhiAuditMiddleware
from app.core.input_sanitizer import SanitizationMiddleware
from app.core.logging_config import configure_logging
from app.core.metrics import metrics_endpoint
from app.core.middleware import (
    ErrorTrackingMiddleware,
    RequestIdMiddleware,
    RequestTimingMiddleware,
)
from app.core.rate_limiter import limiter, rate_limit_exceeded_handler
from app.core.tenant_context import tenant_context_middleware
from app.redis_client import close_redis, get_redis_pool

settings = get_settings()

# ── Logging — configure before anything else logs ─────────────────────────────
configure_logging(level="DEBUG" if settings.DEBUG else "INFO")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Warm Redis pool on startup
    get_redis_pool()
    yield
    # Graceful shutdown
    await close_redis()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "AI-driven vaccine supply chain intelligence platform. "
        "Provides real-time forecasting, inventory management, and "
        "supply chain optimisation for healthcare systems."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ── Rate limiter — attach state and exception handler ─────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)  # type: ignore[arg-type]

# ── Security headers middleware ────────────────────────────────────────────────
# Applied as the outermost layer so every response carries these headers,
# including error responses emitted by inner middleware.
from starlette.middleware.base import BaseHTTPMiddleware  # noqa: E402


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add OWASP-recommended security response headers to every reply."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=()"
        )
        return response


# ── Middleware stack ───────────────────────────────────────────────────────────
# Starlette executes add_middleware() registrations in LIFO order — the last
# added runs outermost.  Desired execution order (outermost → innermost):
#   SecurityHeaders → ErrorTracking → RequestId → RequestTiming
#   → HIPAA → SanitizationMiddleware → handler

app.add_middleware(ErrorTrackingMiddleware)
app.add_middleware(RequestTimingMiddleware)
app.add_middleware(RequestIdMiddleware)

# ── Tenant context — parse JWT and populate contextvars on every request ───────
# Runs early so downstream handlers can call current_tenant_context().
app.middleware("http")(tenant_context_middleware)

# ── Input sanitization ────────────────────────────────────────────────────────
app.add_middleware(SanitizationMiddleware)

# ── HIPAA Safeguards ──────────────────────────────────────────────────────────
# HTTPS enforcement is active in staging/production; skipped locally.
app.add_middleware(
    HttpsEnforcementMiddleware,
    enforce=settings.ENFORCE_HTTPS and settings.ENV in ("staging", "production"),
)
app.add_middleware(PhiAuditMiddleware)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Tightened: explicit methods and headers instead of wildcard "*".
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Request-ID"],
    expose_headers=["X-Request-ID", "Retry-After"],
    max_age=600,  # Pre-flight cache: 10 minutes
)

# ── Security headers (outermost — added last so it runs first) ─────────────────
app.add_middleware(SecurityHeadersMiddleware)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health_router)             # /health, /health/ready, /health/deep, /version
app.include_router(v1_router, prefix="/api")  # /api/v1/...
app.include_router(audit_router, prefix="/api/v1")  # /api/v1/audit/logs

# ── Prometheus metrics endpoint ────────────────────────────────────────────────
# Mounted as a raw Starlette route so prometheus_client's generate_latest()
# can return the correct Content-Type without FastAPI JSON serialisation.
app.add_route("/metrics", metrics_endpoint, include_in_schema=False)
