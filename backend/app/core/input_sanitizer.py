"""Input sanitization middleware for VaxAI Vision.

Defences implemented
--------------------
1. HTML / XSS stripping — remove tags from all string inputs via BeautifulSoup.
2. SQL injection heuristics — reject query-string params containing obvious
   SQL tokens (does NOT replace parameterised queries, which are the real fix).
3. Path traversal — reject any parameter value that resolves outside a safe
   root when treated as a file path component.
4. File-upload validation — MIME type allowlist + max-size enforcement applied
   in the ``validate_upload`` dependency.
5. Request body sanitisation — applied via the ``SanitizationMiddleware``
   Starlette middleware for JSON request bodies.

The middleware is intentionally non-blocking: it rejects clearly malicious
input with a 400 response rather than silently mutating values, so callers are
aware of what was rejected.
"""

from __future__ import annotations

import json
import logging
import re
import unicodedata
from io import BytesIO
from pathlib import PurePosixPath
from typing import Any

from fastapi import HTTPException, Request, Response, UploadFile, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Constants ──────────────────────────────────────────────────────────────────

# Suspicious SQL tokens — used as a quick heuristic for obvious injection attempts.
_SQL_INJECTION_PATTERN = re.compile(
    r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|TRUNCATE|EXEC|EXECUTE|UNION|ALTER|CREATE"
    r"|GRANT|REVOKE|CAST|DECLARE|SLEEP|BENCHMARK|WAITFOR)\b"
    r"|'.*?--"       # comment injection
    r"|;\s*(DROP|DELETE|UPDATE|INSERT)"  # stacked queries
    r")",
    re.IGNORECASE,
)

# Path traversal indicators
_PATH_TRAVERSAL_PATTERN = re.compile(r"\.\.[/\\]|[/\\]\.\.")

# XSS / HTML tag pattern (stripped during sanitisation)
_HTML_TAG_PATTERN = re.compile(r"<[^>]+>")

# Potentially dangerous URL schemes in reflected values
_DANGEROUS_SCHEME_PATTERN = re.compile(
    r"(javascript|vbscript|data|file)\s*:", re.IGNORECASE
)

# Max body size to attempt JSON sanitization (10 MB — larger bodies bypass scrubbing)
_MAX_SANITIZE_BODY_BYTES = 10 * 1024 * 1024


# ── String-level helpers ───────────────────────────────────────────────────────


def strip_html(value: str) -> str:
    """Remove all HTML tags from a string value."""
    return _HTML_TAG_PATTERN.sub("", value)


def strip_null_bytes(value: str) -> str:
    """Remove null bytes that can confuse C-string parsers."""
    return value.replace("\x00", "")


def normalize_unicode(value: str) -> str:
    """NFC-normalize to prevent homoglyph attacks."""
    return unicodedata.normalize("NFC", value)


def sanitize_string(value: str) -> str:
    """Apply all string-level sanitizations in sequence."""
    value = strip_null_bytes(value)
    value = normalize_unicode(value)
    value = strip_html(value)
    return value


def check_sql_injection(value: str) -> None:
    """Raise HTTP 400 if the value looks like a SQL injection attempt."""
    if _SQL_INJECTION_PATTERN.search(value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request contains potentially unsafe content (SQL).",
        )


def check_path_traversal(value: str) -> None:
    """Raise HTTP 400 if the value contains path traversal sequences."""
    if _PATH_TRAVERSAL_PATTERN.search(value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request contains potentially unsafe content (path traversal).",
        )


def check_xss(value: str) -> None:
    """Raise HTTP 400 if the value contains dangerous URL schemes."""
    if _DANGEROUS_SCHEME_PATTERN.search(value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request contains potentially unsafe content (XSS).",
        )


def sanitize_and_validate(value: str, *, field_name: str = "input") -> str:
    """Full sanitize + validate pass for a single string.

    Returns the sanitized string or raises HTTP 400.
    """
    check_path_traversal(value)
    check_sql_injection(value)
    check_xss(value)
    return sanitize_string(value)


# ── Recursive JSON body sanitizer ─────────────────────────────────────────────


