"""Health check and version endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.redis_client import get_redis
from app.schemas.common import HealthResponse

router = APIRouter(tags=["health"])
settings = get_settings()


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION,
        environment=settings.ENV,
    )


@router.get(
    "/health/ready", response_model=dict, summary="Readiness probe (checks DB + Redis)"
)
async def ready(
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
) -> dict:
    checks: dict[str, str] = {}

    try:
        await db.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as exc:
        checks["postgres"] = f"error: {exc}"

    try:
        await redis.ping()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"error: {exc}"

    all_ok = all(v == "ok" for v in checks.values())
    return {"status": "ready" if all_ok else "degraded", "checks": checks}


@router.get("/version", response_model=dict, summary="API version info")
async def version_info() -> dict:
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "api_versions": ["v1"],
    }
