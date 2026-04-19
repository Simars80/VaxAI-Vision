"""Validation pipeline orchestrator.

ValidationPipeline chains multiple validators together and produces a
ValidationReport summarising all findings.  It supports:

  - Batch mode:  validate a list of dicts (from CSV/Excel parsing).
  - Single-record mode:  validate one dict and return immediately.
  - Schema coercion:  optionally parse each row through a Pydantic model
    before running business-rule validators.

Usage
-----
    pipeline = ValidationPipeline(record_type="inventory")
    report = pipeline.validate_batch(rows)  # rows: list[dict]
    print(report.summary())
"""

from __future__ import annotations

import csv
import io
import logging
from dataclasses import dataclass, field
from typing import Any

from pydantic import ValidationError

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
)

logger = logging.getLogger(__name__)

# ── Record-type registry ──────────────────────────────────────────────────────

_SCHEMA_MAP: dict[str, type] = {
    "inventory": InventoryRecord,
    "cold_chain": ColdChainReadingRecord,
    "coverage": CoverageRecord,
}


# ── ValidationReport ──────────────────────────────────────────────────────────


@dataclass
class ValidationReport:
    """Aggregated result of a validation run."""

    record_type: str
    total_records: int = 0
    valid_count: int = 0      # passed all validators with no ERRORs
    warning_count: int = 0    # accepted but have at least one WARNING
    error_count: int = 0      # rejected — have at least one ERROR
    errors: list[dict] = field(default_factory=list)  # ValidationIssue dicts

    # Per-record coerced objects (populated only if coerce=True)
    valid_records: list[dict] = field(default_factory=list)

    def summary(self) -> dict:
        return {
            "record_type": self.record_type,
            "total_records": self.total_records,
            "valid_count": self.valid_count,
            "warning_count": self.warning_count,
            "error_count": self.error_count,
            "error_detail_count": len(self.errors),
        }

    def add_issues(
        self, issues: list[ValidationIssue], row_index: int
    ) -> None:
        """Merge a row's issues into the report totals."""
        has_error = any(i.severity == Severity.ERROR for i in issues)
        has_warning = any(i.severity == Severity.WARNING for i in issues)

        if has_error:
            self.error_count += 1
        elif has_warning:
            self.warning_count += 1
        else:
            self.valid_count += 1

        for issue in issues:
            self.errors.append({**issue.to_dict(), "row": row_index})


# ── ValidationPipeline ────────────────────────────────────────────────────────


