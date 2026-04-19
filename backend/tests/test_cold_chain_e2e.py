"""
End-to-end tests for cold chain monitoring endpoints.

Covers:
  - GET /cold-chain/facilities — list monitored facilities
  - POST /cold-chain/readings — ingest a sensor reading
  - GET /cold-chain/readings — list readings with facility/time filters
  - GET /cold-chain/alerts — list breach alerts with filters
  - Temperature classification: normal / warning / breach
  - Alert thresholds respected
  - 404 when facility does not exist
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cold_chain import (
    AlertSeverity,
    AlertType,
    ColdChainAlert,
    ColdChainFacility,
    ReadingStatus,
)


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _create_facility(
    db: AsyncSession,
    *,
    fid: str | None = None,
    name: str = "Test Facility",
    country: str = "KE",
    min_temp_c: float = 2.0,
    max_temp_c: float = 8.0,
) -> str:
    fid = fid or f"CC-{uuid.uuid4().hex[:8].upper()}"
    db.add(
        ColdChainFacility(
            id=fid,
            name=name,
            country=country,
            min_temp_c=min_temp_c,
            max_temp_c=max_temp_c,
        )
    )
    await db.flush()
    return fid


async def _create_alert(
    db: AsyncSession,
    *,
    facility_id: str,
    sensor_id: str = "S-001",
    alert_type: AlertType = AlertType.high,
    peak_temp: float = 12.0,
    threshold: float = 8.0,
    resolved: bool = False,
    severity: AlertSeverity = AlertSeverity.warning,
) -> str:
    alert = ColdChainAlert(
        id=uuid.uuid4(),
        facility_id=facility_id,
        sensor_id=sensor_id,
        alert_type=alert_type,
        peak_temp_celsius=peak_temp,
        threshold_celsius=threshold,
        start_time=datetime.now(timezone.utc) - timedelta(hours=1),
        end_time=datetime.now(timezone.utc) if resolved else None,
        resolved=resolved,
        severity=severity,
    )
    db.add(alert)
    await db.flush()
    return str(alert.id)


# ── Facilities ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_facilities_returns_list(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """GET /cold-chain/facilities returns a dict with a 'facilities' list."""
    await _create_facility(db_session, name="List Test Facility")
    resp = await client.get("/api/v1/cold-chain/facilities")
    assert resp.status_code == 200
    data = resp.json()
    assert "facilities" in data
    assert isinstance(data["facilities"], list)


@pytest.mark.asyncio
async def test_list_facilities_contains_seeded_facility(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """A newly inserted facility appears in the listing."""
    fid = await _create_facility(db_session, name="Visible Facility", country="UG")
    resp = await client.get("/api/v1/cold-chain/facilities")
    assert resp.status_code == 200
    ids = [f["id"] for f in resp.json()["facilities"]]
    assert fid in ids


# ── Create Reading ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_reading_normal_temp(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """POST a reading within the normal range returns 201 with status=normal."""
    fid = await _create_facility(db_session, min_temp_c=2.0, max_temp_c=8.0)
    resp = await client.post(
        "/api/v1/cold-chain/readings",
        json={
            "facility_id": fid,
            "sensor_id": "SENSOR-001",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "temp_celsius": 5.0,  # within 2–8, not near bounds
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["facility_id"] == fid
    assert data["sensor_id"] == "SENSOR-001"
    assert data["temp_celsius"] == pytest.approx(5.0)
    assert data["status"] == "normal"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_reading_warning_temp(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """A reading close to the boundary (but not outside) returns status=warning."""
    fid = await _create_facility(db_session, min_temp_c=2.0, max_temp_c=8.0)
    # Within range but within 0.5°C of max boundary → warning
    resp = await client.post(
        "/api/v1/cold-chain/readings",
        json={
            "facility_id": fid,
            "sensor_id": "SENSOR-WARN",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "temp_celsius": 7.6,
        },
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "warning"


@pytest.mark.asyncio
async def test_create_reading_breach_temp(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """A reading outside the facility's range returns status=breach."""
    fid = await _create_facility(db_session, min_temp_c=2.0, max_temp_c=8.0)
    resp = await client.post(
        "/api/v1/cold-chain/readings",
        json={
            "facility_id": fid,
            "sensor_id": "SENSOR-BREACH",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "temp_celsius": 15.0,  # above 8°C → breach
        },
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "breach"


@pytest.mark.asyncio
async def test_create_reading_below_range_breach(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """A reading below the minimum threshold is also a breach."""
    fid = await _create_facility(db_session, min_temp_c=2.0, max_temp_c=8.0)
    resp = await client.post(
        "/api/v1/cold-chain/readings",
        json={
            "facility_id": fid,
            "sensor_id": "SENSOR-COLD",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "temp_celsius": -1.0,  # below 2°C → breach
        },
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "breach"


@pytest.mark.asyncio
async def test_create_reading_unknown_facility_returns_404(
    client: AsyncClient,
) -> None:
    """Posting a reading for a non-existent facility returns 404."""
    resp = await client.post(
        "/api/v1/cold-chain/readings",
        json={
            "facility_id": "DOES-NOT-EXIST",
            "sensor_id": "S-X",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "temp_celsius": 5.0,
        },
    )
    assert resp.status_code == 404


# ── Get Readings ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_readings_returns_list(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """GET /cold-chain/readings returns a 'readings' list."""
    fid = await _create_facility(db_session)
    # Seed one reading
    await client.post(
        "/api/v1/cold-chain/readings",
        json={
            "facility_id": fid,
            "sensor_id": "S-GET",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "temp_celsius": 5.0,
        },
    )
    resp = await client.get("/api/v1/cold-chain/readings")
    assert resp.status_code == 200
    data = resp.json()
    assert "readings" in data
    assert isinstance(data["readings"], list)


@pytest.mark.asyncio
async def test_get_readings_facility_filter(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """facility_id query param filters readings to that facility only."""
    fid_a = await _create_facility(db_session, name="FacA")
    fid_b = await _create_facility(db_session, name="FacB")

    for fid in (fid_a, fid_b):
        await client.post(
            "/api/v1/cold-chain/readings",
            json={
                "facility_id": fid,
                "sensor_id": "S-FILTER",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "temp_celsius": 5.0,
            },
        )

    resp = await client.get(
        "/api/v1/cold-chain/readings", params={"facility_id": fid_a}
    )
    assert resp.status_code == 200
    readings = resp.json()["readings"]
    assert all(r["facility_id"] == fid_a for r in readings)


# ── Alerts ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_alerts_returns_structure(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """GET /cold-chain/alerts returns alerts list, total and active count."""
    fid = await _create_facility(db_session)
    await _create_alert(db_session, facility_id=fid, resolved=False)

    resp = await client.get("/api/v1/cold-chain/alerts")
    assert resp.status_code == 200
    data = resp.json()
    assert "alerts" in data
    assert "total" in data
    assert "active" in data
    assert isinstance(data["alerts"], list)


@pytest.mark.asyncio
async def test_get_alerts_facility_filter(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Alerts filtered by facility_id return only alerts for that facility."""
    fid_a = await _create_facility(db_session, name="AlertFacA")
    fid_b = await _create_facility(db_session, name="AlertFacB")
    await _create_alert(db_session, facility_id=fid_a)
    await _create_alert(db_session, facility_id=fid_b)

    resp = await client.get(
        "/api/v1/cold-chain/alerts", params={"facility_id": fid_a}
    )
    assert resp.status_code == 200
    alerts = resp.json()["alerts"]
    assert all(a["facility_id"] == fid_a for a in alerts)


@pytest.mark.asyncio
async def test_get_alerts_resolved_filter(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """resolved=false filter returns only unresolved alerts."""
    fid = await _create_facility(db_session, name="ResolvedFac")
    await _create_alert(db_session, facility_id=fid, resolved=False)
    await _create_alert(db_session, facility_id=fid, resolved=True)

    resp = await client.get(
        "/api/v1/cold-chain/alerts",
        params={"facility_id": fid, "resolved": "false"},
    )
    assert resp.status_code == 200
    alerts = resp.json()["alerts"]
    assert all(not a["resolved"] for a in alerts)


@pytest.mark.asyncio
async def test_alert_shape(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Each alert in the response has the required fields."""
    fid = await _create_facility(db_session, name="ShapeFac")
    await _create_alert(
        db_session,
        facility_id=fid,
        alert_type=AlertType.high,
        peak_temp=12.0,
        threshold=8.0,
        severity=AlertSeverity.critical,
    )

    resp = await client.get(
        "/api/v1/cold-chain/alerts", params={"facility_id": fid}
    )
    assert resp.status_code == 200
    alerts = resp.json()["alerts"]
    assert len(alerts) >= 1
    alert = alerts[0]
    for key in (
        "id",
        "facility_id",
        "sensor_id",
        "alert_type",
        "peak_temp_celsius",
        "threshold_celsius",
        "start_time",
        "resolved",
        "severity",
    ):
        assert key in alert, f"Missing key: {key}"
    assert alert["facility_id"] == fid
    assert alert["alert_type"] == "high"
    assert alert["severity"] == "critical"
