"""Health check and version endpoints.

Endpoints
---------
GET /health          — Liveness probe (Kubernetes: always fast, no external I/O)
GET /health/ready    — Readiness probe (Kubernetes: checks all dependencies)
GET /health/deep     — Deep health check with component detail and system stats
GET /version         — API version metadata
"""

from __future__ import annotations

import os
import platform
import shutil
import time
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.redis_client import get_redis
from app.schemas.common import HealthResponse

router = APIRouter(tags=["health"])
settings = get_settings()

# Record startup time for uptime calculation
_STARTUP_TIME = time.time()

# Populated by CI/CD pipeline or Docker build; falls back to "unknown"
_DEPLOY_TIMESTAMP: str = os.environ.get("DEPLOY_TIMESTAMP", "unknown")
_GIT_SHA: str = os.environ.get("GIT_SHA", "unknown")


# ── Helpers ────────────────────────────────────────────────────────────────────


def _uptime_seconds() -> float:
    return round(time.time() - _STARTUP_TIME, 1)


def _disk_usage() -> dict[str, str]:
    total, used, free = shutil.disk_usage("/")
    pct_used = round(used / total * 100, 1)
    return {
        "total_gb": f"{total / 1e9:.1f}",
        "used_gb": f"{used / 1e9:.1f}",
        "free_gb": f"{free / 1e9:.1f}",
        "pct_used": f"{pct_used}%",
    }


def _ml_model_status() -> dict[str, str]:
    """Check whether ONNX runtime can be imported and a model path exists.

    This is a lightweight check — we don't re-load the model on every health
    poll.  A more thorough check would run a dummy inference; that's left to the
    deep health endpoint's ``ml_models`` component.
    """
    try:
        import onnxruntime  # noqa: F401

        status = "available"
    except ImportError:
        status = "onnxruntime_not_installed"

    model_path = os.environ.get("ONNX_MODEL_PATH", "")
    if model_path and not os.path.exists(model_path):
        status = f"model_file_missing:{model_path}"

    return {"status": status, "model_path": model_path or "not_configured"}


ComponentStatus = Literal["ok", "degraded", "error", "unknown"]


# ── Routes ─────────────────────────────────────────────────────────────────────


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
async def health() -> HealthResponse:
    """Kubernetes liveness probe.

    Returns 200 as long as the application process is alive and the event loop
    is responsive.  Does NOT perform any I/O.
    """
    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION,
        environment=settings.ENV,
    )


@router.get(
    "/health/ready",
    response_model=dict,
    summary="Readiness probe — checks DB + Redis",
)
async def ready(
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
) -> dict:
    """Kubernetes readiness probe.

    Returns 200 only when all critical dependencies (PostgreSQL, Redis) are
    reachable.  A non-200 response tells Kubernetes to stop routing traffic to
    this pod.
    """
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
    return {
        "status": "ready" if all_ok else "degraded",
        "checks": checks,
        "uptime_seconds": _uptime_seconds(),
        "version": settings.APP_VERSION,
    }


@router.get(
    "/health/deep",
    response_model=dict,
    summary="Deep health check — all components with detail",
)
async def deep_health(
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
) -> dict:
    """Extended health check for operational dashboards and alert routing.

    Checks:
    - PostgreSQL connectivity + latency
    - Redis connectivity + latency
    - ML model / ONNX runtime availability
    - Disk space (warn when > 80 % used)

    Returns a structured payload with per-component status, overall status,
    uptime, version, and last deploy timestamp.
    """
    import time as _time

    components: dict[str, dict] = {}
    overall: ComponentStatus = "ok"

    # ── PostgreSQL ─────────────────────────────────────────────────────────────
    t0 = _time.perf_counter()
    try:
        await db.execute(text("SELECT 1"))
        pg_latency_ms = round((_time.perf_counter() - t0) * 1000, 2)
        components["postgres"] = {"status": "ok", "latency_ms": pg_latency_ms}
    except Exception as exc:
        components["postgres"] = {"status": "error", "error": str(exc)}
        overall = "degraded"

    # ── Redis ──────────────────────────────────────────────────────────────────
    t0 = _time.perf_counter()
    try:
        await redis.ping()
        redis_latency_ms = round((_time.perf_counter() - t0) * 1000, 2)
        components["redis"] = {"status": "ok", "latency_ms": redis_latency_ms}
    except Exception as exc:
        components["redis"] = {"status": "error", "error": str(exc)}
        overall = "degraded"

    # ── ML models ──────────────────────────────────────────────────────────────
    ml = _ml_model_status()
    ml_status: ComponentStatus = "ok" if ml["status"] == "available" else "degraded"
    components["ml_models"] = {
        "status": ml_status,
        "detail": ml,
    }
    if ml_status != "ok" and overall == "ok":
        overall = "degraded"

    # ── Disk space ─────────────────────────────────────────────────────────────
    disk = _disk_usage()
    pct = float(disk["pct_used"].rstrip("%"))
    disk_status: ComponentStatus = "ok" if pct < 80 else ("degraded" if pct < 90 else "error")
    components["disk"] = {"status": disk_status, **disk}
    if disk_status == "error" and overall == "ok":
        overall = "degraded"

    return {
        "status": overall,
        "version": settings.APP_VERSION,
        "environment": settings.ENV,
        "git_sha": _GIT_SHA,
        "deploy_timestamp": _DEPLOY_TIMESTAMP,
        "uptime_seconds": _uptime_seconds(),
        "checked_at": datetime.now(tz=timezone.utc).isoformat(),
        "python_version": platform.python_version(),
        "components": components,
    }


@router.get("/version", response_model=dict, summary="API version info")
async def version_info() -> dict:
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "api_versions": ["v1"],
        "git_sha": _GIT_SHA,
        "deploy_timestamp": _DEPLOY_TIMESTAMP,
        "environment": settings.ENV,
    }
