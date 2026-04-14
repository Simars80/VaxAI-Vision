"""Unit tests for AR stock counter session lifecycle and reconciliation."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.models.scan_session import ScanSession, SessionStatus
from app.vision.ar.schemas import (
    CreateSessionRequest,
    DiscrepancyItem,
    FrameDetection,
    ProductCount,
    SubmitFrameRequest,
)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _make_session(**overrides) -> ScanSession:
    defaults = dict(
        id=uuid.uuid4(),
        facility_id="FAC-001",
        facility_name="Test Health Centre",
        status=SessionStatus.draft,
        operator_id=uuid.uuid4(),
        notes=None,
        frame_count=0,
        product_count=0,
        started_at=None,
        completed_at=None,
        reconciliation_summary=None,
    )
    defaults.update(overrides)
    return ScanSession(**defaults)


# ── Session Lifecycle Tests ──────────────────────────────────────────────────


class TestSessionLifecycle:
    def test_session_starts_as_draft(self):
        session = _make_session()
        assert session.status == SessionStatus.draft
        assert session.frame_count == 0
        assert session.started_at is None

    def test_session_status_transitions(self):
        session = _make_session()

        session.status = SessionStatus.active
        session.started_at = datetime.now(timezone.utc)
        assert session.status == SessionStatus.active
        assert session.started_at is not None

        session.status = SessionStatus.reconciling
        assert session.status == SessionStatus.reconciling

        session.status = SessionStatus.complete
        session.completed_at = datetime.now(timezone.utc)
        assert session.status == SessionStatus.complete
        assert session.completed_at is not None

    def test_session_can_be_cancelled(self):
        session = _make_session()
        session.status = SessionStatus.cancelled
        assert session.status == SessionStatus.cancelled


class TestSessionModule:
    @pytest.mark.asyncio
    async def test_create_session(self):
        from app.vision.ar.session import create_session

        db = AsyncMock()
        db.flush = AsyncMock()

        req = CreateSessionRequest(
            facility_id="FAC-001",
            facility_name="Test Facility",
            notes="Test session",
        )
        operator_id = uuid.uuid4()

        session = await create_session(db, req, operator_id=operator_id)

        assert session.facility_id == "FAC-001"
        assert session.facility_name == "Test Facility"
        assert session.status == SessionStatus.draft
        assert session.operator_id == operator_id
        db.add.assert_called_once()
        db.flush.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_activate_session_from_draft(self):
        from app.vision.ar.session import activate_session

        db = AsyncMock()
        db.flush = AsyncMock()
        session = _make_session(status=SessionStatus.draft)

        result = await activate_session(db, session)

        assert result.status == SessionStatus.active
        assert result.started_at is not None
        db.flush.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_activate_session_rejects_non_draft(self):
        from app.vision.ar.session import activate_session

        db = AsyncMock()
        session = _make_session(status=SessionStatus.active)

        with pytest.raises(ValueError, match="Cannot activate"):
            await activate_session(db, session)

    @pytest.mark.asyncio
    async def test_begin_reconciliation_from_active(self):
        from app.vision.ar.session import begin_reconciliation

        db = AsyncMock()
        db.flush = AsyncMock()
        session = _make_session(status=SessionStatus.active)

        result = await begin_reconciliation(db, session)

        assert result.status == SessionStatus.reconciling

    @pytest.mark.asyncio
    async def test_begin_reconciliation_rejects_non_active(self):
        from app.vision.ar.session import begin_reconciliation

        db = AsyncMock()
        session = _make_session(status=SessionStatus.draft)

        with pytest.raises(ValueError, match="Cannot reconcile"):
            await begin_reconciliation(db, session)

    @pytest.mark.asyncio
    async def test_complete_session(self):
        from app.vision.ar.session import complete_session

        db = AsyncMock()
        db.flush = AsyncMock()
        session = _make_session(status=SessionStatus.reconciling)
        summary = {"total_products": 3, "discrepancies": 1}

        result = await complete_session(db, session, summary)

        assert result.status == SessionStatus.complete
        assert result.completed_at is not None
        assert result.reconciliation_summary == summary

    @pytest.mark.asyncio
    async def test_complete_session_rejects_non_reconciling(self):
        from app.vision.ar.session import complete_session

        db = AsyncMock()
        session = _make_session(status=SessionStatus.active)

        with pytest.raises(ValueError, match="Cannot complete"):
            await complete_session(db, session, {})


# ── Reconciliation Tests ─────────────────────────────────────────────────────


class TestReconciliation:
    @pytest.mark.asyncio
    async def test_reconcile_detects_discrepancies(self):
        from app.vision.ar.reconciliation import reconcile_session

        session = _make_session(
            status=SessionStatus.reconciling,
            facility_id="FAC-001",
        )

        mock_scanned = {
            "VAC-001": {"quantity": 10, "name": "BCG Vaccine"},
            "VAC-002": {"quantity": 5, "name": "OPV"},
        }
        mock_system = {
            "VAC-001": {"quantity": 10.0, "name": "BCG Vaccine"},
            "VAC-002": {"quantity": 8.0, "name": "OPV"},
            "VAC-003": {"quantity": 3.0, "name": "Measles"},
        }

        db = AsyncMock()

        with (
            patch(
                "app.vision.ar.reconciliation._get_scanned_counts",
                return_value=mock_scanned,
            ),
            patch(
                "app.vision.ar.reconciliation._get_system_stock",
                return_value=mock_system,
            ),
        ):
            items, summary = await reconcile_session(db, session)

        assert len(items) == 3
        assert summary["discrepancies"] == 2

        by_code = {item.product_code: item for item in items}

        assert by_code["VAC-001"].status == "match"
        assert by_code["VAC-001"].difference == 0.0

        assert by_code["VAC-002"].status == "under"
        assert by_code["VAC-002"].scanned_count == 5
        assert by_code["VAC-002"].system_count == 8.0

        assert by_code["VAC-003"].status == "under"
        assert by_code["VAC-003"].scanned_count == 0

    @pytest.mark.asyncio
    async def test_reconcile_all_match(self):
        from app.vision.ar.reconciliation import reconcile_session

        session = _make_session(
            status=SessionStatus.reconciling,
            facility_id="FAC-002",
        )

        mock_scanned = {"VAC-001": {"quantity": 10, "name": "BCG"}}
        mock_system = {"VAC-001": {"quantity": 10.0, "name": "BCG"}}

        db = AsyncMock()

        with (
            patch(
                "app.vision.ar.reconciliation._get_scanned_counts",
                return_value=mock_scanned,
            ),
            patch(
                "app.vision.ar.reconciliation._get_system_stock",
                return_value=mock_system,
            ),
        ):
            items, summary = await reconcile_session(db, session)

        assert len(items) == 1
        assert summary["discrepancies"] == 0
        assert items[0].status == "match"

    @pytest.mark.asyncio
    async def test_reconcile_over_count(self):
        from app.vision.ar.reconciliation import reconcile_session

        session = _make_session(
            status=SessionStatus.reconciling,
            facility_id="FAC-003",
        )

        mock_scanned = {"VAC-001": {"quantity": 15, "name": "BCG"}}
        mock_system = {"VAC-001": {"quantity": 10.0, "name": "BCG"}}

        db = AsyncMock()

        with (
            patch(
                "app.vision.ar.reconciliation._get_scanned_counts",
                return_value=mock_scanned,
            ),
            patch(
                "app.vision.ar.reconciliation._get_system_stock",
                return_value=mock_system,
            ),
        ):
            items, summary = await reconcile_session(db, session)

        assert items[0].status == "over"
        assert items[0].difference == 5.0
        assert summary["discrepancies"] == 1


# ── Schema Validation Tests ──────────────────────────────────────────────────


class TestSchemas:
    def test_create_session_request_validation(self):
        req = CreateSessionRequest(facility_id="FAC-001")
        assert req.facility_id == "FAC-001"
        assert req.facility_name is None
        assert req.notes is None

    def test_frame_detection_validation(self):
        det = FrameDetection(
            product_code="VAC-001",
            product_name="BCG Vaccine",
            quantity=5,
            confidence=0.95,
        )
        assert det.quantity == 5
        assert det.confidence == 0.95

    def test_frame_detection_defaults(self):
        det = FrameDetection(product_code="VAC-001")
        assert det.quantity == 1
        assert det.confidence == 0.0
        assert det.product_name is None

    def test_submit_frame_requires_detections(self):
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            SubmitFrameRequest(frame_index=0, detections=[])

    def test_product_count_schema(self):
        pc = ProductCount(
            product_code="VAC-001",
            product_name="BCG",
            scanned_count=10,
        )
        assert pc.scanned_count == 10

    def test_discrepancy_item_schema(self):
        item = DiscrepancyItem(
            product_code="VAC-001",
            product_name="BCG",
            scanned_count=10,
            system_count=8.0,
            difference=2.0,
            status="over",
        )
        assert item.status == "over"
        assert item.difference == 2.0
