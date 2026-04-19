"""
End-to-end tests for the inventory (stock-levels) endpoint.

Covers:
  - GET /inventory/stock-levels — requires auth
  - Response shape validation
  - Category and facility_id filters
  - limit_facilities pagination param
  - Stock status classification (critical / low / adequate)
  - Stockout / low-stock detection via seeded DB data
"""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.supply import SupplyCategory, SupplyItem, SupplyTransaction


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _seed_stock(
    db: AsyncSession,
    *,
    facility_id: str,
    facility_name: str,
    item_id: uuid.UUID,
    item_name: str,
    category: SupplyCategory,
    receipt_qty: float,
    issue_qty: float = 0.0,
) -> None:
    """Insert a SupplyItem + two transactions (receipt and optional issue)."""
    db.add(
        SupplyItem(
            id=item_id,
            name=item_name,
            category=category,
            unit_of_measure="doses",
        )
    )
    db.add(
        SupplyTransaction(
            supply_item_id=item_id,
            transaction_type="receipt",
            quantity=receipt_qty,
            facility_id=facility_id,
            facility_name=facility_name,
        )
    )
    if issue_qty:
        db.add(
            SupplyTransaction(
                supply_item_id=item_id,
                transaction_type="issue",
                quantity=issue_qty,
                facility_id=facility_id,
                facility_name=facility_name,
            )
        )
    await db.flush()


# ── No-auth guard ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_stock_levels_requires_auth(client: AsyncClient) -> None:
    """GET /inventory/stock-levels without a token returns 403."""
    resp = await client.get("/api/v1/inventory/stock-levels")
    assert resp.status_code in (401, 403)


# ── Happy-path response shape ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_stock_levels_response_shape(
    client: AsyncClient,
    auth_headers: dict,
) -> None:
    """Authenticated GET returns the expected top-level keys."""
    resp = await client.get(
        "/api/v1/inventory/stock-levels", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    for key in (
        "total_facilities",
        "total_vaccines",
        "critical_count",
        "low_count",
        "adequate_count",
        "facilities",
    ):
        assert key in data, f"Missing key: {key}"
    assert isinstance(data["facilities"], list)


# ── Seeded-data tests ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_adequate_stock_classified_correctly(
    client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
) -> None:
    """A facility with 100 units in stock is classified as 'adequate'."""
    fid = f"FAC-ADE-{uuid.uuid4().hex[:6]}"
    iid = uuid.uuid4()
    await _seed_stock(
        db_session,
        facility_id=fid,
        facility_name="Adequate Facility",
        item_id=iid,
        item_name="OPV (adequate test)",
        category=SupplyCategory.vaccine,
        receipt_qty=100.0,
    )

    resp = await client.get(
        "/api/v1/inventory/stock-levels",
        params={"facility_id": fid},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    # Find our facility
    fac = next((f for f in data["facilities"] if f["facility_id"] == fid), None)
    assert fac is not None, "Seeded facility not found in response"
    assert len(fac["items"]) >= 1
    item = fac["items"][0]
    assert item["status"] == "adequate"
    assert item["current_stock"] == pytest.approx(100.0)


@pytest.mark.asyncio
async def test_low_stock_classified_correctly(
    client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
) -> None:
    """A facility with 20 units (between 10 and 50 threshold) is 'low'."""
    fid = f"FAC-LOW-{uuid.uuid4().hex[:6]}"
    iid = uuid.uuid4()
    await _seed_stock(
        db_session,
        facility_id=fid,
        facility_name="Low Stock Facility",
        item_id=iid,
        item_name="BCG (low test)",
        category=SupplyCategory.vaccine,
        receipt_qty=20.0,
    )

    resp = await client.get(
        "/api/v1/inventory/stock-levels",
        params={"facility_id": fid},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    fac = next((f for f in data["facilities"] if f["facility_id"] == fid), None)
    assert fac is not None
    item = fac["items"][0]
    assert item["status"] == "low"


@pytest.mark.asyncio
async def test_critical_stockout_classified_correctly(
    client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
) -> None:
    """A facility with <10 units net stock is classified as 'critical'."""
    fid = f"FAC-CRI-{uuid.uuid4().hex[:6]}"
    iid = uuid.uuid4()
    await _seed_stock(
        db_session,
        facility_id=fid,
        facility_name="Critical Facility",
        item_id=iid,
        item_name="Measles (critical test)",
        category=SupplyCategory.vaccine,
        receipt_qty=15.0,
        issue_qty=10.0,  # net = 5 → critical
    )

    resp = await client.get(
        "/api/v1/inventory/stock-levels",
        params={"facility_id": fid},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    fac = next((f for f in data["facilities"] if f["facility_id"] == fid), None)
    assert fac is not None
    item = fac["items"][0]
    assert item["status"] == "critical"
    assert item["current_stock"] == pytest.approx(5.0)


@pytest.mark.asyncio
async def test_category_filter(
    client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
) -> None:
    """Filtering by category returns only items of that category."""
    fid = f"FAC-CAT-{uuid.uuid4().hex[:6]}"
    vac_id = uuid.uuid4()
    equip_id = uuid.uuid4()

    await _seed_stock(
        db_session,
        facility_id=fid,
        facility_name="Multi-Category Facility",
        item_id=vac_id,
        item_name="OPV (cat test)",
        category=SupplyCategory.vaccine,
        receipt_qty=50.0,
    )
    await _seed_stock(
        db_session,
        facility_id=fid,
        facility_name="Multi-Category Facility",
        item_id=equip_id,
        item_name="Syringe (cat test)",
        category=SupplyCategory.consumable,
        receipt_qty=200.0,
    )

    resp = await client.get(
        "/api/v1/inventory/stock-levels",
        params={"facility_id": fid, "category": "vaccine"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    fac = next((f for f in data["facilities"] if f["facility_id"] == fid), None)
    assert fac is not None
    # All returned items must be vaccines
    for item in fac["items"]:
        assert item["category"] == "vaccine"


@pytest.mark.asyncio
async def test_limit_facilities_param(
    client: AsyncClient,
    auth_headers: dict,
) -> None:
    """limit_facilities=1 returns at most one facility in the response."""
    resp = await client.get(
        "/api/v1/inventory/stock-levels",
        params={"limit_facilities": 1},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["facilities"]) <= 1


@pytest.mark.asyncio
async def test_limit_facilities_validation(
    client: AsyncClient,
    auth_headers: dict,
) -> None:
    """limit_facilities=0 is rejected with 422."""
    resp = await client.get(
        "/api/v1/inventory/stock-levels",
        params={"limit_facilities": 0},
        headers=auth_headers,
    )
    assert resp.status_code == 422
