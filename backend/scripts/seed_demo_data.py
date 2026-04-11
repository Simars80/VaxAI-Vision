#!/usr/bin/env python3
"""
seed_demo_data.py
=================
Standalone script to seed realistic demo vaccine supply transactions for
Nigerian and Kenyan health facilities.

Covers 6 facilities (3 Nigeria, 3 Kenya) with 13 months of transactions
(April 2025 – April 2026) for bOPV, PENTA, PCV13, and ROTA vaccines.

Usage:
    # From the backend/ directory with venv active:
    python scripts/seed_demo_data.py

    # With a custom DB URL:
    DATABASE_URL=postgresql+asyncpg://user:pass@host/db python scripts/seed_demo_data.py

    # Dry-run (prints counts, does not commit):
    python scripts/seed_demo_data.py --dry-run

    # Force re-seed (deletes existing demo rows first):
    python scripts/seed_demo_data.py --force
"""

import argparse
import asyncio
import logging
import math
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from dateutil.relativedelta import relativedelta  # type: ignore[import]

# ---------------------------------------------------------------------------
# Make sure the app package is importable when run from backend/
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("seed_demo")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEMO_SOURCE = "demo_seed"

VACCINES = [
    {"external_code": "bOPV",  "name": "Oral Polio Vaccine bivalent (bOPV)",
     "description": "Bivalent oral polio vaccine (type 1 and 3). EPI routine: 0, 6, 10, 14 weeks.",
     "min_temp": -25.0, "max_temp": -15.0},
    {"external_code": "PENTA", "name": "Pentavalent DTP-HepB-Hib (PENTA)",
     "description": "Combined DTP, hepatitis B, and Hib vaccine. 10 doses/vial.",
     "min_temp": 2.0, "max_temp": 8.0},
    {"external_code": "PCV13", "name": "Pneumococcal Conjugate Vaccine 13-valent (PCV13)",
     "description": "Protects against 13 strains of Streptococcus pneumoniae. 4 doses/vial.",
     "min_temp": 2.0, "max_temp": 8.0},
    {"external_code": "RV1",   "name": "Rotavirus Vaccine Monovalent (RV1 / ROTA)",
     "description": "Live attenuated human rotavirus vaccine. Single-dose vial.",
     "min_temp": 2.0, "max_temp": 8.0},
]

# Facility definitions: (external_id, name, country)
FACILITIES = [
    ("NG-FAC-LAG-001", "Lagos State PHCDA Store",         "NG"),
    ("NG-FAC-LAG-002", "Mainland General Hospital PHC",    "NG"),
    ("NG-FAC-KAN-001", "Kano State PHC Mgmt Board Store",  "NG"),
    ("KE-FAC-NBI-001", "Nairobi CC Health Services Store", "KE"),
    ("KE-FAC-MSA-001", "Mombasa County Referral Hospital", "KE"),
    ("KE-FAC-KSM-001", "Kisumu County Teaching & Referral","KE"),
]

# Monthly base receipt volumes (doses): facility_external_id → vaccine_code → qty
BASE_VOLUMES: dict[str, dict[str, int]] = {
    "NG-FAC-LAG-001": {"bOPV": 82000, "PENTA": 48000, "PCV13": 26000, "RV1": 32000},
    "NG-FAC-LAG-002": {"bOPV": 14000, "PENTA":  8500, "PCV13":  4800, "RV1":  5500},
    "NG-FAC-KAN-001": {"bOPV": 38000, "PENTA": 22000, "PCV13": 13000, "RV1": 16000},
    "KE-FAC-NBI-001": {"bOPV": 65000, "PENTA": 38000, "PCV13": 21000, "RV1": 27000},
    "KE-FAC-MSA-001": {"bOPV": 19000, "PENTA": 11500, "PCV13":  6500, "RV1":  8000},
    "KE-FAC-KSM-001": {"bOPV":  9000, "PENTA":  5500, "PCV13":  3200, "RV1":  4200},
}

# Seasonal multiplier by month number
SEASONAL: dict[int, float] = {
    4: 1.15, 5: 1.18, 6: 1.12,
    7: 1.06, 8: 1.08, 9: 1.05,
    10: 0.97, 11: 0.95, 12: 0.93,
    1: 1.00, 2: 1.02, 3: 1.04,
}


def _seasonal(month: int) -> float:
    return SEASONAL.get(month, 1.0)


def _pseudo_variance(month: int, dow: int) -> float:
    """Deterministic ±8% variance so monthly figures aren't perfectly flat."""
    return 1.0 + 0.08 * math.sin(month + dow)


def _receipt_qty(base: int, month: int, day_of_week: int) -> int:
    return max(10, round(base * _seasonal(month) * _pseudo_variance(month, day_of_week)))


def _issue_qty(receipt: int, seasonal_mult: float) -> int:
    ratio = 0.94 + 0.03 * seasonal_mult / 1.18
    return max(10, round(receipt * ratio))


