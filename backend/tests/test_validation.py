"""Tests for the VaxAI Vision data validation system.

Covers:
  - Individual validators in isolation
  - The ValidationPipeline (good data, bad data, CSV parsing)
  - DataQualityScore / QualityScorer
  - Pydantic schema coercion (InventoryRecord, ColdChainReadingRecord, CoverageRecord)

All tests are purely in-memory — no database or network required.
"""

from __future__ import annotations

import io
from datetime import date, datetime, timedelta, timezone

import pytest

from app.validation.rules import (
    CompletenessChecker,
    DateValidator,
    DuplicateDetector,
    OutlierDetector,
    Severity,
    StockConsistencyValidator,
    TemperatureRangeValidator,
    ValidationIssue,
)
from app.validation.schemas import (
    ColdChainReadingRecord,
    CoverageRecord,
    InventoryRecord,
    WHO_VACCINE_CODES,
)
from app.validation.pipeline import ValidationPipeline, ValidationReport
from app.validation.quality import (
    DataQualityScore,
    QualityDimensions,
    QualityScorer,
    QualityTrendTracker,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

TODAY = datetime.now(timezone.utc).date()
YESTERDAY = TODAY - timedelta(days=1)
NEXT_YEAR = date(TODAY.year + 1, TODAY.month, TODAY.day)


def _issues(*args) -> list[ValidationIssue]:
    """Create an empty list for collecting issues."""
    return []


def _good_inventory(**overrides) -> dict:
    base = {
        "facility_id": "FAC001",
        "vaccine_code": "BCG",
        "batch_number": "BCG-2026-001",
        "quantity": 500.0,
        "expiry_date": NEXT_YEAR,
        "storage_temp": 4.5,
    }
    base.update(overrides)
    return base


def _good_cold_chain(**overrides) -> dict:
    base = {
        "equipment_id": "CCE-001",
        "facility_id": "FAC001",
        "temperature": 4.0,
        "timestamp": datetime(2026, 4, 10, 8, 0, 0, tzinfo=timezone.utc),
        "sensor_id": "SENSOR-A1",
    }
    base.update(overrides)
    return base


def _good_coverage(**overrides) -> dict:
    base = {
        "facility_id": "FAC001",
        "vaccine_code": "MCV1",
        "date": YESTERDAY,
        "doses_given": 80.0,
        "target_population": 100.0,
        "coverage_rate": 80.0,
    }
    base.update(overrides)
    return base


# ═══════════════════════════════════════════════════════════════════════════════
# Schema validation tests
# ═══════════════════════════════════════════════════════════════════════════════


class TestInventoryRecord:
    def test_valid_record_parses(self):
        rec = InventoryRecord(**_good_inventory())
        assert rec.vaccine_code == "BCG"
        assert rec.quantity == 500.0

    def test_invalid_vaccine_code_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="not a recognised WHO/EPI"):
            InventoryRecord(**_good_inventory(vaccine_code="FAKEVAX"))

    def test_negative_quantity_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            InventoryRecord(**_good_inventory(quantity=-10))

    def test_vaccine_code_normalised_to_upper(self):
        rec = InventoryRecord(**_good_inventory(vaccine_code="bcg"))
        assert rec.vaccine_code == "BCG"

    def test_invalid_batch_number_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="Batch number"):
            InventoryRecord(**_good_inventory(batch_number="batch with spaces!"))

    def test_all_who_codes_accepted(self):
        # Spot-check a representative set
        for code in ("OPV3", "MCV2", "COVID19-mRNA", "HPV2", "TT5"):
            rec = InventoryRecord(**_good_inventory(vaccine_code=code))
            assert rec.vaccine_code == code.upper()


class TestColdChainReadingRecord:
    def test_valid_record_parses(self):
        rec = ColdChainReadingRecord(**_good_cold_chain())
        assert rec.temperature == 4.0

    def test_implausible_temperature_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="plausible sensor range"):
            ColdChainReadingRecord(**_good_cold_chain(temperature=150))

    def test_negative_implausible_temperature_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="plausible sensor range"):
            ColdChainReadingRecord(**_good_cold_chain(temperature=-150))

    def test_frozen_temperature_accepted(self):
        rec = ColdChainReadingRecord(**_good_cold_chain(temperature=-20.0))
        assert rec.temperature == -20.0

    def test_invalid_sensor_id_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            ColdChainReadingRecord(**_good_cold_chain(sensor_id="sensor with space!"))


