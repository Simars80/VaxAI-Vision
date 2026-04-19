"""Comprehensive audit logging for VaxAI Vision data mutations.

Usage
-----
Decorate route handlers with @audit_action to automatically log CREATE /
READ / UPDATE / DELETE events:

    @router.post("/vaccines")
    @audit_action("Vaccine", action="CREATE")
    async def create_vaccine(body: VaccineCreate, ...):
        ...

The decorator captures:
  - Authenticated user (if present on request.state.current_user)
  - Action (CREATE | READ | UPDATE | DELETE)
  - resource_type and resource_id
  - old_value / new_value (supplied by the handler via return value metadata
    or by passing them explicitly)
  - Client IP address
  - Timestamp (UTC)

The DB write is fire-and-forget (asyncio.create_task) so it never slows down
the primary request.  Write errors are logged but not surfaced to callers.
"""

from __future__ import annotations

import asyncio
import functools
import json
import logging
import uuid
from datetime import UTC, datetime
from enum import Enum
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import Mapped, mapped_column

from app.core.rbac import require_admin
from app.database import AsyncSessionLocal, Base, get_db
from app.models.user import User

logger = logging.getLogger(__name__)


# ── Action enum ────────────────────────────────────────────────────────────────


class AuditAction(str, Enum):
    CREATE = "CREATE"
    READ = "READ"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


# ── SQLAlchemy model ───────────────────────────────────────────────────────────


class AuditLog(Base):
    """Immutable audit log — rows should never be updated or deleted."""

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Who performed the action (null for unauthenticated / system actions)
    user_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    user_email: Mapped[str | None] = mapped_column(String(320), nullable=True)

    action: Mapped[str] = mapped_column(String(16), nullable=False)  # AuditAction value
    resource_type: Mapped[str] = mapped_column(String(128), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # JSON-serialised snapshots (nullable — READ events rarely carry these)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    endpoint: Mapped[str | None] = mapped_column(String(512), nullable=True)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


# ── Internal writer ────────────────────────────────────────────────────────────


def _to_json(value: Any) -> str | None:
    if value is None:
        return None
    try:
        return json.dumps(value, default=str)
    except (TypeError, ValueError):
        return str(value)


async def _write_audit_log(
    *,
    user_id: uuid.UUID | None,
    user_email: str | None,
    action: str,
    resource_type: str,
    resource_id: str | None,
    old_value: Any,
    new_value: Any,
    ip_address: str | None,
    endpoint: str | None,
) -> None:
    """Write an AuditLog row using its own short-lived session."""
    entry = AuditLog(
        user_id=user_id,
        user_email=user_email,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        old_value=_to_json(old_value),
        new_value=_to_json(new_value),
        ip_address=ip_address,
        endpoint=endpoint,
    )
    try:
        async with AsyncSessionLocal() as session:
            session.add(entry)
            await session.commit()
    except Exception as exc:
        logger.error("Audit log write failed: %s", exc, exc_info=True)


def _extract_ip(request: Request) -> str | None:
    ip = request.headers.get("x-forwarded-for") or (
        request.client.host if request.client else None
    )
    if ip:
        return ip.split(",")[0].strip()[:45]
    return None


# ── Public helper ──────────────────────────────────────────────────────────────


async def emit_audit(
    *,
    request: Request,
    action: AuditAction | str,
    resource_type: str,
    resource_id: Any = None,
    old_value: Any = None,
    new_value: Any = None,
) -> None:
    """Fire-and-forget audit log emission — call this inside route handlers."""
    user: Any = getattr(request.state, "current_user", None)
    user_id: uuid.UUID | None = getattr(user, "id", None)
    user_email: str | None = getattr(user, "email", None)

    asyncio.create_task(
        _write_audit_log(
            user_id=user_id,
            user_email=user_email,
            action=str(action),
            resource_type=resource_type,
            resource_id=resource_id,
            old_value=old_value,
            new_value=new_value,
            ip_address=_extract_ip(request),
            endpoint=str(request.url.path)[:512],
        )
    )


# ── Decorator ─────────────────────────────────────────────────────────────────


def audit_action(resource_type: str, action: AuditAction | str = AuditAction.CREATE):
    """Decorator that emits an audit log after the route handler completes.

    The route handler must accept a `request: Request` parameter (FastAPI
    injects this automatically when it is declared).

    The return value of the handler is JSON-serialised as ``new_value`` for
    CREATE/UPDATE actions.  For READ/DELETE the decorator only records the
    event; payload capture is optional (set ``old_value`` / ``new_value`` by
    calling ``emit_audit`` directly from inside the handler).
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            request: Request | None = kwargs.get("request")
            if request is None:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break

            result = await func(*args, **kwargs)

            new_val: Any = None
            if action in (AuditAction.CREATE, AuditAction.UPDATE, "CREATE", "UPDATE"):
                try:
                    new_val = result.model_dump() if hasattr(result, "model_dump") else None
                except Exception:
                    new_val = None

            if request is not None:
                user: Any = getattr(request.state, "current_user", None)
                user_id: uuid.UUID | None = getattr(user, "id", None)
                user_email: str | None = getattr(user, "email", None)
                asyncio.create_task(
                    _write_audit_log(
                        user_id=user_id,
                        user_email=user_email,
                        action=str(action),
                        resource_type=resource_type,
                        resource_id=None,
                        old_value=None,
                        new_value=new_val,
                        ip_address=_extract_ip(request),
                        endpoint=str(request.url.path)[:512],
                    )
                )

            return result

        return wrapper

    return decorator


# ── Admin query router ─────────────────────────────────────────────────────────

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs")
async def get_audit_logs(
    resource_type: str | None = None,
    action: str | None = None,
    limit: int = 100,
    offset: int = 0,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Return paginated audit log entries.  Admin-only."""
    if limit > 500:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="limit must be <= 500",
        )
    query = select(AuditLog).order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if action:
        query = query.where(AuditLog.action == action.upper())
    result = await db.execute(query)
    logs = result.scalars().all()
    return [
        {
            "id": str(log.id),
            "user_id": str(log.user_id) if log.user_id else None,
            "user_email": log.user_email,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "ip_address": log.ip_address,
            "endpoint": log.endpoint,
            "timestamp": log.timestamp.isoformat(),
        }
        for log in logs
    ]
