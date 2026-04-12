"""VaxAI Vision â FastAPI application entry point."""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.v1.router import router as v1_router
from app.config import get_settings
from app.core.hipaa_middleware import HttpsEnforcementMiddleware, PhiAuditMiddleware
from app.redis_client import close_redis, get_redis_pool

settings = get_settings()


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

# ââ HIPAA Safeguards âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
# HTTPS enforcement is active in staging/production; skipped locally.
app.add_middleware(
    HttpsEnforcementMiddleware,
    enforce=settings.ENFORCE_HTTPS and settings.ENV in ("staging", "production"),
)
app.add_middleware(PhiAuditMiddleware)

# ââ CORS âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ââ Routers ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
app.include_router(health_router)  # /health, /health/ready, /version
app.include_router(v1_router, prefix="/api")  # /api/v1/...
