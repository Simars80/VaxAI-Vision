"""Data quality scoring for pilot facilities.

DataQualityScore computes four dimensions of quality for a dataset:

  completeness  — % of expected fields that are non-null
  accuracy      — % of records that pass all business rules (no ERRORs)
  timeliness    — % of records submitted within the expected reporting window
  consistency   — % of records passing cross-field checks (e.g. stock balance)

Scores are expressed as floats in [0.0, 1.0].

The class is stateless; callers pass a ValidationReport and optional metadata
and receive a fully computed score object back.  Trend tracking is done by
accumulating a list of DataQualityScore snapshots keyed by date.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.validation.pipeline import ValidationReport
from app.validation.rules import Severity


# ── Score dataclasses ─────────────────────────────────────────────────────────


@dataclass
class QualityDimensions:
    """Individual dimension scores (0.0–1.0)."""

    completeness: float = 0.0
    accuracy: float = 0.0
    timeliness: float = 0.0
    consistency: float = 0.0

    @property
    def overall(self) -> float:
        """Weighted average. Accuracy weighted highest for vaccine data."""
        weights = {
            "completeness": 0.25,
            "accuracy": 0.40,
            "timeliness": 0.20,
            "consistency": 0.15,
        }
        return (
            self.completeness * weights["completeness"]
            + self.accuracy * weights["accuracy"]
            + self.timeliness * weights["timeliness"]
            + self.consistency * weights["consistency"]
        )

    def grade(self) -> str:
        """Human-readable grade: A / B / C / D / F."""
        score = self.overall
        if score >= 0.90:
            return "A"
        if score >= 0.75:
            return "B"
        if score >= 0.60:
            return "C"
        if score >= 0.40:
            return "D"
        return "F"

    def to_dict(self) -> dict:
        return {
            "completeness": round(self.completeness, 4),
            "accuracy": round(self.accuracy, 4),
            "timeliness": round(self.timeliness, 4),
            "consistency": round(self.consistency, 4),
            "overall": round(self.overall, 4),
            "grade": self.grade(),
        }


@dataclass
class DataQualityScore:
    """Quality score for a single facility / district / period snapshot."""

    facility_id: str
    period: str          # e.g. "2026-04", "2026-W15", or "2026"
    computed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    dimensions: QualityDimensions = field(default_factory=QualityDimensions)
    total_records: int = 0
    valid_records: int = 0
    warning_records: int = 0
    error_records: int = 0
    issues_by_field: dict[str, int] = field(default_factory=dict)
    record_type: str = "inventory"

    def to_dict(self) -> dict:
        return {
            "facility_id": self.facility_id,
            "period": self.period,
            "computed_at": self.computed_at.isoformat(),
            "record_type": self.record_type,
            "total_records": self.total_records,
            "valid_records": self.valid_records,
            "warning_records": self.warning_records,
            "error_records": self.error_records,
            "dimensions": self.dimensions.to_dict(),
            "issues_by_field": self.issues_by_field,
        }


@dataclass
class DistrictQualityScore:
    """Aggregated quality score across all facilities in a district/country."""

    district_id: str
    period: str
    computed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    facility_scores: list[DataQualityScore] = field(default_factory=list)

    @property
    def facility_count(self) -> int:
        return len(self.facility_scores)

    @property
    def average_overall(self) -> float:
        if not self.facility_scores:
            return 0.0
        return statistics.mean(s.dimensions.overall for s in self.facility_scores)

    @property
    def worst_facility(self) -> DataQualityScore | None:
        if not self.facility_scores:
            return None
        return min(self.facility_scores, key=lambda s: s.dimensions.overall)

    @property
    def best_facility(self) -> DataQualityScore | None:
        if not self.facility_scores:
            return None
        return max(self.facility_scores, key=lambda s: s.dimensions.overall)

    def to_dict(self) -> dict:
        return {
            "district_id": self.district_id,
            "period": self.period,
            "computed_at": self.computed_at.isoformat(),
            "facility_count": self.facility_count,
            "average_overall_score": round(self.average_overall, 4),
            "worst_facility": self.worst_facility.facility_id if self.worst_facility else None,
            "worst_facility_score": (
                round(self.worst_facility.dimensions.overall, 4)
                if self.worst_facility else None
            ),
            "best_facility": self.best_facility.facility_id if self.best_facility else None,
            "best_facility_score": (
                round(self.best_facility.dimensions.overall, 4)
                if self.best_facility else None
            ),
            "facility_scores": [s.to_dict() for s in self.facility_scores],
        }


# ── Scoring engine ────────────────────────────────────────────────────────────


class QualityScorer:
    """Computes DataQualityScore from a ValidationReport and metadata.

    Parameters
    ----------
    required_fields:
        List of field names that are mandatory for completeness scoring.
        Defaults to the schema's required fields if not specified.
    reporting_window_days:
        Number of days within which a record is considered "timely".
        Default: 7 days (weekly reporting cycle typical in EPI programmes).
    expected_records_per_period:
        If set, used to adjust completeness if a facility submitted fewer
        records than expected (e.g. daily reporting expects 30/month).
    """

    _REQUIRED_FIELDS: dict[str, list[str]] = {
        "inventory": [
            "facility_id", "vaccine_code", "batch_number",
            "quantity", "expiry_date", "storage_temp",
        ],
        "cold_chain": [
            "equipment_id", "facility_id", "temperature",
            "timestamp", "sensor_id",
        ],
        "coverage": [
            "facility_id", "vaccine_code", "date",
            "doses_given", "target_population", "coverage_rate",
        ],
    }

    def __init__(
        self,
        required_fields: list[str] | None = None,
        reporting_window_days: int = 7,
        expected_records_per_period: int | None = None,
    ) -> None:
        self._required_fields = required_fields  # None means use defaults per type
        self._window_days = reporting_window_days
        self._expected_count = expected_records_per_period

    def score_report(
        self,
        report: ValidationReport,
        facility_id: str,
        period: str,
        raw_records: list[dict[str, Any]] | None = None,
        reference_date: date | None = None,
    ) -> DataQualityScore:
        """Produce a DataQualityScore from a ValidationReport.

        Parameters
        ----------
        report:
            Output of ``ValidationPipeline.validate_batch()``.
        facility_id:
            Identifier of the facility being scored.
        period:
            Reporting period string (e.g. "2026-04").
        raw_records:
            Original un-coerced records, used for completeness and timeliness
            scoring.  If None, only accuracy can be computed.
        reference_date:
            The "expected submission date" for timeliness.  Defaults to today.
        """
        ref = reference_date or datetime.now(timezone.utc).date()
        record_type = report.record_type
        required = self._required_fields or self._REQUIRED_FIELDS.get(record_type, [])

        dimensions = QualityDimensions()

        total = report.total_records or 1  # avoid division by zero

        # ── Accuracy ──────────────────────────────────────────────────────────
        # % of records with no ERROR-severity issues
        clean = report.valid_count + report.warning_count
        dimensions.accuracy = clean / total

        # ── Completeness ─────────────────────────────────────────────────────
        if raw_records and required:
            total_fields = len(raw_records) * len(required)
            missing_fields = 0
            for rec in raw_records:
                for fld in required:
                    val = rec.get(fld)
                    if val is None or (isinstance(val, str) and not val.strip()):
                        missing_fields += 1
            dimensions.completeness = (
                (total_fields - missing_fields) / total_fields
                if total_fields > 0 else 0.0
            )
            # Penalise if record count is lower than expected
            if self._expected_count and len(raw_records) < self._expected_count:
                count_ratio = len(raw_records) / self._expected_count
                dimensions.completeness = min(dimensions.completeness, count_ratio)
        else:
            # Fall back: assume completeness = accuracy proxy
            dimensions.completeness = dimensions.accuracy

        # ── Timeliness ────────────────────────────────────────────────────────
        if raw_records:
            timely = 0
            for rec in raw_records:
                rec_date = self._extract_date(rec)
                if rec_date is None:
                    # No date — penalise
                    continue
                lag = (ref - rec_date).days
                if 0 <= lag <= self._window_days:
                    timely += 1
            dimensions.timeliness = timely / len(raw_records) if raw_records else 0.0
        else:
            dimensions.timeliness = 1.0  # cannot assess; assume timely

        # ── Consistency ───────────────────────────────────────────────────────
        # % of records with no CONSISTENCY-related warnings
        # We proxy this as: records without WARNING issues / total
        dimensions.consistency = (
            (report.valid_count) / total
            if total > 0 else 0.0
        )

        # ── Issues by field ───────────────────────────────────────────────────
        issues_by_field: dict[str, int] = {}
        for issue in report.errors:
            fld = issue.get("field") or "_unattributed"
            issues_by_field[fld] = issues_by_field.get(fld, 0) + 1

        return DataQualityScore(
            facility_id=facility_id,
            period=period,
            dimensions=dimensions,
            total_records=report.total_records,
            valid_records=report.valid_count,
            warning_records=report.warning_count,
            error_records=report.error_count,
            issues_by_field=issues_by_field,
            record_type=record_type,
        )

    @staticmethod
    def _extract_date(record: dict) -> date | None:
        for field_name in ("date", "timestamp", "transaction_date"):
            val = record.get(field_name)
            if val is None:
                continue
            if isinstance(val, datetime):
                return val.date()
            if isinstance(val, date):
                return val
            if isinstance(val, str):
                for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%dT%H:%M:%S"):
                    try:
                        return datetime.strptime(val.strip(), fmt).date()
                    except ValueError:
                        continue
        return None

    def aggregate_district(
        self,
        facility_scores: list[DataQualityScore],
        district_id: str,
        period: str,
    ) -> DistrictQualityScore:
        """Aggregate per-facility scores into a district summary."""
        return DistrictQualityScore(
            district_id=district_id,
            period=period,
            facility_scores=facility_scores,
        )


# ── Trend tracker ─────────────────────────────────────────────────────────────


class QualityTrendTracker:
    """Accumulates DataQualityScore snapshots and exposes trend data.

    Snapshots are keyed by (facility_id, period).  The tracker is
    intentionally in-memory; persistence is the caller's responsibility
    (e.g. serialise to JSONB in the DB).
    """

    def __init__(self) -> None:
        # {facility_id: [DataQualityScore, ...]} sorted by period
        self._history: dict[str, list[DataQualityScore]] = {}

    def add(self, score: DataQualityScore) -> None:
        self._history.setdefault(score.facility_id, []).append(score)

    def trend(self, facility_id: str, dimension: str = "overall") -> list[dict]:
        """Return time-ordered list of {period, score} for a facility."""
        scores = sorted(
            self._history.get(facility_id, []),
            key=lambda s: s.period,
        )
        result = []
        for s in scores:
            value = (
                s.dimensions.overall
                if dimension == "overall"
                else getattr(s.dimensions, dimension, None)
            )
            result.append(
                {"period": s.period, "score": round(value, 4) if value is not None else None}
            )
        return result

    def latest(self, facility_id: str) -> DataQualityScore | None:
        scores = self._history.get(facility_id)
        if not scores:
            return None
        return max(scores, key=lambda s: s.period)

    def all_facility_ids(self) -> list[str]:
        return list(self._history)