class TestCoverageRecord:
    def test_valid_record_parses(self):
        rec = CoverageRecord(**_good_coverage())
        assert rec.doses_given == 80.0

    def test_coverage_rate_out_of_bounds_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            CoverageRecord(**_good_coverage(coverage_rate=110.0))

    def test_negative_doses_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            CoverageRecord(**_good_coverage(doses_given=-5))

    def test_zero_target_population_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            CoverageRecord(**_good_coverage(target_population=0))

    def test_rate_mismatch_sets_internal_flag(self):
        # doses=50, target=100 → computed=50%, declared=80% → mismatch
        rec = CoverageRecord(**_good_coverage(doses_given=50.0, coverage_rate=80.0))
        assert hasattr(rec, "_rate_mismatch")
        assert abs(rec._rate_mismatch - 50.0) < 0.01


# ═══════════════════════════════════════════════════════════════════════════════
# Business rule validator tests
# ═══════════════════════════════════════════════════════════════════════════════


class TestTemperatureRangeValidator:
    def setup_method(self):
        self.validator = TemperatureRangeValidator()

    def test_bcg_within_range_passes(self):
        issues: list[ValidationIssue] = []
        self.validator.validate(
            {"vaccine_code": "BCG", "storage_temp": 4.0}, issues
        )
        assert len(issues) == 0

    def test_bcg_too_cold_raises_error(self):
        issues: list[ValidationIssue] = []
        self.validator.validate(
            {"vaccine_code": "BCG", "storage_temp": 0.5}, issues
        )
        assert any(i.severity == Severity.ERROR for i in issues)
        assert "below minimum" in issues[0].message

    def test_bcg_too_hot_raises_error(self):
        issues: list[ValidationIssue] = []
        self.validator.validate(
            {"vaccine_code": "BCG", "storage_temp": 10.0}, issues
        )
        assert any(i.severity == Severity.ERROR for i in issues)
        assert "exceeds maximum" in issues[0].message

    def test_mrna_vaccine_frozen_range(self):
        issues: list[ValidationIssue] = []
        self.validator.validate(
            {"vaccine_code": "COVID19-mRNA", "storage_temp": -20.0}, issues
        )
        assert len(issues) == 0

    def test_mrna_vaccine_too_warm(self):
        issues: list[ValidationIssue] = []
        self.validator.validate(
            {"vaccine_code": "COVID19-mRNA", "storage_temp": 4.0}, issues
        )
        assert any(i.severity == Severity.ERROR for i in issues)

    def test_missing_temperature_raises_error(self):
        issues: list[ValidationIssue] = []
        self.validator.validate({"vaccine_code": "BCG"}, issues)
        assert any("missing" in i.message.lower() for i in issues)

    def test_cold_chain_reading_uses_default_range(self):
        # No vaccine_code — should fall back to 2–8°C default
        issues: list[ValidationIssue] = []
        self.validator.validate({"temperature": 6.0}, issues)
        assert len(issues) == 0

    def test_opv_frozen_passes(self):
        issues: list[ValidationIssue] = []
        self.validator.validate(
            {"vaccine_code": "OPV", "storage_temp": -20.0}, issues
        )
        assert len(issues) == 0


class TestStockConsistencyValidator:
    def setup_method(self):
        self.validator = StockConsistencyValidator()

    def test_balanced_stock_passes(self):
        issues: list[ValidationIssue] = []
        record = {
            "opening_stock": 100.0,
            "received": 50.0,
            "administered": 30.0,
            "closing_stock": 120.0,
        }
        self.validator.validate(record, issues)
        assert len(issues) == 0

    def test_imbalanced_stock_warns(self):
        issues: list[ValidationIssue] = []
        record = {
            "opening_stock": 100.0,
            "received": 50.0,
            "administered": 30.0,
            "closing_stock": 90.0,   # Should be 120
        }
        self.validator.validate(record, issues)
        assert any(i.severity == Severity.WARNING for i in issues)
        assert "imbalance" in issues[0].message

    def test_missing_fields_emits_info(self):
        issues: list[ValidationIssue] = []
        self.validator.validate({"opening_stock": 100.0}, issues)
        assert any(i.severity == Severity.INFO for i in issues)

    def test_tolerance_allows_rounding(self):
        # Diff of 0.5 — within tolerance of 1.0
        issues: list[ValidationIssue] = []
        record = {
            "opening_stock": 100.0,
            "received": 50.0,
            "administered": 30.0,
            "closing_stock": 120.5,
        }
        self.validator.validate(record, issues)
        assert len(issues) == 0