def _wastage_qty(receipt: int, seasonal_mult: float) -> int:
    return max(10, round(receipt * 0.035 * (1 + 0.5 * max(0.0, seasonal_mult - 1.0))))


def _expiry(month_start: datetime) -> datetime:
    return month_start + relativedelta(months=18)


def _lot(prefix: str, month_start: datetime, suffix: str = "A") -> str:
    return f"{prefix}-{month_start.strftime('%y%m')}-{suffix}"


LOT_PREFIXES: dict[tuple[str, str], str] = {
    ("NG-FAC-LAG-001", "bOPV"): "LG-bOPV",
    ("NG-FAC-LAG-001", "PENTA"): "LG-PEN",
    ("NG-FAC-LAG-001", "PCV13"): "LG-PCV",
    ("NG-FAC-LAG-001", "RV1"):  "LG-RV1",
    ("NG-FAC-LAG-002", "bOPV"): "MG-bOPV",
    ("NG-FAC-LAG-002", "PENTA"): "MG-PEN",
    ("NG-FAC-LAG-002", "PCV13"): "MG-PCV",
    ("NG-FAC-LAG-002", "RV1"):  "MG-RV1",
    ("NG-FAC-KAN-001", "bOPV"): "KN-bOPV",
    ("NG-FAC-KAN-001", "PENTA"): "KN-PEN",
    ("NG-FAC-KAN-001", "PCV13"): "KN-PCV",
    ("NG-FAC-KAN-001", "RV1"):  "KN-RV1",
    ("KE-FAC-NBI-001", "bOPV"): "NB-bOPV",
    ("KE-FAC-NBI-001", "PENTA"): "NB-PEN",
    ("KE-FAC-NBI-001", "PCV13"): "NB-PCV",
    ("KE-FAC-NBI-001", "RV1"):  "NB-RV1",
    ("KE-FAC-MSA-001", "bOPV"): "MB-bOPV",
    ("KE-FAC-MSA-001", "PENTA"): "MB-PEN",
    ("KE-FAC-MSA-001", "PCV13"): "MB-PCV",
    ("KE-FAC-MSA-001", "RV1"):  "MB-RV1",
    ("KE-FAC-KSM-001", "bOPV"): "KS-bOPV",
    ("KE-FAC-KSM-001", "PENTA"): "KS-PEN",
    ("KE-FAC-KSM-001", "PCV13"): "KS-PCV",
    ("KE-FAC-KSM-001", "RV1"):  "KS-RV1",
}


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

async def _get_or_create_supply_items(session: AsyncSession) -> dict[str, uuid.UUID]:
    """Return {external_code: supply_item_id}. Inserts if missing."""
    id_map: dict[str, uuid.UUID] = {}
    for vax in VACCINES:
        code = vax["external_code"]
        row = await session.execute(
            text("SELECT id FROM supply_items WHERE external_code = :code"),
            {"code": code},
        )
        existing = row.fetchone()
        if existing:
            id_map[code] = existing[0]
        else:
            new_id = uuid.uuid4()
            await session.execute(
                text("""
                    INSERT INTO supply_items
                        (id, external_code, name, description, category,
                         unit_of_measure, min_temp_celsius, max_temp_celsius)
                    VALUES
                        (:id, :code, :name, :desc, 'vaccine',
                         'dose', :min_t, :max_t)
                    ON CONFLICT DO NOTHING
                """),
                {
                    "id": new_id,
                    "code": code,
                    "name": vax["name"],
                    "desc": vax["description"],
                    "min_t": vax["min_temp"],
                    "max_t": vax["max_temp"],
                },
            )
            id_map[code] = new_id
            log.info("Created supply_item  %s  (%s)", new_id, code)
    return id_map


async def _purge_demo_transactions(session: AsyncSession) -> int:
    result = await session.execute(
        text("""
            DELETE FROM supply_transactions
            WHERE extra->>'source' = :src
        """),
        {"src": DEMO_SOURCE},
    )
    return result.rowcount  # type: ignore[return-value]


