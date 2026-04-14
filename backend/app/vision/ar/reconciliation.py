"""Reconciliation: compare scanned counts against facility inventory records."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scan_session import ScanDetection, ScanSession
from app.models.supply import SupplyItem, SupplyTransaction
from app.vision.ar.schemas import DiscrepancyItem


async def reconcile_session(
    db: AsyncSession,
    session: ScanSession,
) -> tuple[list[DiscrepancyItem], dict]:
    """Compare scanned product counts against system inventory for the facility.

    Returns (discrepancy_items, summary_dict).
    """
    scanned = await _get_scanned_counts(db, session.id)

    system_stock = await _get_system_stock(db, session.facility_id)

    all_codes = set(scanned.keys()) | set(system_stock.keys())
    items: list[DiscrepancyItem] = []
    total_discrepancies = 0

    for code in sorted(all_codes):
        sc = scanned.get(code)
        sys_count = system_stock.get(code, {}).get("quantity", 0.0)
        scanned_count = sc["quantity"] if sc else 0
        product_name = (
            sc["name"] if sc else system_stock.get(code, {}).get("name")
        )
        diff = scanned_count - sys_count

        if abs(diff) < 0.5:
            status = "match"
        elif diff > 0:
            status = "over"
            total_discrepancies += 1
        else:
            status = "under"
            total_discrepancies += 1

        items.append(
            DiscrepancyItem(
                product_code=code,
                product_name=product_name,
                scanned_count=scanned_count,
                system_count=sys_count,
                difference=diff,
                status=status,
            )
        )

    summary = {
        "total_products": len(all_codes),
        "matches": len(all_codes) - total_discrepancies,
        "discrepancies": total_discrepancies,
        "reconciled_at": datetime.now(timezone.utc).isoformat(),
    }

    return items, summary


async def _get_scanned_counts(
    db: AsyncSession, session_id: uuid.UUID
) -> dict[str, dict]:
    stmt = (
        select(
            ScanDetection.product_code,
            func.max(ScanDetection.product_name).label("product_name"),
            func.sum(ScanDetection.quantity).label("total_qty"),
        )
        .where(ScanDetection.session_id == session_id)
        .group_by(ScanDetection.product_code)
    )
    result = await db.execute(stmt)
    return {
        row.product_code: {
            "quantity": int(row.total_qty),
            "name": row.product_name,
        }
        for row in result.all()
    }


async def _get_system_stock(
    db: AsyncSession, facility_id: str
) -> dict[str, dict]:
    """Get current stock levels for a facility from supply transactions."""
    signed_qty = case(
        (
            SupplyTransaction.transaction_type.in_(["issue", "wastage"]),
            -SupplyTransaction.quantity,
        ),
        else_=SupplyTransaction.quantity,
    )

    stmt = (
        select(
            SupplyItem.external_code,
            func.max(SupplyItem.name).label("item_name"),
            func.sum(signed_qty).label("current_stock"),
        )
        .join(SupplyItem, SupplyItem.id == SupplyTransaction.supply_item_id)
        .where(
            SupplyTransaction.facility_id == facility_id,
            SupplyItem.external_code.isnot(None),
        )
        .group_by(SupplyItem.external_code)
    )
    result = await db.execute(stmt)
    return {
        row.external_code: {
            "quantity": float(row.current_stock or 0),
            "name": row.item_name,
        }
        for row in result.all()
    }