class TestDateValidator:
    def setup_method(self):
        self.validator = DateValidator()

    def test_past_date_passes(self):
        issues: list[ValidationIssue] = []
        self.validator.validate({"date": YESTERDAY}, issues)
        assert not any(i.severity == Severity.ERROR for i in issues)

    def test_future_date_raises_error(self):
        issues: list[ValidationIssue] = []
        future = TODAY + timedelta(days=10)
        self.validator.validate({"date": future}, issues)
        assert any(i.severity == Severity.ERROR for i in issues)
        assert "future" in issues[0].message

    def test_date_before_registration_warns(self):
        issues: list[ValidationIssue] = []
        context = {"facility_registered_at": TODAY}
        pre_reg = TODAY - timedelta(days=5)
        self.validator.validate({"date": pre_reg}, issues, context)
        assert any(i.severity == Severity.WARNING for i in issues)

    def test_expired_batch_warns(self):
        issues: list[ValidationIssue] = []
        expired = TODAY - timedelta(days=30)
        self.validator.validate({"expiry_date": expired}, issues)
        assert any(i.severity == Severity.WARNING for i in issues)
        assert "expired" in issues[0].message.lower()

    def test_future_expiry_passes(self):
        issues: list[ValidationIssue] = []
        self.validator.validate({"expiry_date": NEXT_YEAR}, issues)
        assert not any(i.field == "expiry_date" and i.severity == Severity.ERROR for i in issues)


class TestDuplicateDetector:
    def setup_method(self):
        self.detector = DuplicateDetector()

    def test_first_record_passes(self):
        issues: list[ValidationIssue] = []
        self.detector.validate(_good_inventory(), issues)
        assert len(issues) == 0

    def test_exact_duplicate_raises_error(self):
        record = _good_inventory()
        issues1: list[ValidationIssue] = []
        issues2: list[ValidationIssue] = []
        self.detector.validate(record, issues1)
        self.detector.validate(record, issues2)
        assert any(i.severity == Severity.ERROR for i in issues2)

    def test_near_duplicate_warns(self):
        record1 = _good_inventory(quantity=500.0)
        record2 = _good_inventory(quantity=502.0)  # 0.4% diff — within 5%
        issues1: list[ValidationIssue] = []
        issues2: list[ValidationIssue] = []
        self.detector.validate(record1, issues1)
        self.detector.validate(record2, issues2)
        assert any(i.severity == Severity.WARNING for i in issues2)

    def test_different_facility_not_duplicate(self):
        issues1: list[ValidationIssue] = []
        issues2: list[ValidationIssue] = []
        self.detector.validate(_good_inventory(facility_id="FAC001"), issues1)
        self.detector.validate(_good_inventory(facility_id="FAC002"), issues2)
        # No duplicate warning for different facility
        assert not any(i.severity == Severity.ERROR for i in issues2)


class TestOutlierDetector:
    def setup_method(self):
        # Pre-seed with known stats: mean=500, std=50
        self.detector = OutlierDetector(
            stats={"FAC001": {"mean": 500.0, "std": 50.0}}
        )

    def test_normal_value_passes(self):
        issues: list[ValidationIssue] = []
        self.detector.validate({"facility_id": "FAC001", "quantity": 510.0}, issues)
        assert len(issues) == 0

    def test_outlier_value_warns(self):
        issues: list[ValidationIssue] = []
        # 3+ std deviations above mean: 500 + 4*50 = 700
        self.detector.validate({"facility_id": "FAC001", "quantity": 750.0}, issues)
        assert any(i.severity == Severity.WARNING for i in issues)
        assert "outlier" in issues[0].message.lower()

    def test_unknown_facility_skipped(self):
        issues: list[ValidationIssue] = []
        self.detector.validate({"facility_id": "UNKNOWN", "quantity": 99999.0}, issues)
        assert len(issues) == 0

    def test_batch_accumulation_then_detect(self):
        detector = OutlierDetector()
        # Accumulate values centred around 100
        for v in [95, 100, 105, 98, 102, 103, 99, 101, 100, 100]:
            detector.accumulate({"facility_id": "FAC002", "quantity": v})

        issues: list[ValidationIssue] = []
        detector.validate({"facility_id": "FAC002", "quantity": 500.0}, issues)
        assert any(i.severity == Severity.WARNING for i in issues)


