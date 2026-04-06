"""
Smoke tests — verify the API starts and health endpoint responds.
These are intentionally minimal; feature-specific tests live in sub-modules.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient) -> None:
    """GET /health should return 200 with status ok."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "ok"


@pytest.mark.asyncio
async def test_docs_available(client: AsyncClient) -> None:
    """OpenAPI docs should be reachable in non-production environments."""
    response = await client.get("/docs")
    assert response.status_code == 200
