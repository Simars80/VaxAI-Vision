"""Observability middleware for VaxAI Vision.

Three middleware components (applied in order inside main.py):

1. RequestIdMiddleware  — generates a UUID request ID, attaches to response
                          headers, and seeds the logging context vars.
2. RequestTimingMiddleware — measures wall-clock request duration, records to
                             Prometheus and the performance log stream.
3. ErrorTrackingMiddleware — catches unhandled exceptions, logs full context,
                             then re-raises so FastAPI's exception handlers
                             can return a well-formed HTTP error.
"""

from __future__ import annotations

import logging
import time
import traceback
import uuid
from typing import Any

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

from app.core.logging_config import (
    correlation_id_var,
    facility_id_var,
    perf_logger,
    request_id_var,
    user_id_var,
)
from app.core.metrics import (
    ACTIVE_CONNECTIONS,
    REQUEST_COUNT,
    REQUEST_LATENCY,
)

logger = logging.getLogger("vaxai.app")

# Header names used for correlation-id propagation
_REQUEST_ID_HEADER = "X-Request-ID"
_CORRELATION_ID_HEADER = "X-Correlation-ID"


# ── 1. Request-ID middleware ───────────────────────────────────────────────────


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Generate (or echo) a UUID request ID and propagate it through context vars.

    - If the caller sends ``X-Correlation-ID``, that value is preserved as the
      correlation ID so distributed traces remain linked.
    - A fresh UUID is always generated for ``X-Request-ID`` to uniquely identify
      this service's processing of the request.
    - Both IDs are written back into the response headers.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = str(uuid.uuid4())
        correlation_id = request.headers.get(_CORRELATION_ID_HEADER, request_id)

        # Seed logging context vars (thread-safe via contextvars)
        request_id_token = request_id_var.set(request_id)
        correlation_id_token = correlation_id_var.set(correlation_id)

        # Expose IDs on request.state so other code can read them without importing
        request.state.request_id = request_id
        request.state.correlation_id = correlation_id

        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(request_id_token)
            correlation_id_var.reset(correlation_id_token)

        response.headers[_REQUEST_ID_HEADER] = request_id
        response.headers[_CORRELATION_ID_HEADER] = correlation_id
        return response


# ── 2. Request-timing middleware ───────────────────────────────────────────────


def _normalise_path(path: str) -> str:
    """Collapse path segments that are UUIDs or numeric IDs to ``{id}`` so
    Prometheus cardinality stays bounded.

    Examples:
        /api/v1/inventory/abc123-...  → /api/v1/inventory/{id}
        /api/v1/facilities/42/stock   → /api/v1/facilities/{id}/stock
    """
    import re

    path = re.sub(
        r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
        "/{id}",
        path,
    )
    path = re.sub(r"/\d+", "/{id}", path)
    return path


class RequestTimingMiddleware(BaseHTTPMiddleware):
    """Record wall-clock request duration in Prometheus and the perf log stream.

    Also tracks the active-connections gauge so we can alert on connection
    exhaustion under load.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        ACTIVE_CONNECTIONS.inc()
        start = time.perf_counter()
        status_code = 500  # fallback if call_next raises

        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            duration = time.perf_counter() - start
            ACTIVE_CONNECTIONS.dec()

            endpoint = _normalise_path(request.url.path)
            method = request.method

            REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(duration)
            REQUEST_COUNT.labels(
                method=method,
                endpoint=endpoint,
                status_code=str(status_code),
            ).inc()

            # Performance structured log (only for non-health-check paths to reduce noise)
            if not request.url.path.startswith("/health"):
                perf_logger.info(
                    "request_completed",
                    extra={
                        "method": method,
                        "path": request.url.path,
                        "endpoint": endpoint,
                        "status_code": status_code,
                        "duration_ms": round(duration * 1000, 2),
                    },
                )


# ── 3. Error-tracking middleware ───────────────────────────────────────────────


class ErrorTrackingMiddleware(BaseHTTPMiddleware):
    """Catch unhandled exceptions, emit a structured error log, then re-raise.

    FastAPI / Starlette will convert the exception to a 500 response after the
    middleware chain unwinds.  We deliberately do NOT swallow the exception so
    FastAPI's ``exception_handler`` hooks still fire.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        try:
            return await call_next(request)
        except Exception as exc:
            user: Any = getattr(request.state, "current_user", None)
            uid = str(getattr(user, "id", None) or "")
            fid = str(getattr(request.state, "facility_id", None) or "")

            logger.error(
                "unhandled_exception",
                exc_info=exc,
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "user_id": uid,
                    "facility_id": fid,
                    "request_id": getattr(request.state, "request_id", None),
                    "exc_type": type(exc).__name__,
                    "exc_message": str(exc),
                    "traceback": traceback.format_exc(),
                },
            )
            raise