class TestCompletenessChecker:
    def setup_method(self):
        self.checker = CompletenessChecker(record_type="inventory")

    def test_complete_record_no_issues(self):
        issues: list[ValidationIssue] = []
        self.checker.validate(_good_inventory(), issues)
        error_issues = [i for i in issues if i.severity == Severity.ERROR]
        assert len(error_issues) == 0

    def test_missing_required_field_raises_error(self):
        issues: list[ValidationIssue] = []
        record = _good_inventory()
        del record["facility_id"]
        self.checker.validate(record, issues)
        assert any(i.field == "facility_id" for i in issues)

    def test_empty_string_treated_as_missing(self):
        issues: list[ValidationIssue] = []
        record = _good_inventory(vaccine_code="")
        self.checker.validate(record, issues)
        assert any(i.field == "vaccine_code" for i in issues)

    def test_coverage_checker_required_fields(self):
        checker = CompletenessChecker(record_type="coverage")
        issues: list[ValidationIssue] = []
        record = _good_coverage()
        del record["target_population"]
        checker.validate(record, issues)
        assert any(i.field == "target_population" for i in issues)


# ═══════════════════════════════════════════════════════════════════════════════
# ValidationPipeline tests
# ═══════════════════════════════════════════════════════════════════════════════


class TestValidationPipeline:
    def test_clean_batch_all_valid(self):
        records = [_good_inventory(batch_number=f"BCG-2026-{i:03d}") for i in range(10)]
        pipeline = ValidationPipeline(record_type="inventory")
        report = pipeline.validate_batch(records)

        assert report.total_records == 10
        assert report.error_count == 0
        assert report.valid_count + report.warning_count == 10

    def test_batch_with_invalid_vaccine_code(self):
        records = [
            _good_inventory(),
            _good_inventory(vaccine_code="INVALID", batch_number="XX-001"),
            _good_inventory(batch_number="BCG-002"),
        ]
        pipeline = ValidationPipeline(record_type="inventory")
        report = pipeline.validate_batch(records)

        assert report.error_count >= 1

    def test_batch_with_bad_temperature(self):
        records = [
            _good_inventory(storage_temp=25.0),  # too warm for BCG
        ]
        pipeline = ValidationPipeline(record_type="inventory")
        report = pipeline.validate_batch(records)

        assert report.error_count >= 1

    def test_future_date_caught(self):
        future = TODAY + timedelta(days=5)
        records = [_good_coverage(date=future)]
        pipeline = ValidationPipeline(record_type="coverage")
        report = pipeline.validate_batch(records)
        assert report.error_count >= 1

    def test_duplicate_detected(self):
        record = _good_inventory()
        records = [record, record]
        pipeline = ValidationPipeline(record_type="inventory")
        report = pipeline.validate_batch(records)
        assert report.error_count >= 1

    def test_csv_parsing_good_data(self):
        csv_content = (
            "facility_id,vaccine_code,batch_number,quantity,expiry_date,storage_temp\n"
            f"FAC001,BCG,BCG-001,500,{NEXT_YEAR},4.5\n"
            f"FAC002,MCV1,MCV-001,200,{NEXT_YEAR},3.8\n"
        )
        pipeline = ValidationPipeline(record_type="inventory")
        report = pipeline.validate_csv(csv_content)
        assert report.total_records == 2
        assert report.error_count == 0

    def test_csv_parsing_missing_required_field(self):
        # batch_number column missing
        csv_content = (
            "facility_id,vaccine_code,quantity,expiry_date,storage_temp\n"
            f"FAC001,BCG,500,{NEXT_YEAR},4.5\n"
        )
        pipeline = ValidationPipeline(record_type="inventory")
        report = pipeline.validate_csv(csv_content)
        # batch_number will be None → error
        assert report.error_count >= 1

    def test_cold_chain_pipeline(self):
        records = [
            _good_cold_chain(),
            _good_cold_chain(sensor_id="SENSOR-A2", temperature=5.0),
        ]
        pipeline = ValidationPipeline(record_type="cold_chain")
        report = pipeline.validate_batch(records)
        assert report.total_records == 2
        assert report.error_count == 0

    def test_coverage_pipeline(self):
        records = [
            _good_coverage(),
            _good_coverage(vaccine_code="OPV3", doses_given=60.0, coverage_rate=60.0),
        ]
        pipeline = ValidationPipeline(record_type="coverage")
        report = pipeline.validate_batch(records)
        assert report.total_records == 2
        assert report.error_count == 0

    def test_pipeline_reset_between_batches(self):
        record = _good_inventory()
        pipeline = ValidationPipeline(record_type="inventory")

        # First batch — no duplicates
        report1 = pipeline.validate_batch([record])
        assert report1.error_count == 0

        # Second batch — same record should NOT be flagged (pipeline reset)
        report2 = pipeline.validate_batch([record], reset=True)
        assert report2.error_count == 0

    def test_invalid_record_type_raises(self):
        with pytest.raises(ValueError, match="Unknown record_type"):
            ValidationPipeline(record_type="foobar")

    def test_valid_records_populated(self):
        records = [_good_inventory(batch_number=f"BCG-{i:03d}") for i in range(3)]
        pipeline = ValidationPipeline(record_type="inventory")
        report = pipeline.validate_batch(records)
        assert len(report.valid_records) == 3

    def test_rate_mismatch_generates_warning(self):
        # doses=50, target=100 → computed=50%, declared=80%
        records = [_good_coverage(doses_given=50.0, coverage_rate=80.0)]
        pipeline = ValidationPipeline(record_type="coverage")
        report = pipeline.validate_batch(records)
        # Mismatch is a WARNING, not an ERROR — record should be accepted
        assert report.error_count == 0
        warning_issues = [e for e in report.errors if e["severity"] == Severity.WARNING]
        assert any("coverage_rate" in (e.get("field") or "") for e in warning_issues)


