"""Structured JSON logging configuration for VaxAI Vision.

Provides:
- Structured JSON log output suitable for log aggregation (CloudWatch, ELK, etc.)
- Separate log streams: application, security, performance, audit
- Context vars for request_id, user_id, facility_id, correlation_id propagation
- Standard Python logging — no extra runtime dependencies required.
"""

from __future__ import annotations

import json
import logging
import logging.config
import sys
import traceback
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any

# ── Context variables (propagated per-request) ────────────────────────────────

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
correlation_id_var: ContextVar[str | None] = ContextVar("correlation_id", default=None)
user_id_var: ContextVar[str | None] = ContextVar("user_id", default=None)
facility_id_var: ContextVar[str | None] = ContextVar("facility_id", default=None)


# ── JSON formatter ─────────────────────────────────────────────────────────────


class JsonFormatter(logging.Formatter):
    """Emit each log record as a single-line JSON object.

    Fixed fields on every record:
        timestamp, level, logger, message, stream

    Optional fields (present only when set):
        request_id, correlation_id, user_id, facility_id,
        exc_info, extra (any kwargs passed to the log call)
    """

    def __init__(self, stream_name: str = "application") -> None:
        super().__init__()
        self._stream_name = stream_name

    def format(self, record: logging.LogRecord) -> str:  # noqa: A002
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "stream": self._stream_name,
            "message": record.getMessage(),
        }

        # Inject context vars
        if (rid := request_id_var.get()) is not None:
            payload["request_id"] = rid
        if (cid := correlation_id_var.get()) is not None:
            payload["correlation_id"] = cid
        if (uid := user_id_var.get()) is not None:
            payload["user_id"] = uid
        if (fid := facility_id_var.get()) is not None:
            payload["facility_id"] = fid

        # Source location (useful in DEBUG / staging)
        payload["source"] = f"{record.pathname}:{record.lineno}"

        # Exception chain
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        if record.exc_text:
            payload["exc_text"] = record.exc_text

        # Any extra fields the caller passed via `extra={...}`
        _standard = logging.LogRecord.__dict__.keys() | {
            "message", "asctime", "args", "msg",
        }
        for key, value in record.__dict__.items():
            if key not in _standard and not key.startswith("_"):
                payload.setdefault("extra", {})[key] = value

        return json.dumps(payload, default=str)


# ── Handler factory ────────────────────────────────────────────────────────────


def _stdout_handler(stream_name: str, level: int = logging.DEBUG) -> logging.StreamHandler:
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    handler.setFormatter(JsonFormatter(stream_name=stream_name))
    return handler


# ── Public setup function ──────────────────────────────────────────────────────


def configure_logging(level: str = "INFO") -> None:
    """Configure the root logger and named stream loggers.

    Call this once at application startup (before the ASGI server begins
    accepting connections).

    Streams
    -------
    - ``vaxai.app``          — general application events
    - ``vaxai.security``     — auth, RBAC, HIPAA audit events
    - ``vaxai.performance``  — request timing, DB query durations, ML inference
    - ``vaxai.audit``        — immutable audit trail (always INFO+)

    All streams write to stdout as JSON; log shipping is handled by the
    container runtime / CloudWatch agent.
    """
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    # Silence noisy third-party loggers in production
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    # Named loggers — each gets its own handler so the stream field differs
    streams: dict[str, int] = {
        "vaxai.app": numeric_level,
        "vaxai.security": logging.INFO,   # security events always at INFO+
        "vaxai.performance": numeric_level,
        "vaxai.audit": logging.INFO,       # audit trail always at INFO+
    }

    for logger_name, log_level in streams.items():
        stream_short = logger_name.split(".", 1)[-1]  # e.g. "security"
        lgr = logging.getLogger(logger_name)
        lgr.setLevel(log_level)
        lgr.propagate = False  # do not bubble to root
        if not lgr.handlers:
            lgr.addHandler(_stdout_handler(stream_short, log_level))

    # Root logger: catch anything not claimed by a named logger
    root = logging.getLogger()
    root.setLevel(numeric_level)
    if not root.handlers:
        root.addHandler(_stdout_handler("application", numeric_level))


# ── Convenience accessors ──────────────────────────────────────────────────────

app_logger = logging.getLogger("vaxai.app")
security_logger = logging.getLogger("vaxai.security")
perf_logger = logging.getLogger("vaxai.performance")
audit_logger = logging.getLogger("vaxai.audit")


def log_security_event(event: str, **kwargs: Any) -> None:
    """Emit a structured security event to the security stream."""
    security_logger.info(event, extra=kwargs)


def log_audit_event(action: str, resource: str, outcome: str, **kwargs: Any) -> None:
    """Emit an immutable audit log entry."""
    audit_logger.info(
        "audit_event",
        extra={"action": action, "resource": resource, "outcome": outcome, **kwargs},
    )
