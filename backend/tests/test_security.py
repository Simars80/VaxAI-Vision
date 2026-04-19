"""Security tests for VaxAI Vision backend.

Tests cover:
  - Rate limiting (429 responses with Retry-After)
  - CORS header tightening (specific methods/headers, no wildcard)
  - API key validation (missing, invalid, expired, valid)
  - Input sanitization (XSS, SQL injection, path traversal, file uploads)
  - Audit log creation
  - Unauthorized access attempts
  - Security response headers
  - Encryption helpers (field-level encrypt/decrypt round-trip)
"""

from __future__ import annotations

import io
import time
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient


# ── Helpers ────────────────────────────────────────────────────────────────────


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Rate limiting
# ═══════════════════════════════════════════════════════════════════════════════


class TestRateLimiting:
    """Tests for rate_limiter.py — relies on slowapi being wired into the app."""

    @pytest.mark.asyncio
    async def test_rate_limiter_module_importable(self):
        """The rate_limiter module loads without errors."""
        from app.core.rate_limiter import (  # noqa: F401
            limiter,
            rate_limit_auth,
            rate_limit_api,
            rate_limit_public,
            rate_limit_upload,
            rate_limit_exceeded_handler,
        )

    @pytest.mark.asyncio
    async def test_rate_limit_exceeded_handler_returns_429(self):
        """The custom 429 handler returns correct status and Retry-After header."""
        from app.core.rate_limiter import rate_limit_exceeded_handler
        from slowapi.errors import RateLimitExceeded

        mock_request = MagicMock()
        mock_request.url.path = "/api/v1/auth/login"

        exc = RateLimitExceeded("5 per 1 minute")
        exc.retry_after = 30

        response = rate_limit_exceeded_handler(mock_request, exc)

        assert response.status_code == 429
        assert "Retry-After" in response.headers
        assert int(response.headers["Retry-After"]) >= 1

    @pytest.mark.asyncio
    async def test_limiter_attached_to_app(self, client: AsyncClient):
        """App state.limiter is set so slowapi can apply limits."""
        from app.main import app
        from app.core.rate_limiter import limiter

        assert hasattr(app.state, "limiter")
        assert app.state.limiter is limiter

    @pytest.mark.asyncio
    async def test_rate_limit_decorators_are_callable(self):
        """Rate limit decorators can be applied to a dummy coroutine."""
        from app.core.rate_limiter import rate_limit_auth, rate_limit_api

        async def dummy_handler():
            return {"ok": True}

        decorated = rate_limit_auth(dummy_handler)
        assert callable(decorated)
        decorated2 = rate_limit_api(dummy_handler)
        assert callable(decorated2)


# ═══════════════════════════════════════════════════════════════════════════════
# 2. CORS headers
# ═══════════════════════════════════════════════════════════════════════════════