# ═══════════════════════════════════════════════════════════════════════════════
# DataQualityScore / QualityScorer tests
# ═══════════════════════════════════════════════════════════════════════════════


class TestQualityDimensions:
    def test_overall_weighted_average(self):
        dims = QualityDimensions(
            completeness=1.0, accuracy=1.0, timeliness=1.0, consistency=1.0
        )
        assert dims.overall == pytest.approx(1.0)

    def test_grade_a(self):
        dims = QualityDimensions(
            completeness=0.95, accuracy=0.95, timeliness=0.95, consistency=0.95
        )
        assert dims.grade() == "A"

    def test_grade_f(self):
        dims = QualityDimensions(
            completeness=0.2, accuracy=0.2, timeliness=0.2, consistency=0.2
        )
        assert dims.grade() == "F"

    def test_to_dict_contains_grade(self):
        dims = QualityDimensions(
            completeness=0.8, accuracy=0.8, timeliness=0.8, consistency=0.8
        )
        d = dims.to_dict()
        assert "grade" in d
        assert "overall" in d


class TestQualityScorer:
    def _make_clean_report(self, n: int = 10, record_type: str = "inventory") -> tuple:
        records = [_good_inventory(batch_number=f"BCG-{i:03d}") for i in range(n)]
        pipeline = ValidationPipeline(record_type=record_type)
        report = pipeline.validate_batch(records)
        return report, records

    def test_clean_data_high_accuracy(self):
        report, records = self._make_clean_report()
        scorer = QualityScorer()
        score = scorer.score_report(
            report=report,
            facility_id="FAC001",
            period="2026-04",
            raw_records=records,
        )
        assert score.dimensions.accuracy >= 0.95

    def test_clean_data_high_completeness(self):
        report, records = self._make_clean_report()
        scorer = QualityScorer()
        score = scorer.score_report(
            report=report,
            facility_id="FAC001",
            period="2026-04",
            raw_records=records,
        )
        assert score.dimensions.completeness >= 0.95

    def test_partial_errors_lower_accuracy(self):
        records = [
            _good_inventory(batch_number=f"BCG-{i:03d}") for i in range(8)
        ] + [
            _good_inventory(vaccine_code="INVALID", batch_number="XX-001"),
            _good_inventory(vaccine_code="INVALID", batch_number="XX-002"),
        ]
        pipeline = ValidationPipeline(record_type="inventory")
        report = pipeline.validate_batch(records)

        scorer = QualityScorer()
        score = scorer.score_report(
            report=report,
            facility_id="FAC001",
            period="2026-04",
            raw_records=records,
        )
        assert score.dimensions.accuracy < 1.0

    def test_timeliness_all_recent(self):
        # All records from yesterday — should be fully timely
        records = [_good_inventory(batch_number=f"BCG-{i:03d}") for i in range(5)]
        # Inject date field (not used by inventory schema but scorer inspects it)
        for r in records:
            r["date"] = YESTERDAY

        pipeline = ValidationPipeline(record_type="inventory")
        report = pipeline.validate_batch(records)
        scorer = QualityScorer(reporting_window_days=7)
        score = scorer.score_report(
            report=report,
            facility_id="FAC001",
            period="2026-04",
            raw_records=records,
            reference_date=TODAY,
        )
        assert score.dimensions.timeliness == pytest.approx(1.0)

    def test_timeliness_stale_records(self):
        stale_date = TODAY - timedelta(days=30)
        records = [_good_inventory(batch_number=f"BCG-{i:03d}") for i in range(5)]
        for r in records:
            r["date"] = stale_date

        pipeline = ValidationPipeline(record_type="inventory")
        report = pipeline.validate_batch(records)
        scorer = QualityScorer(reporting_window_days=7)
        score = scorer.score_report(
            report=report,
            facility_id="FAC001",
            period="2026-03",
            raw_records=records,
            reference_date=TODAY,
        )
        assert score.dimensions.timeliness == 0.0

    def test_score_to_dict_has_all_keys(self):
        report, records = self._make_clean_report()
        scorer = QualityScorer()
        score = scorer.score_report(
            report=report, facility_id="FAC001", period="2026-04", raw_records=records
        )
        d = score.to_dict()
        for key in ("facility_id", "period", "dimensions", "total_records"):
            assert key in d