class ValidationPipeline:
    """Chains schema coercion and business-rule validators.

    Parameters
    ----------
    record_type:
        One of ``"inventory"``, ``"cold_chain"``, or ``"coverage"``.
    facility_stats:
        Optional pre-computed per-facility statistics for the OutlierDetector
        ``{facility_id: {"mean": float, "std": float}}``.
    facility_context:
        Optional per-facility context passed to each validator
        ``{facility_id: {"facility_registered_at": date, ...}}``.
    coerce:
        If True, rows are run through the Pydantic schema before rule
        validators.  Pydantic errors are converted to ERROR issues.
    """

    def __init__(
        self,
        record_type: str = "inventory",
        facility_stats: dict[str, dict[str, float]] | None = None,
        facility_context: dict[str, dict] | None = None,
        coerce: bool = True,
    ) -> None:
        if record_type not in _SCHEMA_MAP:
            raise ValueError(
                f"Unknown record_type '{record_type}'. "
                f"Must be one of: {list(_SCHEMA_MAP)}"
            )
        self._record_type = record_type
        self._schema = _SCHEMA_MAP[record_type]
        self._facility_context = facility_context or {}
        self._coerce = coerce

        # Instantiate stateful validators once (they carry batch-level state)
        self._duplicate_detector = DuplicateDetector()
        self._outlier_detector = OutlierDetector(stats=facility_stats)
        self._completeness_checker = CompletenessChecker(record_type=record_type)

        # Stateless validators (called per record)
        self._temp_validator = TemperatureRangeValidator()
        self._stock_validator = StockConsistencyValidator()
        self._date_validator = DateValidator()

    def _reset_stateful(self) -> None:
        """Reset per-batch state so the pipeline can be reused."""
        self._duplicate_detector.reset()
        self._outlier_detector._batch_values.clear()
        self._completeness_checker._seen.clear()

    def _get_context(self, record: dict) -> dict:
        facility_id = str(record.get("facility_id", ""))
        return self._facility_context.get(facility_id, {})

    # ── Single-record validation ───────────────────────────────────────────────

    def validate_record(
        self, record: dict, row: int | None = None
    ) -> list[ValidationIssue]:
        """Validate a single record dict.  Returns the list of issues found."""
        issues: list[ValidationIssue] = []
        context = self._get_context(record)

        # 1. Schema coercion via Pydantic
        coerced: dict = record
        if self._coerce:
            try:
                model_instance = self._schema(**record)
                coerced = model_instance.model_dump()
                # Check for rate mismatch annotation set by CoverageRecord validator
                rate_mismatch = getattr(model_instance, "_rate_mismatch", None)
                if rate_mismatch is not None:
                    declared = record.get("coverage_rate")
                    issues.append(
                        ValidationIssue(
                            row,
                            "coverage_rate",
                            f"Declared coverage_rate {declared}% does not match computed "
                            f"{rate_mismatch:.1f}% (doses_given / target_population × 100).",
                            Severity.WARNING,
                        )
                    )
            except ValidationError as exc:
                for err in exc.errors():
                    field_name = ".".join(str(loc) for loc in err["loc"])
                    issues.append(
                        ValidationIssue(
                            row,
                            field_name or None,
                            err["msg"],
                            Severity.ERROR,
                        )
                    )
                # Stop here — later validators rely on coerced values
                return issues

        # 2. Business rule validators
        self._date_validator.validate(coerced, issues, context, row)
        self._temp_validator.validate(coerced, issues, context, row)
        self._stock_validator.validate(coerced, issues, context, row)
        self._duplicate_detector.validate(coerced, issues, context, row)
        self._outlier_detector.validate(coerced, issues, context, row)
        self._completeness_checker.validate(coerced, issues, context, row)

        return issues

    # ── Batch validation ──────────────────────────────────────────────────────

    def validate_batch(
        self, records: list[dict[str, Any]], reset: bool = True
    ) -> ValidationReport:
        """Validate a list of record dicts.

        Parameters
        ----------
        records:
            Rows to validate.
        reset:
            Reset per-batch state (duplicate / outlier accumulators) before
            starting.  Set to False to continue accumulating across calls.
        """
        if reset:
            self._reset_stateful()

        report = ValidationReport(
            record_type=self._record_type,
            total_records=len(records),
        )

        # Pass 1 — accumulate outlier statistics from the batch
        for record in records:
            self._outlier_detector.accumulate(record)

        # Pass 2 — validate each record
        for idx, record in enumerate(records):
            issues = self.validate_record(record, row=idx)
            report.add_issues(issues, row_index=idx)

            # Keep coerced dicts for downstream use
            has_error = any(i.severity == Severity.ERROR for i in issues)
            if not has_error:
                coerced = record
                if self._coerce:
                    try:
                        coerced = self._schema(**record).model_dump()
                    except Exception:
                        pass
                report.valid_records.append(coerced)

        return report

    # ── CSV / Excel parsing ───────────────────────────────────────────────────

    def validate_csv(
        self, csv_content: str, reset: bool = True
    ) -> ValidationReport:
        """Parse CSV text and run batch validation.

        Accepts both comma-delimited and tab-delimited input (auto-detected).
        """
        # Detect delimiter
        sample = csv_content[:2048]
        delimiter = "\t" if sample.count("\t") > sample.count(",") else ","

        reader = csv.DictReader(io.StringIO(csv_content), delimiter=delimiter)
        rows = []
        for raw_row in reader:
            # Convert empty strings to None for optional fields
            rows.append({k: (v.strip() if v and v.strip() else None) for k, v in raw_row.items()})

        return self.validate_batch(rows, reset=reset)

    def validate_excel(
        self, file_bytes: bytes, sheet_name: str | None = None, reset: bool = True
    ) -> ValidationReport:
        """Parse Excel bytes (xlsx / xls) and run batch validation.

        Requires the ``openpyxl`` package (already a project dependency).
        """
        try:
            import openpyxl
        except ImportError as exc:
            raise RuntimeError("openpyxl is required for Excel validation.") from exc

        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        ws = wb[sheet_name] if sheet_name else wb.active

        rows_iter = ws.iter_rows(values_only=True)
        headers = [str(h).strip() if h is not None else f"col_{i}" for i, h in enumerate(next(rows_iter, []))]

        records = []
        for row in rows_iter:
            record = {}
            for header, cell in zip(headers, row):
                record[header] = cell if cell is not None else None
            records.append(record)

        wb.close()
        return self.validate_batch(records, reset=reset)
