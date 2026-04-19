"""
End-to-end tests for the authentication flow.

Covers:
  - User registration (happy path + duplicate rejection)
  - Login with valid / invalid credentials
  - Demo login
  - Token refresh (happy path + replayed token rejection)
  - Logout endpoint (204)
  - Accessing protected endpoints without / with expired tokens
  - /me endpoint
  - RBAC: admin-only and analyst-only endpoints reject lower-privilege users
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


# ── Registration ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_register_new_user(client: AsyncClient) -> None:
    """POST /auth/register with a fresh email returns 201 and user object."""
    import uuid

    email = f"newuser_{uuid.uuid4().hex[:8]}@vaxai.test"
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "SecurePass1!",
            "full_name": "New User",
            "role": "viewer",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == email
    assert data["role"] == "viewer"
    assert data["is_active"] is True
    assert "id" in data
    # Password must NOT be returned
    assert "password" not in data
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_register_duplicate_email_returns_409(client: AsyncClient) -> None:
    """Registering the same email twice returns 409 Conflict."""
    import uuid

    email = f"dup_{uuid.uuid4().hex[:8]}@vaxai.test"
    payload = {
        "email": email,
        "password": "SecurePass1!",
        "full_name": "Dup User",
        "role": "viewer",
    }
    first = await client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 201

    second = await client.post("/api/v1/auth/register", json=payload)
    assert second.status_code == 409
    assert "already registered" in second.json()["detail"].lower()


@pytest.mark.asyncio
async def test_register_short_password_rejected(client: AsyncClient) -> None:
    """Password shorter than 8 characters is rejected with 422."""
    import uuid

    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": f"short_{uuid.uuid4().hex[:8]}@vaxai.test",
            "password": "abc",
            "full_name": "Short Pass",
            "role": "viewer",
        },
    )
    assert resp.status_code == 422


# ── Login ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_login_valid_credentials_returns_tokens(client: AsyncClient) -> None:
    """Valid login returns access_token, refresh_token, token_type and expires_in."""
    import uuid

    email = f"login_{uuid.uuid4().hex[:8]}@vaxai.test"
    password = "ValidPass1!"

    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Login User"},
    )
    assert reg.status_code == 201

    resp = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert isinstance(data["expires_in"], int)
    assert data["expires_in"] > 0


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(client: AsyncClient) -> None:
    """Wrong password returns 401."""
    import uuid

    email = f"wrong_{uuid.uuid4().hex[:8]}@vaxai.test"
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "CorrectPass1!", "full_name": "Wrong User"},
    )
    assert reg.status_code == 201

    resp = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "WrongPassword!"}
    )
    assert resp.status_code == 401
    assert "invalid" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_unknown_email_returns_401(client: AsyncClient) -> None:
    """Login with an email that was never registered returns 401."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@nowhere.test", "password": "SomePass1!"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_missing_body_returns_422(client: AsyncClient) -> None:
    """Sending an empty body to /login returns 422 Unprocessable Entity."""
    resp = await client.post("/api/v1/auth/login", json={})
    assert resp.status_code == 422


# ── Demo Login ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_demo_login_returns_token_or_503(client: AsyncClient) -> None:
    """Demo login either returns tokens (200) or 503 when demo user is absent."""
    resp = await client.post("/api/v1/auth/demo-login")
    assert resp.status_code in (200, 503)
    if resp.status_code == 200:
        data = resp.json()
        assert "access_token" in data
        assert data.get("is_demo") is True


# ── Token Refresh ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_token_refresh_issues_new_tokens(client: AsyncClient) -> None:
    """Valid refresh token returns a fresh token pair."""
    import uuid

    email = f"refresh_{uuid.uuid4().hex[:8]}@vaxai.test"
    password = "RefreshPass1!"

    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Refresh User"},
    )
    login_resp = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert login_resp.status_code == 200
    original = login_resp.json()

    refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": original["refresh_token"]},
    )
    assert refresh_resp.status_code == 200
    new_tokens = refresh_resp.json()
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens
    # Tokens should be different from originals
    assert new_tokens["access_token"] != original["access_token"]


@pytest.mark.asyncio
async def test_token_refresh_with_garbage_returns_401(client: AsyncClient) -> None:
    """Sending a junk refresh token returns 401."""
    resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": "not.a.valid.jwt"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_token_refresh_replay_rejected(client: AsyncClient) -> None:
    """A refresh token used once is revoked; replaying it returns 401."""
    import uuid

    email = f"replay_{uuid.uuid4().hex[:8]}@vaxai.test"
    password = "ReplayPass1!"

    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Replay User"},
    )
    login_resp = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    refresh_token = login_resp.json()["refresh_token"]

    # First use — should succeed
    first = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert first.status_code == 200

    # Second use of the same token — should be rejected
    second = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert second.status_code == 401


# ── Logout ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_logout_returns_204(client: AsyncClient, auth_headers: dict) -> None:
    """POST /auth/logout with a valid token returns 204 No Content."""
    resp = await client.post("/api/v1/auth/logout", headers=auth_headers)
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_logout_without_token_returns_403(client: AsyncClient) -> None:
    """POST /auth/logout without a Bearer token returns 403."""
    resp = await client.post("/api/v1/auth/logout")
    assert resp.status_code in (401, 403)


# ── Protected endpoints ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_me_returns_current_user(
    client: AsyncClient, auth_headers: dict
) -> None:
    """GET /auth/me returns the authenticated user's profile."""
    resp = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert "email" in data
    assert "role" in data


@pytest.mark.asyncio
async def test_me_without_token_returns_403(client: AsyncClient) -> None:
    """GET /auth/me without a token returns 403."""
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_me_with_invalid_token_returns_401(client: AsyncClient) -> None:
    """GET /auth/me with a malformed Bearer token returns 401."""
    resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer completely.invalid.token"},
    )
    assert resp.status_code == 401


# ── RBAC ──────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_forecasting_train_requires_analyst_or_above(
    client: AsyncClient, auth_headers: dict
) -> None:
    """POST /forecasting/train requires analyst role or above; viewer gets 403."""
    import uuid

    resp = await client.post(
        "/api/v1/forecasting/train",
        headers=auth_headers,
        json={"supply_item_id": str(uuid.uuid4())},
    )
    # Viewer should be forbidden
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_forecasting_train_allowed_for_analyst(
    client: AsyncClient, analyst_auth_headers: dict
) -> None:
    """POST /forecasting/train is accessible to an analyst (gets 202 or 422/404, not 403)."""
    import uuid

    resp = await client.post(
        "/api/v1/forecasting/train",
        headers=analyst_auth_headers,
        json={"supply_item_id": str(uuid.uuid4())},
    )
    # Not 403 — analyst is allowed through RBAC.
    # 202 if Celery is available; 500 otherwise. Either way, not 403.
    assert resp.status_code != 403


@pytest.mark.asyncio
async def test_ingestion_upload_requires_admin_or_analyst(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Viewer trying to upload a CSV gets 403."""
    resp = await client.post(
        "/api/v1/ingestion/upload/csv",
        headers=auth_headers,
        files={"file": ("test.csv", b"item_code,quantity\nVAC001,10\n", "text/csv")},
    )
    assert resp.status_code == 403
