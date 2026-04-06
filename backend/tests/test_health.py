"""
Smoke tests — liveness probe and docs endpoint.
These tests do NOT require a database connection.
"""
import pytest
from httpx import AsyncClient, ASGITransport


@pytest.mark.asyncio
async def test_health_liveness() -> None:
    """GET /health must return 200 with status=ok (no DB/Redis needed)."""
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "ok"
    assert "version" in data


@pytest.mark.asyncio
async def test_openapi_docs() -> None:
    """OpenAPI schema endpoint must be reachable."""
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert schema.get("openapi", "").startswith("3.")
    assert "paths" in schema