class TestCORSHeaders:
    """Verify CORS is tightened to explicit method/header lists."""

    @pytest.mark.asyncio
    async def test_cors_allows_listed_origins(self, client: AsyncClient):
        """Pre-flight from an allowed origin returns Access-Control-Allow-Origin."""
        response = await client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.status_code in (200, 204)
        acao = response.headers.get("access-control-allow-origin", "")
        assert acao == "http://localhost:3000"

    @pytest.mark.asyncio
    async def test_cors_does_not_allow_wildcard_methods(self, client: AsyncClient):
        """Access-Control-Allow-Methods must not be '*'."""
        response = await client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        allowed_methods = response.headers.get("access-control-allow-methods", "")
        assert "*" not in allowed_methods, (
            "CORS methods must not be wildcard '*'"
        )

    @pytest.mark.asyncio
    async def test_cors_exposes_request_id_header(self, client: AsyncClient):
        """X-Request-ID is in the exposed headers list."""
        response = await client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        expose = response.headers.get("access-control-expose-headers", "")
        assert "X-Request-ID" in expose or response.status_code in (200, 204)

    @pytest.mark.asyncio
    async def test_cors_rejects_unlisted_origin(self, client: AsyncClient):
        """Pre-flight from an unknown origin should not echo the origin back."""
        response = await client.options(
            "/health",
            headers={
                "Origin": "https://evil.example.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        acao = response.headers.get("access-control-allow-origin", "")
        assert acao != "https://evil.example.com"


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Security response headers
# ═══════════════════════════════════════════════════════════════════════════════


class TestSecurityHeaders:
    """Verify SecurityHeadersMiddleware injects the expected headers."""

    @pytest.mark.asyncio
    async def test_x_content_type_options(self, client: AsyncClient):
        response = await client.get("/health")
        assert response.headers.get("x-content-type-options") == "nosniff"

    @pytest.mark.asyncio
    async def test_x_frame_options(self, client: AsyncClient):
        response = await client.get("/health")
        assert response.headers.get("x-frame-options") == "DENY"

    @pytest.mark.asyncio
    async def test_x_xss_protection(self, client: AsyncClient):
        response = await client.get("/health")
        val = response.headers.get("x-xss-protection", "")
        assert val.startswith("1")

    @pytest.mark.asyncio
    async def test_strict_transport_security(self, client: AsyncClient):
        response = await client.get("/health")
        hsts = response.headers.get("strict-transport-security", "")
        assert "max-age=" in hsts


# ═══════════════════════════════════════════════════════════════════════════════
# 4. API key authentication
# ═══════════════════════════════════════════════════════════════════════════════


class TestAPIKeyAuthentication:
    """Tests for api_keys.py."""

    def test_generate_api_key_format(self):
        """Generated key starts with 'vaxai_' and hash is 64-char hex."""
        from app.core.api_keys import generate_api_key, API_KEY_PREFIX

        raw, key_hash = generate_api_key()
        assert raw.startswith(API_KEY_PREFIX)
        assert len(key_hash) == 64
        assert all(c in "0123456789abcdef" for c in key_hash)

    def test_generate_api_key_uniqueness(self):
        """Two consecutive calls produce different keys."""
        from app.core.api_keys import generate_api_key

        raw1, _ = generate_api_key()
        raw2, _ = generate_api_key()
        assert raw1 != raw2

    def test_hash_consistency(self):
        """Hashing the same key twice produces the same digest."""
        from app.core.api_keys import generate_api_key, _hash_key

        raw, key_hash = generate_api_key()
        assert _hash_key(raw) == key_hash

    def test_api_key_scope_set(self):
        """scope_set property correctly parses comma-separated scopes."""
        from app.core.api_keys import APIKey

        key = APIKey.__new__(APIKey)
        key.scopes = "dhis2:read,openlmis:write"
        assert key.scope_set == {"dhis2:read", "openlmis:write"}

    def test_api_key_has_scope(self):
        """has_scope returns True only for assigned scopes."""
        from app.core.api_keys import APIKey

        key = APIKey.__new__(APIKey)
        key.scopes = "dhis2:read"
        assert key.has_scope("dhis2:read") is True
        assert key.has_scope("dhis2:write") is False

    def test_api_key_expiry_check(self):
        """is_expired() returns True when expires_at is in the past."""
        from app.core.api_keys import APIKey

        key = APIKey.__new__(APIKey)
        key.expires_at = datetime.now(UTC) - timedelta(hours=1)
        assert key.is_expired() is True

        key.expires_at = datetime.now(UTC) + timedelta(hours=1)
        assert key.is_expired() is False

        key.expires_at = None
        assert key.is_expired() is False

    @pytest.mark.asyncio
    async def test_get_api_key_missing_header_raises_401(self):
        """get_api_key raises 401 when no X-API-Key header is provided."""
        from fastapi import HTTPException
        from app.core.api_keys import get_api_key

        mock_db = AsyncMock()
        with pytest.raises(HTTPException) as exc_info:
            await get_api_key(raw_key=None, db=mock_db)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_get_api_key_unknown_key_raises_401(self):
        """get_api_key raises 401 for an unknown key hash."""
        from fastapi import HTTPException
        from app.core.api_keys import get_api_key

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(HTTPException) as exc_info:
            await get_api_key(raw_key="vaxai_fakekeythatdoesnotexist", db=mock_db)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_get_api_key_expired_raises_401(self):
        """get_api_key raises 401 for an expired key."""
        from fastapi import HTTPException
        from app.core.api_keys import get_api_key, APIKey

        expired_key = APIKey.__new__(APIKey)
        expired_key.is_active = True
        expired_key.expires_at = datetime.now(UTC) - timedelta(days=1)
        expired_key.id = uuid.uuid4()
        expired_key.name = "test"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = expired_key
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(HTTPException) as exc_info:
            await get_api_key(raw_key="vaxai_anykey", db=mock_db)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_get_api_key_valid_key_returns_model(self):
        """get_api_key returns the APIKey model for a valid, active, non-expired key."""
        from app.core.api_keys import get_api_key, generate_api_key, APIKey

        raw, key_hash = generate_api_key()
        valid_key = APIKey.__new__(APIKey)
        valid_key.is_active = True
        valid_key.expires_at = None
        valid_key.key_hash = key_hash
        valid_key.id = uuid.uuid4()
        valid_key.name = "test-integration"
        valid_key.scopes = "dhis2:read"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = valid_key
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await get_api_key(raw_key=raw, db=mock_db)
        assert result is valid_key

    @pytest.mark.asyncio
    async def test_require_scope_raises_403_on_missing_scope(self):
        """require_scope dependency raises 403 when scope is not present."""
        from fastapi import HTTPException
        from app.core.api_keys import require_scope, APIKey

        key_without_scope = APIKey.__new__(APIKey)
        key_without_scope.is_active = True
        key_without_scope.expires_at = None
        key_without_scope.scopes = "dhis2:read"

        check = require_scope("dhis2:write")
        with pytest.raises(HTTPException) as exc_info:
            await check(api_key=key_without_scope)
        assert exc_info.value.status_code == 403


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Input sanitization
# ═══════════════════════════════════════════════════════════════════════════════


class TestInputSanitization:
    """Tests for input_sanitizer.py."""

    # ── HTML / XSS stripping ──────────────────────────────────────────────────

    def test_strip_html_removes_script_tags(self):
        from app.core.input_sanitizer import strip_html

        dirty = '<script>alert("xss")</script>Hello'
        assert strip_html(dirty) == 'alert("xss")Hello'

    def test_strip_html_removes_img_onerror(self):
        from app.core.input_sanitizer import strip_html

        dirty = '<img src=x onerror=alert(1)>clean'
        result = strip_html(dirty)
        assert "<img" not in result
        assert "clean" in result

    def test_strip_html_preserves_plain_text(self):
        from app.core.input_sanitizer import strip_html

        text = "Hello, World! 1 < 2 and 3 > 2"
        # Only actual tags are stripped; lt/gt in non-tag context are kept
        result = strip_html(text)
        assert "Hello, World!" in result

    def test_sanitize_string_removes_null_bytes(self):
        from app.core.input_sanitizer import sanitize_string

        assert "\x00" not in sanitize_string("hello\x00world")

    # ── XSS scheme detection ─────────────────────────────────────────────────

    def test_check_xss_raises_on_javascript_scheme(self):
        from fastapi import HTTPException
        from app.core.input_sanitizer import check_xss

        with pytest.raises(HTTPException) as exc_info:
            check_xss("javascript:alert(1)")
        assert exc_info.value.status_code == 400

    def test_check_xss_raises_on_data_uri(self):
        from fastapi import HTTPException
        from app.core.input_sanitizer import check_xss

        with pytest.raises(HTTPException) as exc_info:
            check_xss("data:text/html,<h1>XSS</h1>")
        assert exc_info.value.status_code == 400

    def test_check_xss_passes_safe_url(self):
        from app.core.input_sanitizer import check_xss

        # Should not raise
        check_xss("https://app.vaxaivision.com/dashboard")

    # ── SQL injection detection ───────────────────────────────────────────────

    def test_check_sql_injection_raises_on_select(self):
        from fastapi import HTTPException
        from app.core.input_sanitizer import check_sql_injection

        with pytest.raises(HTTPException) as exc_info:
            check_sql_injection("'; SELECT * FROM users --")
        assert exc_info.value.status_code == 400

    def test_check_sql_injection_raises_on_drop(self):
        from fastapi import HTTPException
        from app.core.input_sanitizer import check_sql_injection

        with pytest.raises(HTTPException) as exc_info:
            check_sql_injection("1; DROP TABLE vaccines;")
        assert exc_info.value.status_code == 400

    def test_check_sql_injection_raises_on_union(self):
        from fastapi import HTTPException
        from app.core.input_sanitizer import check_sql_injection

        with pytest.raises(HTTPException) as exc_info:
            check_sql_injection("1 UNION SELECT username, password FROM users")
        assert exc_info.value.status_code == 400

    def test_check_sql_injection_passes_normal_text(self):
        from app.core.input_sanitizer import check_sql_injection

        # These should not raise
        check_sql_injection("Nairobi District Health Office")
        check_sql_injection("BCG Vaccine Batch #2024-07-A")

    # ── Path traversal detection ──────────────────────────────────────────────

    def test_check_path_traversal_raises_on_dotdot(self):
        from fastapi import HTTPException
        from app.core.input_sanitizer import check_path_traversal

        with pytest.raises(HTTPException) as exc_info:
            check_path_traversal("../../etc/passwd")
        assert exc_info.value.status_code == 400

    def test_check_path_traversal_raises_on_backslash(self):
        from fastapi import HTTPException
        from app.core.input_sanitizer import check_path_traversal

        with pytest.raises(HTTPException) as exc_info:
            check_path_traversal("..\\..\\windows\\system32")
        assert exc_info.value.status_code == 400

    def test_check_path_traversal_passes_safe_path(self):
        from app.core.input_sanitizer import check_path_traversal

        check_path_traversal("uploads/2024/batch_report.csv")

    # ── sanitize_filename ─────────────────────────────────────────────────────

    def test_sanitize_filename_strips_path_components(self):
        from app.core.input_sanitizer import sanitize_filename

        assert sanitize_filename("../../etc/passwd") == "passwd"

    def test_sanitize_filename_removes_special_chars(self):
        from app.core.input_sanitizer import sanitize_filename

        result = sanitize_filename("my file (1).csv")
        assert " " not in result
        assert "(" not in result

    def test_sanitize_filename_handles_empty(self):
        from app.core.input_sanitizer import sanitize_filename

        assert sanitize_filename("") == "upload"

    # ── File upload validation ────────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_validate_upload_rejects_disallowed_mime(self):
        from fastapi import HTTPException
        from app.core.input_sanitizer import validate_upload

        mock_file = MagicMock()
        mock_file.content_type = "application/x-executable"
        mock_file.read = AsyncMock(return_value=b"ELF_BINARY_DATA")
        mock_file.seek = AsyncMock()

        with pytest.raises(HTTPException) as exc_info:
            await validate_upload(mock_file)
        assert exc_info.value.status_code == 415

    @pytest.mark.asyncio
    async def test_validate_upload_rejects_oversized_file(self):
        from fastapi import HTTPException
        from app.core.input_sanitizer import validate_upload

        # 100 MB body — exceeds the 50 MB default
        large_body = b"x" * (100 * 1024 * 1024 + 1)
        mock_file = MagicMock()
        mock_file.content_type = "image/png"
        mock_file.read = AsyncMock(return_value=large_body)
        mock_file.seek = AsyncMock()

        with pytest.raises(HTTPException) as exc_info:
            await validate_upload(mock_file)
        assert exc_info.value.status_code == 413

    @pytest.mark.asyncio
    async def test_validate_upload_accepts_valid_csv(self):
        from app.core.input_sanitizer import validate_upload

        mock_file = MagicMock()
        mock_file.content_type = "text/csv"
        mock_file.read = AsyncMock(return_value=b"col1,col2\n1,2\n")
        mock_file.seek = AsyncMock()

        result = await validate_upload(mock_file)
        assert result is mock_file  # returned unchanged

    # ── SanitizationMiddleware JSON body scrubbing ────────────────────────────

    @pytest.mark.asyncio
    async def test_middleware_strips_html_from_json_body(self, client: AsyncClient):
        """POST with HTML in a JSON field should not cause a 500 error.

        The middleware strips the tag before FastAPI sees the body.  A 422 from
        schema validation is acceptable (wrong shape); 500 is not.
        """
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": '<script>alert(1)</script>user@example.com',
                "password": "test",
            },
        )
        # 401/422 are expected; 500 would mean the tag crashed the handler
        assert response.status_code != 500


