"""
Pytest configuration and shared fixtures for VaxAI Vision backend tests.

Uses the DATABASE_URL and REDIS_URL from the environment (set by CI or docker-compose).
Each test that mutates the DB runs inside a transaction that is rolled back after the test.
"""
import io
import os
import struct
import uuid
import zlib
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

# ── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://vaxai:vaxai_test@localhost:5432/vaxai_test",
)

test_engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
TestSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a DB session that rolls back after each test."""
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """
    Async test client.  No DB override — tests hit the real (test) DB.
    Heavy DB tests should use db_session directly.
    """
    from app.main import app
    from app.database import get_db

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with TestSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c
    app.dependency_overrides.clear()


# ── Auth helpers ──────────────────────────────────────────────────────────────

def _make_png_bytes() -> bytes:
    """Build a minimal valid 1x1 white PNG in pure Python (no Pillow needed)."""

    def _chunk(tag: bytes, data: bytes) -> bytes:
        length = struct.pack(">I", len(data))
        crc = struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        return length + tag + data + crc

    signature = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)  # 1x1 RGB
    ihdr = _chunk(b"IHDR", ihdr_data)
    # Single white pixel: filter byte 0 + RGB(255,255,255)
    raw_row = b"\x00\xff\xff\xff"
    compressed = zlib.compress(raw_row)
    idat = _chunk(b"IDAT", compressed)
    iend = _chunk(b"IEND", b"")
    return signature + ihdr + idat + iend


@pytest.fixture
def sample_image_bytes() -> bytes:
    """Return a minimal valid PNG image as bytes for vision endpoint tests."""
    return _make_png_bytes()


# ── Registered test-user helpers ──────────────────────────────────────────────

_VIEWER_EMAIL = "test_viewer@vaxai.test"
_VIEWER_PASSWORD = "TestViewer1!"

_ADMIN_EMAIL = "test_admin@vaxai.test"
_ADMIN_PASSWORD = "TestAdmin1!"

_ANALYST_EMAIL = "test_analyst@vaxai.test"
_ANALYST_PASSWORD = "TestAnalyst1!"


async def _ensure_user(
    client: AsyncClient,
    email: str,
    password: str,
    full_name: str,
    role: str,
) -> None:
    """Register a user; ignore 409 (already exists)."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": full_name,
            "role": role,
        },
    )
    # 201 = created, 409 = already exists — both are fine
    assert resp.status_code in (201, 409), (
        f"Unexpected status {resp.status_code} registering {email}: {resp.text}"
    )


async def _get_token(client: AsyncClient, email: str, password: str) -> str:
    """Log in and return an access token string."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return resp.json()["access_token"]


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    """Bearer headers for a viewer-role test user."""
    await _ensure_user(
        client, _VIEWER_EMAIL, _VIEWER_PASSWORD, "Test Viewer", "viewer"
    )
    token = await _get_token(client, _VIEWER_EMAIL, _VIEWER_PASSWORD)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def admin_auth_headers(client: AsyncClient) -> dict[str, str]:
    """Bearer headers for an admin-role test user."""
    await _ensure_user(
        client, _ADMIN_EMAIL, _ADMIN_PASSWORD, "Test Admin", "admin"
    )
    token = await _get_token(client, _ADMIN_EMAIL, _ADMIN_PASSWORD)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def analyst_auth_headers(client: AsyncClient) -> dict[str, str]:
    """Bearer headers for an analyst-role test user."""
    await _ensure_user(
        client, _ANALYST_EMAIL, _ANALYST_PASSWORD, "Test Analyst", "analyst"
    )
    token = await _get_token(client, _ANALYST_EMAIL, _ANALYST_PASSWORD)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def demo_auth_headers(client: AsyncClient) -> dict[str, str]:
    """Bearer headers obtained via the demo-login endpoint."""
    resp = await client.post("/api/v1/auth/demo-login")
    if resp.status_code == 503:
        pytest.skip("Demo user not available in this environment")
    assert resp.status_code == 200, f"Demo login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ── Shared domain fixtures ────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def sample_facility(db_session: AsyncSession) -> dict:
    """Insert a ColdChainFacility and return its id/name dict."""
    from app.models.cold_chain import ColdChainFacility

    fid = f"TEST-{uuid.uuid4().hex[:8].upper()}"
    facility = ColdChainFacility(
        id=fid,
        name="Test Health Centre",
        country="KE",
        min_temp_c=2.0,
        max_temp_c=8.0,
    )
    db_session.add(facility)
    await db_session.flush()
    return {"id": fid, "name": "Test Health Centre"}


@pytest_asyncio.fixture
async def sample_inventory_item(db_session: AsyncSession) -> dict:
    """Insert a SupplyItem and return a minimal dict with id/name/category."""
    from app.models.supply import SupplyItem, SupplyCategory

    item = SupplyItem(
        id=uuid.uuid4(),
        name="BCG Vaccine (test)",
        category=SupplyCategory.vaccine,
        unit_of_measure="doses",
    )
    db_session.add(item)
    await db_session.flush()
    return {"id": str(item.id), "name": item.name, "category": item.category.value}
