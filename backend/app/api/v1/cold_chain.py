"""Cold chain temperature monitoring API — VAX-54 (DB-backed)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.cold_chain import (
    ColdChainAlert,
    ColdChainFacility,
    ColdChainReading,
    ReadingStatus,
)

router = APIRouter(prefix="/cold-chain", tags=["cold-chain"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class FacilityOut(BaseModel):
    id: str
    name: str
    country: str
    min_temp_c: float
    max_temp_c: float

    class Config:
        from_attributes = True


class ReadingOut(BaseModel):
    id: str
    facility_id: str
    sensor_id: str
    timestamp: str
    temp_celsius: float
    status: str

    class Config:
        from_attributes = True


class ReadingIn(BaseModel):
    facility_id: str
    sensor_id: str
    timestamp: datetime
    temp_celsius: float


class AlertOut(BaseModel):
    id: str
    facility_id: str
    sensor_id: str
    alert_type: str
    peak_temp_celsius: float
    threshold_celsius: float
    start_time: str
    end_time: str | None
    resolved: bool
    severity: str

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────


def _classify_reading(
    temp: float, min_t: float = 2.0, max_t: float = 8.0
) -> ReadingStatus:
    if temp < min_t or temp > max_t:
        return ReadingStatus.breach
    if temp < (min_t + 0.5) or temp > (max_t - 0.5):
        return ReadingStatus.warning
    return ReadingStatus.normal


def _to_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/facilities", summary="List monitored cold storage facilities")
async def get_facilities(db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(select(ColdChainFacility).order_by(ColdChainFacility.id))
    facilities = result.scalars().all()
    return {
        "facilities": [FacilityOut.model_validate(f).model_dump() for f in facilities]
    }


@router.get(
    "/readings", summary="Get sensor readings with optional facility and time filters"
)
async def get_readings(
    facility_id: str | None = Query(default=None, description="Filter by facility ID"),
    since: datetime | None = Query(
        default=None,
        description="Return readings at or after this UTC timestamp (ISO 8601). Defaults to 7 days ago.",
    ),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if since is None:
        since = datetime.now(timezone.utc) - timedelta(days=7)
    elif since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)

    stmt = (
        select(ColdChainReading)
        .where(ColdChainReading.timestamp >= since)
        .order_by(ColdChainReading.timestamp.desc())
    )
    if facility_id:
        stmt = stmt.where(ColdChainReading.facility_id == facility_id)

    result = await db.execute(stmt)
    readings = result.scalars().all()

    return {
        "readings": [
            {
                "id": str(r.id),
                "facility_id": r.facility_id,
                "sensor_id": r.sensor_id,
                "timestamp": _to_iso(r.timestamp),
                "temp_celsius": r.temp_celsius,
                "status": r.status.value if hasattr(r.status, "value") else r.status,
            }
            for r in readings
        ]
    }


@router.post("/readings", status_code=201, summary="Ingest a new sensor reading")
async def create_reading(
    payload: ReadingIn,
    db: AsyncSession = Depends(get_db),
) -> dict:
    # Validate facility exists
    facility = await db.get(ColdChainFacility, payload.facility_id)
    if facility is None:
        raise HTTPException(
            status_code=404, detail=f"Facility '{payload.facility_id}' not found"
        )

    ts = payload.timestamp
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)

    status = _classify_reading(
        payload.temp_celsius, facility.min_temp_c, facility.max_temp_c
    )

    reading = ColdChainReading(
        id=uuid.uuid4(),
        facility_id=payload.facility_id,
        sensor_id=payload.sensor_id,
        timestamp=ts,
        temp_celsius=payload.temp_celsius,
        status=status,
    )
    db.add(reading)
    await db.flush()

    return {
        "id": str(reading.id),
        "facility_id": reading.facility_id,
        "sensor_id": reading.sensor_id,
        "timestamp": _to_iso(reading.timestamp),
        "temp_celsius": reading.temp_celsius,
        "status": reading.status.value
        if hasattr(reading.status, "value")
        else reading.status,
    }


@router.get("/alerts", summary="Get cold-chain breach alerts with optional filters")
async def get_alerts(
    facility_id: str | None = Query(default=None, description="Filter by facility ID"),
    resolved: bool | None = Query(
        default=None, description="Filter by resolved status"
    ),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(ColdChainAlert).order_by(
        ColdChainAlert.resolved.asc(),
        ColdChainAlert.start_time.desc(),
    )
    if facility_id:
        stmt = stmt.where(ColdChainAlert.facility_id == facility_id)
    if resolved is not None:
        stmt = stmt.where(ColdChainAlert.resolved == resolved)

    result = await db.execute(stmt)
    alerts = result.scalars().all()

    active_count = sum(1 for a in alerts if not a.resolved)

    return {
        "alerts": [
            {
                "id": str(a.id),
                "facility_id": a.facility_id,
                "sensor_id": a.sensor_id,
                "alert_type": a.alert_type.value
                if hasattr(a.alert_type, "value")
                else a.alert_type,
                "peak_temp_celsius": a.peak_temp_celsius,
                "threshold_celsius": a.threshold_celsius,
                "start_time": _to_iso(a.start_time),
                "end_time": _to_iso(a.end_time),
                "resolved": a.resolved,
                "severity": a.severity.value
                if hasattr(a.severity, "value")
                else a.severity,
            }
            for a in alerts
        ],
        "total": len(alerts),
        "active": active_count,
    }