async def _build_transactions(
    item_ids: dict[str, uuid.UUID],
) -> list[dict]:
    """Generate all transaction dicts without hitting the DB."""
    rows: list[dict] = []

    start = datetime(2025, 4, 1, tzinfo=timezone.utc)

    for month_offset in range(13):  # Apr 2025 – Apr 2026
        month_start = start + relativedelta(months=month_offset)
        issue_date = month_start.replace(day=15, hour=9)
        # Last day of month
        next_month = month_start + relativedelta(months=1)
        last_day = next_month - timedelta(days=1)
        last_day = last_day.replace(hour=16)

        month_num = month_start.month
        sm = _seasonal(month_num)
        dow = month_start.weekday()

        for fac_ext_id, fac_name, country in FACILITIES:
            base_map = BASE_VOLUMES[fac_ext_id]

            for vax_code, base_qty in base_map.items():
                item_id = item_ids[vax_code]
                lot_pfx = LOT_PREFIXES[(fac_ext_id, vax_code)]
                lot = _lot(lot_pfx, month_start)
                expiry = _expiry(month_start)
                receipt = _receipt_qty(base_qty, month_num, dow)
                issue = _issue_qty(receipt, sm)
                extra_base = {
                    "source": DEMO_SOURCE,
                    "country": country,
                    "campaign_month": month_start.strftime("%Y-%m"),
                }

                # Receipt
                rows.append({
                    "id": uuid.uuid4(),
                    "supply_item_id": item_id,
                    "transaction_type": "receipt",
                    "quantity": float(receipt),
                    "unit_of_measure": "dose",
                    "facility_id": fac_ext_id,
                    "facility_name": fac_name,
                    "transaction_date": month_start.replace(hour=8),
                    "lot_number": lot,
                    "expiry_date": expiry,
                    "extra": {**extra_base},
                })

                # Issue
                rows.append({
                    "id": uuid.uuid4(),
                    "supply_item_id": item_id,
                    "transaction_type": "issue",
                    "quantity": float(issue),
                    "unit_of_measure": "dose",
                    "facility_id": fac_ext_id,
                    "facility_name": fac_name,
                    "transaction_date": issue_date,
                    "lot_number": lot,
                    "expiry_date": expiry,
                    "extra": {**extra_base, "issue_type": "routine_distribution"},
                })

                # Wastage — every even month only
                if month_num % 2 == 0:
                    wastage = _wastage_qty(receipt, sm)
                    rows.append({
                        "id": uuid.uuid4(),
                        "supply_item_id": item_id,
                        "transaction_type": "wastage",
                        "quantity": float(wastage),
                        "unit_of_measure": "dose",
                        "facility_id": fac_ext_id,
                        "facility_name": fac_name,
                        "transaction_date": last_day,
                        "lot_number": lot,
                        "expiry_date": expiry,
                        "extra": {**extra_base, "wastage_reason": "open_vial"},
                    })

    return rows


async def _insert_transactions(
    session: AsyncSession,
    rows: list[dict],
    batch_size: int = 500,
) -> None:
    import json

    stmt = text("""
        INSERT INTO supply_transactions
            (id, supply_item_id, transaction_type, quantity, unit_of_measure,
             facility_id, facility_name, transaction_date, lot_number,
             expiry_date, extra)
        VALUES
            (:id, :supply_item_id, :transaction_type, :quantity, :unit_of_measure,
             :facility_id, :facility_name, :transaction_date, :lot_number,
             :expiry_date, :extra)
        ON CONFLICT DO NOTHING
    """)

    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        params = [
            {
                **r,
                "id": str(r["id"]),
                "supply_item_id": str(r["supply_item_id"]),
                "extra": json.dumps(r["extra"]),
            }
            for r in batch
        ]
        await session.execute(stmt, params)
        log.info("Inserted batch %d–%d / %d", i + 1, i + len(batch), len(rows))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run(dry_run: bool = False, force: bool = False) -> None:
    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://vaxai:vaxai_dev_password@localhost:5432/vaxai_vision",
    )
    engine = create_async_engine(db_url, echo=False, pool_pre_ping=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        try:
            if force:
                deleted = await _purge_demo_transactions(session)
                log.info("Purged %d existing demo transactions.", deleted)

            item_ids = await _get_or_create_supply_items(session)
            log.info("Supply items resolved: %s", list(item_ids.keys()))

            rows = await _build_transactions(item_ids)
            log.info(
                "Generated %d transactions  (%d facilities × %d vaccines × 13 months, with wastage)",
                len(rows),
                len(FACILITIES),
                len(VACCINES),
            )

            if dry_run:
                log.info("[DRY RUN] No rows written to database.")
                breakdown = {}
                for r in rows:
                    breakdown[r["transaction_type"]] = (
                        breakdown.get(r["transaction_type"], 0) + 1
                    )
                log.info("Breakdown: %s", breakdown)
                return

            await _insert_transactions(session, rows)
            await session.commit()
            log.info("Done. %d supply_transactions committed.", len(rows))

        except Exception:
            await session.rollback()
            log.exception("Seed failed; rolled back.")
            raise
        finally:
            await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print counts without writing to the database.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Delete existing demo seed rows before inserting.",
    )
    args = parser.parse_args()

    try:
        from dateutil.relativedelta import relativedelta as _  # noqa: F401 – verify import
    except ImportError:
        log.error(
            "python-dateutil is not installed. "
            "Run: pip install python-dateutil"
        )
        sys.exit(1)

    asyncio.run(run(dry_run=args.dry_run, force=args.force))


if __name__ == "__main__":
    main()