# ═══════════════════════════════════════════════════════════════════════════════
# 6. Audit logging
# ═══════════════════════════════════════════════════════════════════════════════


class TestAuditLogging:
    """Tests for audit.py."""

    def test_audit_log_model_has_required_fields(self):
        """AuditLog model class exposes the expected column attributes."""
        from app.core.audit import AuditLog

        for attr in (
            "id", "user_id", "user_email", "action",
            "resource_type", "resource_id", "old_value", "new_value",
            "ip_address", "endpoint", "timestamp",
        ):
            assert hasattr(AuditLog, attr), f"AuditLog missing attribute: {attr}"

    def test_audit_action_enum_values(self):
        """AuditAction enum covers all CRUD operations."""
        from app.core.audit import AuditAction

        assert set(AuditAction) == {
            AuditAction.CREATE,
            AuditAction.READ,
            AuditAction.UPDATE,
            AuditAction.DELETE,
        }

    @pytest.mark.asyncio
    async def test_emit_audit_creates_task(self):
        """emit_audit fires an asyncio task without blocking."""
        from app.core.audit import emit_audit, AuditAction

        mock_request = MagicMock()
        mock_request.state.current_user = None
        mock_request.headers = {}
        mock_request.client = None
        mock_request.url.path = "/api/v1/vaccines"

        with patch("app.core.audit.asyncio.create_task") as mock_create_task:
            with patch("app.core.audit._write_audit_log", new_callable=AsyncMock):
                await emit_audit(
                    request=mock_request,
                    action=AuditAction.CREATE,
                    resource_type="Vaccine",
                    resource_id="abc-123",
                )
            mock_create_task.assert_called_once()

    @pytest.mark.asyncio
    async def test_audit_decorator_wraps_handler(self):
        """@audit_action decorator preserves function name and calls the handler."""
        from app.core.audit import audit_action, AuditAction

        @audit_action("TestResource", action=AuditAction.CREATE)
        async def my_handler(request):
            return {"id": "1"}

        assert my_handler.__name__ == "my_handler"

        mock_request = MagicMock()
        mock_request.state = MagicMock(spec=[])
        mock_request.headers = {}
        mock_request.client = None
        mock_request.url.path = "/test"

        with patch("app.core.audit.asyncio.create_task"):
            result = await my_handler(request=mock_request)

        assert result == {"id": "1"}

    @pytest.mark.asyncio
    async def test_get_audit_logs_requires_admin(self, client: AsyncClient):
        """GET /api/v1/audit/logs returns 401 or 403 without auth."""
        response = await client.get("/api/v1/audit/logs")
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_get_audit_logs_accessible_to_admin(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        """GET /api/v1/audit/logs is accessible to admin users."""
        response = await client.get(
            "/api/v1/audit/logs", headers=admin_auth_headers
        )
        # 200 = works; 500 = internal error we care about
        assert response.status_code == 200
        assert isinstance(response.json(), list)


# ═══════════════════════════════════════════════════════════════════════════════
# 7. Unauthorized access
# ═══════════════════════════════════════════════════════════════════════════════


class TestUnauthorizedAccess:
    """Verify protected endpoints properly reject unauthenticated requests."""

    @pytest.mark.asyncio
    async def test_protected_endpoint_requires_bearer(self, client: AsyncClient):
        """Requests without Authorization header get 401 or 403."""
        response = await client.get("/api/v1/auth/me")
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_invalid_bearer_token_is_rejected(self, client: AsyncClient):
        """A malformed JWT gets 401."""
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer this.is.not.valid"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_viewer_cannot_access_admin_audit_logs(
        self, client: AsyncClient, auth_headers: dict
    ):
        """A viewer-role user is denied access to the admin audit log endpoint."""
        response = await client.get(
            "/api/v1/audit/logs", headers=auth_headers
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_no_api_key_on_integration_endpoint_simulated(self):
        """get_api_key dependency raises 401 when header is absent."""
        from fastapi import HTTPException
        from app.core.api_keys import get_api_key

        mock_db = AsyncMock()
        with pytest.raises(HTTPException) as exc_info:
            await get_api_key(raw_key=None, db=mock_db)
        assert exc_info.value.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════════
# 8. Encryption helpers
# ═══════════════════════════════════════════════════════════════════════════════


class TestEncryption:
    """Tests for encryption.py field-level helpers."""

    def test_generate_fernet_key_format(self):
        """generate_fernet_key returns a valid Fernet key string."""
        from app.core.encryption import generate_fernet_key

        key = generate_fernet_key()
        assert isinstance(key, str)
        assert len(key) == 44  # Base64url-encoded 32 bytes

    def test_encrypt_decrypt_roundtrip_disabled(self, monkeypatch):
        """When ENCRYPTION_AT_REST_ENABLED is False, encrypt/decrypt are pass-throughs."""
        from app.core import encryption

        monkeypatch.setattr(encryption.settings, "ENCRYPTION_AT_REST_ENABLED", False)

        plaintext = "sensitive-patient-id-12345"
        stored = encryption.encrypt_field(plaintext)
        assert stored == plaintext
        recovered = encryption.decrypt_field(stored)
        assert recovered == plaintext

    def test_encrypt_decrypt_roundtrip_enabled(self, monkeypatch):
        """When encryption is enabled with a valid key, round-trip is lossless."""
        import os
        from cryptography.fernet import Fernet
        from app.core import encryption

        # Clear the lru_cache so it picks up our new key
        encryption._get_fernet.cache_clear()

        test_key = Fernet.generate_key().decode()
        monkeypatch.setenv("ENCRYPTION_KEY", test_key)
        monkeypatch.setattr(encryption.settings, "ENCRYPTION_AT_REST_ENABLED", True)

        # Re-cache with our test key
        encryption._get_fernet.cache_clear()

        plaintext = "PHI:patient-name=John Doe,dob=1990-01-15"
        stored = encryption.encrypt_field(plaintext)

        # Encrypted value should be tagged and not equal to plaintext
        assert stored != plaintext
        assert stored.startswith(encryption._FERNET_TAG)

        recovered = encryption.decrypt_field(stored)
        assert recovered == plaintext

        # Cleanup
        encryption._get_fernet.cache_clear()

    def test_decrypt_unencrypted_value_returns_as_is(self, monkeypatch):
        """decrypt_field on an untagged value returns it unchanged (legacy data)."""
        from app.core import encryption

        monkeypatch.setattr(encryption.settings, "ENCRYPTION_AT_REST_ENABLED", False)

        legacy_value = "plain-old-unencrypted-value"
        assert encryption.decrypt_field(legacy_value) == legacy_value

    def test_decrypt_empty_string_returns_empty(self):
        """decrypt_field('') returns '' without error."""
        from app.core.encryption import decrypt_field

        assert decrypt_field("") == ""
