"""Aggregate product tracking across scan frames."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scan_session import ScanDetection
from app.vision.ar.schemas import ProductCount


async def get_running_counts(
    db: AsyncSession, session_id: "uuid.UUID"
) -> list[ProductCount]:
    """Return aggregated product counts for a scan session."""
    import uuid

    stmt = (
        select(
            ScanDetection.product_code,
            func.max(ScanDetection.product_name).label("product_name"),
            func.sum(ScanDetection.quantity).label("total_qty"),
        )
        .where(ScanDetection.session_id == session_id)
        .group_by(ScanDetection.product_code)
        .order_by(ScanDetection.product_code)
    )
    result = await db.execute(stmt)
    return [
        ProductCount(
            product_code=row.product_code,
            product_name=row.product_name,
            scanned_count=int(row.total_qty),
        )
        for row in result.all()
    ]
