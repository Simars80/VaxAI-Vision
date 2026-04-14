"""Scan session lifecycle management."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scan_session import (
    ScanDetection,
    ScanSession,
    SessionStatus,
)
from app.vision.ar.schemas import (
    CreateSessionRequest,
    SubmitFrameRequest,
)


async def create_session(
    db: AsyncSession,
    req: CreateSessionRequest,
    operator_id: uuid.UUID | None = None,
) -> ScanSession:
    session = ScanSession(
        id=uuid.uuid4(),
        facility_id=req.facility_id,
        facility_name=req.facility_name,
        status=SessionStatus.draft,
        operator_id=operator_id,
        notes=req.notes,
    )
    db.add(session)
    await db.flush()
    return session


async def activate_session(db: AsyncSession, session: ScanSession) -> ScanSession:
    if session.status != SessionStatus.draft:
        raise ValueError(f"Cannot activate session in '{session.status.value}' state")
    session.status = SessionStatus.active
    session.started_at = datetime.now(timezone.utc)
    await db.flush()
    return session


async def add_frame_detections(
    db: AsyncSession,
    session: ScanSession,
    req: SubmitFrameRequest,
) -> list[ScanDetection]:
    if session.status == SessionStatus.draft:
        await activate_session(db, session)
    if session.status != SessionStatus.active:
        raise ValueError(
            f"Cannot add frames to session in '{session.status.value}' state"
        )

    detections = []
    for det in req.detections:
        record = ScanDetection(
            id=uuid.uuid4(),
            session_id=session.id,
            frame_index=req.frame_index,
            product_code=det.product_code,
            product_name=det.product_name,
            quantity=det.quantity,
            confidence=det.confidence,
            bounding_box=det.bounding_box,
        )
        db.add(record)
        detections.append(record)

    session.frame_count += 1
    unique_products = await _count_unique_products(db, session.id)
    session.product_count = unique_products
    await db.flush()
    return detections


async def begin_reconciliation(
    db: AsyncSession, session: ScanSession
) -> ScanSession:
    if session.status != SessionStatus.active:
        raise ValueError(
            f"Cannot reconcile session in '{session.status.value}' state"
        )
    session.status = SessionStatus.reconciling
    await db.flush()
    return session


async def complete_session(
    db: AsyncSession,
    session: ScanSession,
    reconciliation_summary: dict,
) -> ScanSession:
    if session.status != SessionStatus.reconciling:
        raise ValueError(
            f"Cannot complete session in '{session.status.value}' state"
        )
    session.status = SessionStatus.complete
    session.completed_at = datetime.now(timezone.utc)
    session.reconciliation_summary = reconciliation_summary
    await db.flush()
    return session


async def get_session(db: AsyncSession, session_id: uuid.UUID) -> ScanSession | None:
    result = await db.execute(
        select(ScanSession).where(ScanSession.id == session_id)
    )
    return result.scalar_one_or_none()


async def _count_unique_products(db: AsyncSession, session_id: uuid.UUID) -> int:
    from sqlalchemy import func

    stmt = (
        select(func.count(func.distinct(ScanDetection.product_code)))
        .where(ScanDetection.session_id == session_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one()
