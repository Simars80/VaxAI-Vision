"""Impact-report endpoints — aggregated vaccination metrics."""

from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.coverage import CoverageFacility
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class CoverageByCountry(BaseModel):
    country: str
    facilityCount: int
    avgCoverageRate: float
    totalDosesAdministered: int


class StockSummary(BaseModel):
    status: str
    facilityCount: int


class ColdChainSummary(BaseModel):
    totalReadings: int
    breachCount: int
    complianceRate: float
    totalAlerts: int
    resolvedAlerts: int


class WastageSummary(BaseModel):
    totalWastageQty: int
    totalIssuedQty: int
    wastageRate: float


class FacilityPerformance(BaseModel):
    id: str
    name: str
    region: str
    country: str
    vaccineType: str
    dosesAdministered: int
    targetPopulation: int
    coverageRate: float
    stockStatus: str
    current: int


class ImpactReportData(BaseModel):
    generatedAt: str
    dateFrom: str | None = None
    dateTo: str | None = None
    coverageByCountry: list[CoverageByCountry]
    stockSummary: list[StockSummary]
    coldChain: ColdChainSummary
    wastage: WastageSummary
    facilityPerformance: list[FacilityPerformance]


# ── Helpers ───────────────────────────────────────────────────────────────────


def _apply_filters(stmt, date_from: str | None, date_to: str | None, country: str | None):
    """Apply optional date / country filters to a CoverageFacility query."""
    if country:
        stmt = stmt.where(CoverageFacility.country == country)
    # date filters are applied only when the model exposes a period column
    return stmt


async def _build_report(
    db: AsyncSession,
    date_from: str | None = None,
    date_to: str | None = None,
    country: str | None = None,
) -> ImpactReportData:
    """Aggregate DB rows into the report payload."""

    base = select(CoverageFacility)
    base = _apply_filters(base, date_from, date_to, country)

    result = await db.execute(base.order_by(CoverageFacility.country, CoverageFacility.name))
    rows = result.scalars().all()

    # -- coverage by country --------------------------------------------------
    country_map: dict[str, dict] = {}
    for r in rows:
        entry = country_map.setdefault(r.country, {"count": 0, "cov_sum": 0.0, "doses": 0})
        entry["count"] += 1
        entry["cov_sum"] += r.coverage_rate
        entry["doses"] += r.doses_administered

    coverage_by_country = [
        CoverageByCountry(
            country=c,
            facilityCount=v["count"],
            avgCoverageRate=round(v["cov_sum"] / v["count"], 1) if v["count"] else 0,
            totalDosesAdministered=v["doses"],
        )
        for c, v in country_map.items()
    ]

    # -- stock summary --------------------------------------------------------
    status_map: dict[str, int] = {}
    for r in rows:
        status_map[r.stock_status] = status_map.get(r.stock_status, 0) + 1
    stock_summary = [StockSummary(status=s, facilityCount=n) for s, n in status_map.items()]

    # -- cold-chain (placeholder until cold_chain model is wired) -------------
    cold_chain = ColdChainSummary(
        totalReadings=0,
        breachCount=0,
        complianceRate=100.0,
        totalAlerts=0,
        resolvedAlerts=0,
    )

    # -- wastage (placeholder) ------------------------------------------------
    wastage = WastageSummary(totalWastageQty=0, totalIssuedQty=0, wastageRate=0.0)

    # -- facility performance -------------------------------------------------
    facility_perf = [
        FacilityPerformance(
            id=str(r.id),
            name=r.name,
            region=r.region,
            country=r.country,
            vaccineType=r.vaccine_type,
            dosesAdministered=r.doses_administered,
            targetPopulation=r.target_population,
            coverageRate=r.coverage_rate,
            stockStatus=r.stock_status,
            current=0,
        )
        for r in rows
    ]

    return ImpactReportData(
        generatedAt=datetime.now(timezone.utc).isoformat(),
        dateFrom=date_from,
        dateTo=date_to,
        coverageByCountry=coverage_by_country,
        stockSummary=stock_summary,
        coldChain=cold_chain,
        wastage=wastage,
        facilityPerformance=facility_perf,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/impact", response_model=ImpactReportData, summary="Aggregated impact report")
async def get_impact_report(
    dateFrom: str | None = Query(default=None),
    dateTo: str | None = Query(default=None),
    country: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
) -> ImpactReportData:
    """Return aggregated vaccination impact data across all facilities."""
    return await _build_report(db, date_from=dateFrom, date_to=dateTo, country=country)


@router.get("/impact/csv", summary="Impact report as CSV download")
async def get_impact_report_csv(
    dateFrom: str | None = Query(default=None),
    dateTo: str | None = Query(default=None),
    country: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """Stream the facility-performance section of the impact report as CSV."""
    report = await _build_report(db, date_from=dateFrom, date_to=dateTo, country=country)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "name", "region", "country", "vaccineType",
                     "dosesAdministered", "targetPopulation", "coverageRate",
                     "stockStatus", "current"])
    for f in report.facilityPerformance:
        writer.writerow([f.id, f.name, f.region, f.country, f.vaccineType,
                         f.dosesAdministered, f.targetPopulation, f.coverageRate,
                         f.stockStatus, f.current])
    buf.seek(0)

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=impact_report.csv"},
    )
