"""Inventory stock level endpoints — aggregated current stock per facility/vaccine."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.supply import SupplyItem, SupplyTransaction
from app.models.user import User

router = APIRouter(prefix="/inventory", tags=["inventory"])

# ── Schemas ─────────────────────────────────────────────────────────────────────


class StockLevelItem(BaseModel):
    supply_item_id: str
    name: str
    category: str
    unit_of_measure: str | None
    current_stock: float
    status: str  # "adequate" | "low" | "critical"


class FacilityStockLevel(BaseModel):
    facility_id: str
    facility_name: str
    items: list[StockLevelItem]


class StockSummary(BaseModel):
    total_facilities: int
    total_vaccines: int
    critical_count: int
    low_count: int
    adequate_count: int
    facilities: list[FacilityStockLevel]


# ── Helpers ──────────────────────────────────────────────────────────────────────

_CRITICAL_THRESHOLD = 10.0
_LOW_THRESHOLD = 50.0


def _classify(stock: float) -> str:
    if stock < _CRITICAL_THRESHOLD:
        return "critical"
    if stock < _LOW_THRESHOLD:
        return "low"
    return "adequate"


# ── Endpoints ────────────────────────────────────────────────────────────────────


@router.get(
    "/stock-levels",
    response_model=StockSummary,
    summary="Current vaccine stock levels per facility",
)
async def get_stock_levels(
    category: str | None = Query(default=None, description="Filter by supply category"),
    facility_id: str | None = Query(default=None, description="Filter by facility ID"),
    limit_facilities: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
) -> StockSummary:
    """Return net stock levels (receipts − issues − wastage + adjustments)
    grouped by facility and supply item.  Null/unknown facility rows are
    excluded.
    """
    # Signed quantity expression: receipts/adjustments positive, issues/wastage negative
    signed_qty = case(
        (SupplyTransaction.transaction_type.in_(["issue", "wastage"]), -SupplyTransaction.quantity),
        else_=SupplyTransaction.quantity,
    )

    stmt = (
        select(
            SupplyTransaction.facility_id,
            func.max(SupplyTransaction.facility_name).label("facility_name"),
            SupplyTransaction.supply_item_id,
            func.max(SupplyItem.name).label("item_name"),
            func.max(SupplyItem.category).label("category"),
            func.max(SupplyItem.unit_of_measure).label("unit_of_measure"),
            func.sum(signed_qty).label("current_stock"),
        )
        .join(SupplyItem, SupplyItem.id == SupplyTransaction.supply_item_id)
        .where(SupplyTransaction.facility_id.isnot(None))
    )

    if category:
        stmt = stmt.where(SupplyItem.category == category)
    if facility_id:
        stmt = stmt.where(SupplyTransaction.facility_id == facility_id)

    stmt = stmt.group_by(
        SupplyTransaction.facility_id,
        SupplyTransaction.supply_item_id,
    ).order_by(SupplyTransaction.facility_id)

    result = await db.execute(stmt)
    rows = result.all()

    # Group by facility
    facilities_map: dict[str, FacilityStockLevel] = {}
    critical_count = 0
    low_count = 0
    adequate_count = 0
    all_vaccine_ids: set[str] = set()

    for row in rows:
        fid = row.facility_id
        fname = row.facility_name or fid
        stock = float(row.current_stock or 0.0)
        status = _classify(stock)

        all_vaccine_ids.add(str(row.supply_item_id))

        if status == "critical":
            critical_count += 1
        elif status == "low":
            low_count += 1
        else:
            adequate_count += 1

        if fid not in facilities_map:
            facilities_map[fid] = FacilityStockLevel(
                facility_id=fid,
                facility_name=fname,
                items=[],
            )

        facilities_map[fid].items.append(
            StockLevelItem(
                supply_item_id=str(row.supply_item_id),
                name=row.item_name,
                category=row.category,
                unit_of_measure=row.unit_of_measure,
                current_stock=stock,
                status=status,
            )
        )

    all_facilities = list(facilities_map.values())[:limit_facilities]

    return StockSummary(
        total_facilities=len(facilities_map),
        total_vaccines=len(all_vaccine_ids),
        critical_count=critical_count,
        low_count=low_count,
        adequate_count=adequate_count,
        facilities=all_facilities,
    )
