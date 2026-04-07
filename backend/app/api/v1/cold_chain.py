"""Cold chain temperature monitoring API — VAX-31."""

from datetime import datetime, timedelta
import math
import random

from fastapi import APIRouter

router = APIRouter(prefix="/cold-chain", tags=["cold-chain"])

FACILITIES = [
    {"id": "NG-KAN", "name": "Kano Central Store", "country": "Nigeria"},
    {"id": "NG-LAG", "name": "Lagos Logistics Hub", "country": "Nigeria"},
    {"id": "NG-ABJ", "name": "Abuja NPHCDA Depot", "country": "Nigeria"},
    {"id": "KE-NBI", "name": "Nairobi KEMSA Store", "country": "Kenya"},
    {"id": "KE-MBA", "name": "Mombasa Cold Room", "country": "Kenya"},
    {"id": "KE-KSM", "name": "Kisumu Regional Hub", "country": "Kenya"},
]

SENSORS_PER_FACILITY = 2


def _generate_readings(facility_id: str, sensor_id: str) -> list[dict]:
    """Generate 30 days of hourly mock readings with occasional breaches."""
    random.seed(hash(facility_id + sensor_id))
    now = datetime.utcnow()
    start = now - timedelta(days=30)
    readings = []
    for h in range(30 * 24):
        ts = start + timedelta(hours=h)
        # Normal range 2–8°C with occasional breaches
        base = 5.0 + math.sin(h / 6) * 1.5
        noise = random.gauss(0, 0.3)
        # ~5% breach chance
        spike = random.choice([0] * 19 + [random.uniform(4, 6)]) if random.random() < 0.05 else 0
        temp = round(base + noise + spike, 2)
        if temp < 0:
            status = "breach"
        elif temp > 8:
            status = "breach"
        elif temp < 2 or temp > 7:
            status = "warning"
        else:
            status = "normal"
        readings.append(
            {
                "facility_id": facility_id,
                "sensor_id": sensor_id,
                "timestamp": ts.isoformat() + "Z",
                "temp_celsius": temp,
                "status": status,
            }
        )
    return readings


@router.get("/readings")
async def get_readings(facility_id: str | None = None):
    """Return mock sensor readings for all (or one) facility."""
    all_readings: list[dict] = []
    for fac in FACILITIES:
        if facility_id and fac["id"] != facility_id:
            continue
        for s in range(1, SENSORS_PER_FACILITY + 1):
            sensor_id = f"{fac['id']}-S{s}"
            all_readings.extend(_generate_readings(fac["id"], sensor_id))
    return {"readings": all_readings}


@router.get("/facilities")
async def get_facilities():
    """Return the list of monitored facilities."""
    return {"facilities": FACILITIES}