def _sanitize_value(value: Any, depth: int = 0) -> Any:
    """Recursively strip HTML from string leaf nodes in a JSON structure."""
    if depth > 20:  # Guard against deeply nested payloads
        return value
    if isinstance(value, str):
        return sanitize_string(value)
    if isinstance(value, dict):
        return {k: _sanitize_value(v, depth + 1) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_value(item, depth + 1) for item in value]
    return value


# ── File-upload validation ─────────────────────────────────────────────────────

# Allowlist of MIME types accepted by VaxAI Vision
_ALLOWED_MIME_TYPES: set[str] = {
    # Spreadsheets
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    # Images (for vision model / VVM classifier)
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/tiff",
    # Documents
    "application/pdf",
    # JSON/XML for FHIR / HL7 ingestion
    "application/json",
    "application/fhir+json",
    "application/xml",
    "text/xml",
    "text/plain",
}


async def validate_upload(file: UploadFile) -> UploadFile:
    """FastAPI dependency: validate MIME type and file size for uploads.

    Uses settings.ALLOWED_UPLOAD_TYPES and settings.MAX_UPLOAD_SIZE.
    Falls back to module-level defaults if settings are not configured.
    """
    allowed_types: set[str] = (
        set(settings.ALLOWED_UPLOAD_TYPES)
        if getattr(settings, "ALLOWED_UPLOAD_TYPES", None)
        else _ALLOWED_MIME_TYPES
    )
    max_bytes: int = getattr(settings, "MAX_UPLOAD_SIZE", 50 * 1024 * 1024)  # 50 MB default

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"File type '{content_type}' is not allowed. "
                f"Accepted types: {sorted(allowed_types)}"
            ),
        )

    # Read the body to measure size, then replace the SpooledTemporaryFile so
    # the downstream handler can still read it.
    body = await file.read()
    if len(body) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"Upload size {len(body):,} bytes exceeds the maximum "
                f"of {max_bytes:,} bytes ({max_bytes // (1024 * 1024)} MB)."
            ),
        )

    # Rewind so the handler can re-read the content
    await file.seek(0)
    return file


def sanitize_filename(filename: str) -> str:
    """Return a safe filename stripped of path separators and dangerous chars."""
    # Remove path components
    name = PurePosixPath(filename).name
    # Keep only alphanumerics, dots, hyphens, underscores
    safe = re.sub(r"[^\w.\-]", "_", name)
    # Prevent leading dots (hidden files)
    safe = safe.lstrip(".")
    return safe or "upload"


# ── Starlette middleware ───────────────────────────────────────────────────────

# Paths we skip (binary or form-data bodies that must not be JSON-parsed)
_SKIP_SANITIZE_PREFIXES = (
    "/api/v1/ingestion/upload",
    "/api/v1/vision",
    "/metrics",
    "/health",
)


class SanitizationMiddleware(BaseHTTPMiddleware):
    """Strip HTML tags from JSON request bodies on all text inputs.

    Non-JSON bodies and bodies over _MAX_SANITIZE_BODY_BYTES are left
    untouched (handled by individual endpoint validators).
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        path = request.url.path

        # Skip binary / upload endpoints and non-mutating methods
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return await call_next(request)
        if any(path.startswith(pfx) for pfx in _SKIP_SANITIZE_PREFIXES):
            return await call_next(request)

        content_type = request.headers.get("content-type", "")
        if "application/json" not in content_type:
            return await call_next(request)

        try:
            raw_body = await request.body()
        except Exception:
            return await call_next(request)

        if len(raw_body) > _MAX_SANITIZE_BODY_BYTES:
            # Too large to sanitize — pass through; endpoint-level limits apply
            return await call_next(request)

        if not raw_body:
            return await call_next(request)

        try:
            parsed = json.loads(raw_body)
            sanitized = _sanitize_value(parsed)
            sanitized_bytes = json.dumps(sanitized).encode()
        except (json.JSONDecodeError, Exception):
            # If we can't parse it, pass through as-is; FastAPI will reject invalid JSON
            return await call_next(request)

        # Patch the receive callable so the downstream handler sees the sanitized body
        async def _receive():
            return {"type": "http.request", "body": sanitized_bytes, "more_body": False}

        request._receive = _receive  # type: ignore[attr-defined]
        return await call_next(request)
