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


@router.get("/alerts")
async def get_alerts(facility_id: str | None = None):
    """Return active and recent cold-chain breach alerts for all (or one) facility."""
    random.seed(42)
    now = datetime.utcnow()
    alerts = []
    alert_id = 1

    for fac in FACILITIES:
        if facility_id and fac["id"] != facility_id:
            continue
        for s in range(1, SENSORS_PER_FACILITY + 1):
            sensor_id = f"{fac['id']}-S{s}"
            # Seed per sensor for reproducibility
            random.seed(hash(sensor_id) % (2**32))
            # Randomly assign 0-2 alerts per sensor
            num_alerts = random.choices([0, 1, 2], weights=[6, 3, 1])[0]
            for _ in range(num_alerts):
                hours_ago_start = random.uniform(0.5, 48)
                duration_hours = random.uniform(0.5, 4)
                start_dt = now - timedelta(hours=hours_ago_start)
                end_dt = start_dt + timedelta(hours=duration_hours)
                resolved = end_dt < now
                alert_type = random.choice(["high", "low"])
                if alert_type == "high":
                    peak = round(random.uniform(8.5, 12.0), 1)
                    threshold = 8.0
                else:
                    peak = round(random.uniform(-2.0, 1.5), 1)
                    threshold = 2.0
                alerts.append(
                    {
                        "id": f"alert-{alert_id}",
                        "facility_id": fac["id"],
                        "facility_name": fac["name"],
                        "country": fac["country"],
                        "sensor_id": sensor_id,
                        "alert_type": alert_type,
                        "peak_temp_celsius": peak,
                        "threshold_celsius": threshold,
                        "start_time": start_dt.isoformat() + "Z",
                        "end_time": end_dt.isoformat() + "Z" if resolved else None,
                        "resolved": resolved,
                        "severity": "critical" if abs(peak - threshold) > 3 else "warning",
                    }
                )
                alert_id += 1

    # Sort: active first, then most recent
    alerts.sort(key=lambda a: (a["resolved"], a["start_time"]), reverse=False)
    return {"alerts": alerts, "total": len(alerts), "active": sum(1 for a in alerts if not a["resolved"])}
