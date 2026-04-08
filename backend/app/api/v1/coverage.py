"""Coverage map endpoints — facility-level immunization coverage from DB."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.coverage import CoverageFacility
from app.models.user import User

router = APIRouter(prefix="/coverage", tags=["coverage"])

# ── Schemas ──────────────────────────────────────────────────────────────────


class FacilityItem(BaseModel):
    id: str
    name: str
    country: str
    region: str
    lat: float
    lng: float
    coverage_rate: float
    stock_status: str  # adequate | low | critical
    vaccine_type: str
    period: str
    doses_administered: int
    target_population: int

    model_config = {"from_attributes": True}


class FacilitiesResponse(BaseModel):
    total: int
    facilities: list[FacilityItem]


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get(
    "/facilities",
    response_model=FacilitiesResponse,
    summary="Facility-level immunization coverage rates and vaccine stock status",
)
async def get_coverage_facilities(
    country: str | None = Query(default=None, description="Filter by country name"),
    vaccine_type: str | None = Query(default=None, description="Filter by vaccine type"),
    stock_status: str | None = Query(
        default=None,
        description="Filter by stock status (adequate | low | critical)",
    ),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
) -> FacilitiesResponse:
    """Return all coverage facilities with geo-data and current coverage metrics.

    Supports optional filtering by country, vaccine_type, and stock_status.
    """
    stmt = select(CoverageFacility).order_by(CoverageFacility.country, CoverageFacility.name)

    if country:
        stmt = stmt.where(CoverageFacility.country == country)
    if vaccine_type:
        stmt = stmt.where(CoverageFacility.vaccine_type == vaccine_type)
    if stock_status:
        stmt = stmt.where(CoverageFacility.stock_status == stock_status)

    result = await db.execute(stmt)
    rows = result.scalars().all()

    facilities = [FacilityItem.model_validate(row) for row in rows]

    return FacilitiesResponse(total=len(facilities), facilities=facilities)