class TestQualityTrendTracker:
    def _make_score(self, period: str, overall: float, facility_id: str = "FAC001") -> DataQualityScore:
        dims = QualityDimensions(
            completeness=overall,
            accuracy=overall,
            timeliness=overall,
            consistency=overall,
        )
        return DataQualityScore(
            facility_id=facility_id,
            period=period,
            dimensions=dims,
            total_records=10,
        )

    def test_latest_returns_most_recent(self):
        tracker = QualityTrendTracker()
        tracker.add(self._make_score("2026-02", 0.7))
        tracker.add(self._make_score("2026-04", 0.9))
        tracker.add(self._make_score("2026-03", 0.8))

        latest = tracker.latest("FAC001")
        assert latest is not None
        assert latest.period == "2026-04"

    def test_trend_returns_ordered_list(self):
        tracker = QualityTrendTracker()
        for month, score in [("2026-01", 0.6), ("2026-02", 0.7), ("2026-03", 0.8)]:
            tracker.add(self._make_score(month, score))

        trend = tracker.trend("FAC001")
        assert len(trend) == 3
        assert trend[0]["period"] == "2026-01"
        assert trend[-1]["period"] == "2026-03"

    def test_unknown_facility_returns_none(self):
        tracker = QualityTrendTracker()
        assert tracker.latest("NONEXISTENT") is None

    def test_all_facility_ids(self):
        tracker = QualityTrendTracker()
        tracker.add(self._make_score("2026-04", 0.9, facility_id="FAC001"))
        tracker.add(self._make_score("2026-04", 0.8, facility_id="FAC002"))
        ids = tracker.all_facility_ids()
        assert set(ids) == {"FAC001", "FAC002"}

    def test_aggregate_district_summary(self):
        from app.validation.quality import QualityScorer
        scorer = QualityScorer()
        scores = [
            self._make_score("2026-04", 0.9, "FAC001"),
            self._make_score("2026-04", 0.6, "FAC002"),
        ]
        district = scorer.aggregate_district(scores, "DISTRICT-01", "2026-04")
        assert district.facility_count == 2
        assert district.best_facility.facility_id == "FAC001"
        assert district.worst_facility.facility_id == "FAC002"
        d = district.to_dict()
        assert d["average_overall_score"] > 0
