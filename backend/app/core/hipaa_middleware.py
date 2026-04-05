"""HIPAA technical-safeguard middleware for VaxAI Vision.

Implements:
  1. HTTPS enforcement  — redirect HTTP → HTTPS (§ 164.312(e)(1))
  2. PHI access logging — emit PhiAccessLog for routes touching PHI
     (§ 164.312(b) Audit Controls)
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

from app.core.phi_classification import PHI_RESOURCE_TYPES
from app.database import AsyncSessionLocal
from app.models.phi_audit import PhiAccessLog

logger = logging.getLogger(__name__)

# Routes whose path prefix indicates PHI access
_PHI_ROUTE_PREFIXES = (
    "/api/v1/ingestion/fhir",
    "/api/v1/patients",
    "/api/v1/supply",
)

# HTTP methods that mutate data
_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _route_touches_phi(path: str, method: str) -> str | None:
    """Return the PHI resource type if this route touches PHI, else None."""
    for prefix in _PHI_ROUTE_PREFIXES:
        if path.startswith(prefix):
            if "patient" in path:
                return "PatientCensus"
            if "fhir" in path:
                return "FHIRIngestion"
            if "supply" in path:
                return "SupplyTransaction"
            return "Unknown"
    return None


# ── 1. HTTPS Enforcement ───────────────────────────────────────────────────────


class HttpsEnforcementMiddleware(BaseHTTPMiddleware):
    """Redirect plain-HTTP requests to HTTPS in production environments.

    In development (X-Forwarded-Proto absent and scheme is http) the middleware
    is a no-op so local testing isn't interrupted.
    """

    def __init__(self, app: ASGIApp, enforce: bool = True) -> None:
        super().__init__(app)
        self._enforce = enforce

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not self._enforce:
            return await call_next(request)

        # Honour the proxy-set header (ALB / nginx → app)
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        if proto == "http":
            https_url = request.url.replace(scheme="https")
            return RedirectResponse(url=str(https_url), status_code=301)

        return await call_next(request)


# ── 2. PHI Access Logging ─────────────────────────────────────────────────────


class PhiAuditMiddleware(BaseHTTPMiddleware):
    """Emit a PhiAccessLog row for every request that touches PHI endpoints.

    The log entry is written *after* the response is produced so we can record
    the HTTP status code.  Failures to write the audit log are caught and
    re-raised — HIPAA requires audit logs to be reliable.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        resource_type = _route_touches_phi(request.url.path, request.method)

        if resource_type is None:
            # Not a PHI route — skip
            return await call_next(request)

        response = await call_next(request)
        outcome = "success" if response.status_code < 400 else (
            "denied" if response.status_code in (401, 403) else "error"
        )

        # Extract user context injected by the auth dependency (if available)
        user: Any = getattr(request.state, "current_user", None)
        user_id: uuid.UUID | None = getattr(user, "id", None)
        user_email: str | None = getattr(user, "email", None)
        user_role: str | None = getattr(user, "role", None)
        if user_role is not None:
            user_role = str(user_role)

        ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
        if ip:
            ip = ip.split(",")[0].strip()[:45]

        log_entry = PhiAccessLog(
            user_id=user_id,
            user_email=user_email,
            user_role=user_role,
            resource_type=resource_type,
            action=request.method,
            endpoint=str(request.url.path)[:512],
            ip_address=ip,
            user_agent=(request.headers.get("user-agent", "")[:1000] or None),
            outcome=outcome,
            http_status=response.status_code,
        )

        try:
            async with AsyncSessionLocal() as session:
                session.add(log_entry)
                await session.commit()
        except Exception as exc:
            # Log but do not suppress — audit failures must surface
            logger.error("HIPAA PHI audit log write failed: %s", exc, exc_info=True)
            raise

        return response
