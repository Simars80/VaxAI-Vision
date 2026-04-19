"""Business-rule validators for pilot data.

Each validator receives a record dict and a context dict, and appends
ValidationIssue objects to a shared list.  Validators are pure functions;
no database access is required so they can run both in the async API
handler and inside a Celery worker.

Validator interface
-------------------
    def validate(
        record: dict,
        issues: list[ValidationIssue],
        context: dict | None = None,
    ) -> None

The record is a plain dict so validators are schema-agnostic and can be
composed freely.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import date, datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# ── Severity / Issue types ────────────────────────────────────────────────────


class Severity:
    ERROR = "ERROR"    # Record must be rejected
    WARNING = "WARNING"  # Record accepted but flagged
    INFO = "INFO"      # Informational annotation


class ValidationIssue:
    """A single validation finding attached to a record."""

    __slots__ = ("row", "field", "message", "severity")

    def __init__(
        self,
        row: int | None,
        field: str | None,
        message: str,
        severity: str = Severity.ERROR,
    ) -> None:
        self.row = row
        self.field = field
        self.message = message
        self.severity = severity

    def to_dict(self) -> dict:
        return {
            "row": self.row,
            "field": self.field,
            "message": self.message,
            "severity": self.severity,
        }


# ── Vaccine temperature ranges (°C) ──────────────────────────────────────────
# Sources: WHO PQS, UNICEF cold chain guidelines, CDC vaccine storage guide.

VACCINE_TEMP_RANGES: dict[str, tuple[float, float]] = {
    # Standard refrigerated vaccines (2–8°C)
    "BCG":    (2.0, 8.0),
    "OPV":    (-25.0, -15.0),   # Oral polio — freeze-dried, stored frozen
    "OPV0":   (-25.0, -15.0),
    "OPV1":   (-25.0, -15.0),
    "OPV2":   (-25.0, -15.0),
    "OPV3":   (-25.0, -15.0),
    "IPV":    (2.0, 8.0),
    "IPV1":   (2.0, 8.0),
    "IPV2":   (2.0, 8.0),
    "DTP":    (2.0, 8.0),
    "DTP1":   (2.0, 8.0),
    "DTP2":   (2.0, 8.0),
    "DTP3":   (2.0, 8.0),
    "DTPCV":  (2.0, 8.0),
    "DTPCV1": (2.0, 8.0),
    "DTPCV2": (2.0, 8.0),
    "DTPCV3": (2.0, 8.0),
    "HepB":   (2.0, 8.0),
    "HepB0":  (2.0, 8.0),
    "HepB1":  (2.0, 8.0),
    "HepB2":  (2.0, 8.0),
    "HepB3":  (2.0, 8.0),
    "HiB":    (2.0, 8.0),
    "HiB1":   (2.0, 8.0),
    "HiB2":   (2.0, 8.0),
    "HiB3":   (2.0, 8.0),
    "MCV":    (2.0, 8.0),
    "MCV1":   (2.0, 8.0),
    "MCV2":   (2.0, 8.0),
    "RCV":    (2.0, 8.0),
    "RCV1":   (2.0, 8.0),
    "RCV2":   (2.0, 8.0),
    "YF":     (2.0, 8.0),
    "MenA":   (2.0, 8.0),
    "MenC":   (2.0, 8.0),
    "Rota":   (2.0, 8.0),
    "Rota1":  (2.0, 8.0),
    "Rota2":  (2.0, 8.0),
    "Rota3":  (2.0, 8.0),
    "PCV":    (2.0, 8.0),
    "PCV1":   (2.0, 8.0),
    "PCV2":   (2.0, 8.0),
    "PCV3":   (2.0, 8.0),
    "HPV":    (2.0, 8.0),
    "HPV1":   (2.0, 8.0),
    "HPV2":   (2.0, 8.0),
    "TT":     (2.0, 8.0),
    "TT1":    (2.0, 8.0),
    "TT2":    (2.0, 8.0),
    "TT3":    (2.0, 8.0),
    "TT4":    (2.0, 8.0),
    "TT5":    (2.0, 8.0),
    "Td":     (2.0, 8.0),
    "Typhoid": (2.0, 8.0),
    "Cholera": (2.0, 8.0),
    "JE":     (2.0, 8.0),
    "Rabies":  (2.0, 8.0),
    "Varicella": (2.0, 8.0),
    "MMR":    (2.0, 8.0),
    "MMRV":   (2.0, 8.0),
    # mRNA vaccines (ultra-cold or cold)
    "COVID19-mRNA":   (-25.0, -15.0),  # Moderna / Pfizer (standard cold)
    "COVID19-Vector": (2.0, 8.0),
    "COVID19-Protein": (2.0, 8.0),
    "COVID19":  (2.0, 8.0),           # Default if subtype unknown
    "RSV":    (2.0, 8.0),
    "Influenza":     (2.0, 8.0),
    "Influenza-H1N1": (2.0, 8.0),
}

# Default range for unknown vaccines
_DEFAULT_TEMP_RANGE = (2.0, 8.0)


# ── TemperatureRangeValidator ──────────────────────────────────────────────────


class TemperatureRangeValidator:
    """Checks that stored/transported temperature is within vaccine-specific limits.

    Works on both InventoryRecord dicts (field: storage_temp + vaccine_code)
    and ColdChainReadingRecord dicts (field: temperature — no vaccine context;
    falls back to the default 2–8°C refrigerator band in that case).
    """

    def validate(
        self,
        record: dict,
        issues: list[ValidationIssue],
        context: dict | None = None,
        row: int | None = None,
    ) -> None:
        # Determine the temperature field
        temp: float | None = record.get("temperature") or record.get("storage_temp")
        if temp is None:
            issues.append(
                ValidationIssue(row, "temperature", "Temperature field is missing.", Severity.ERROR)
            )
            return

        vaccine_code: str = (record.get("vaccine_code") or "").upper()
        min_t, max_t = VACCINE_TEMP_RANGES.get(vaccine_code, _DEFAULT_TEMP_RANGE)

        if temp < min_t:
            issues.append(
                ValidationIssue(
                    row,
                    "temperature",
                    f"Temperature {temp}°C is below minimum {min_t}°C "
                    f"for {vaccine_code or 'this vaccine'}.",
                    Severity.ERROR,
                )
            )
        elif temp > max_t:
            issues.append(
                ValidationIssue(
                    row,
                    "temperature",
                    f"Temperature {temp}°C exceeds maximum {max_t}°C "
                    f"for {vaccine_code or 'this vaccine'}.",
                    Severity.ERROR,
                )
            )


# ── StockConsistencyValidator ─────────────────────────────────────────────────


class StockConsistencyValidator:
    """Checks the accounting identity: opening + received − administered = closing.

    All four fields must be present; otherwise an INFO notice is generated.
    Tolerance of 1 dose is allowed for rounding.
    """

    _TOLERANCE = 1.0  # doses

    def validate(
        self,
        record: dict,
        issues: list[ValidationIssue],
        context: dict | None = None,
        row: int | None = None,
    ) -> None:
        opening = record.get("opening_stock")
        received = record.get("received")
        administered = record.get("administered")
        closing = record.get("closing_stock")

        if any(v is None for v in [opening, received, administered, closing]):
            issues.append(
                ValidationIssue(
                    row,
                    "stock",
                    "Stock consistency check skipped — one or more of "
                    "opening_stock / received / administered / closing_stock is absent.",
                    Severity.INFO,
                )
            )
            return

        expected_closing = opening + received - administered  # type: ignore[operator]
        diff = abs(closing - expected_closing)  # type: ignore[operator]
        if diff > self._TOLERANCE:
            issues.append(
                ValidationIssue(
                    row,
                    "closing_stock",
                    f"Stock imbalance: opening({opening}) + received({received}) "
                    f"- administered({administered}) = {expected_closing:.1f}, "
                    f"but closing_stock = {closing:.1f} (diff = {diff:.1f}).",
                    Severity.WARNING,
                )
            )


# ── DateValidator ─────────────────────────────────────────────────────────────


class DateValidator:
    """Validates date fields on records.

    Checks:
    1. No future dates for transaction / coverage dates (cannot report the future).
    2. No dates before facility_registered_at (records predate the facility).
    3. Expiry dates must be in the future (warn if already expired).
    """

    def validate(
        self,
        record: dict,
        issues: list[ValidationIssue],
        context: dict | None = None,
        row: int | None = None,
    ) -> None:
        context = context or {}
        today = datetime.now(timezone.utc).date()
        facility_registered: date | None = context.get("facility_registered_at")

        # Fields that must not be in the future
        for field_name in ("date", "timestamp"):
            raw = record.get(field_name)
            if raw is None:
                continue
            record_date = self._to_date(raw)
            if record_date is None:
                issues.append(
                    ValidationIssue(row, field_name, f"Cannot parse date: {raw!r}", Severity.ERROR)
                )
                continue
            if record_date > today:
                issues.append(
                    ValidationIssue(
                        row,
                        field_name,
                        f"{field_name} {record_date} is in the future (today is {today}).",
                        Severity.ERROR,
                    )
                )
            if facility_registered and record_date < facility_registered:
                issues.append(
                    ValidationIssue(
                        row,
                        field_name,
                        f"{field_name} {record_date} is before facility registration date "
                        f"{facility_registered}.",
                        Severity.WARNING,
                    )
                )

        # Expiry date — warn if already expired
        expiry_raw = record.get("expiry_date")
        if expiry_raw is not None:
            expiry = self._to_date(expiry_raw)
            if expiry is not None and expiry < today:
                issues.append(
                    ValidationIssue(
                        row,
                        "expiry_date",
                        f"Batch has expired on {expiry} (today is {today}). "
                        "Stock should be removed from usable inventory.",
                        Severity.WARNING,
                    )
                )

    @staticmethod
    def _to_date(value: Any) -> date | None:
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%dT%H:%M:%S"):
                try:
                    return datetime.strptime(value.strip(), fmt).date()
                except ValueError:
                    continue
        return None


# ── DuplicateDetector ─────────────────────────────────────────────────────────


class DuplicateDetector:
    """Detects exact and near-duplicate records within the current batch.

    Exact duplicate: all key fields are identical.
    Near-duplicate:  same facility + vaccine + date, quantity differs by ≤5%.
    """

    def __init__(self) -> None:
        self._exact_seen: set[str] = set()
        self._near_index: dict[str, list[dict]] = {}

    def reset(self) -> None:
        self._exact_seen.clear()
        self._near_index.clear()

    def _exact_key(self, record: dict) -> str:
        """Deterministic hash of all fields."""
        canonical = json.dumps(
            {k: str(v) for k, v in sorted(record.items())}, sort_keys=True
        )
        return hashlib.sha256(canonical.encode()).hexdigest()

    def _near_key(self, record: dict) -> str:
        """Key for near-dup grouping (facility + vaccine + date, ignoring quantity)."""
        parts = [
            str(record.get("facility_id", "")),
            str(record.get("vaccine_code", "")),
            str(record.get("date", record.get("timestamp", ""))),
            str(record.get("batch_number", "")),
        ]
        return "|".join(parts)

    def validate(
        self,
        record: dict,
        issues: list[ValidationIssue],
        context: dict | None = None,
        row: int | None = None,
    ) -> None:
        exact_key = self._exact_key(record)
        if exact_key in self._exact_seen:
            issues.append(
                ValidationIssue(
                    row,
                    None,
                    "Exact duplicate record detected in this batch.",
                    Severity.ERROR,
                )
            )
            return
        self._exact_seen.add(exact_key)

        near_key = self._near_key(record)
        prior_records = self._near_index.get(near_key, [])

        qty = record.get("quantity") or record.get("doses_given")
        for prior in prior_records:
            prior_qty = prior.get("quantity") or prior.get("doses_given")
            if qty is not None and prior_qty is not None and prior_qty != 0:
                pct_diff = abs(qty - prior_qty) / abs(prior_qty)
                if pct_diff <= 0.05:
                    issues.append(
                        ValidationIssue(
                            row,
                            "quantity",
                            f"Near-duplicate detected: same facility/vaccine/date with "
                            f"quantity {qty} vs {prior_qty} ({pct_diff:.1%} difference).",
                            Severity.WARNING,
                        )
                    )

        self._near_index.setdefault(near_key, []).append(record)


# ── OutlierDetector ───────────────────────────────────────────────────────────


class OutlierDetector:
    """Flags records whose numeric value is >3 standard deviations from the
    per-facility rolling mean.

    Must be initialised with historical statistics per facility before use.
    Alternatively, statistics can be derived from the batch itself (two-pass).
    """

    def __init__(self, stats: dict[str, dict[str, float]] | None = None) -> None:
        """
        Args:
            stats: Mapping of facility_id → {"mean": float, "std": float}
                   for the relevant numeric metric.  If None, per-batch stats
                   are accumulated and checked in a two-pass manner.
        """
        self._stats = stats or {}
        self._batch_values: dict[str, list[float]] = {}

    def _get_stats(self, facility_id: str) -> tuple[float | None, float | None]:
        if facility_id in self._stats:
            s = self._stats[facility_id]
            return s.get("mean"), s.get("std")
        # Fall back to batch-accumulated values
        values = self._batch_values.get(facility_id, [])
        if len(values) < 3:
            return None, None
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / len(values)
        std = variance ** 0.5
        return mean, std

    def accumulate(self, record: dict) -> None:
        """Accumulate values before validation pass (for batch mode)."""
        facility_id = str(record.get("facility_id", ""))
        value = record.get("quantity") or record.get("doses_given") or record.get("temperature")
        if facility_id and value is not None:
            self._batch_values.setdefault(facility_id, []).append(float(value))

    def validate(
        self,
        record: dict,
        issues: list[ValidationIssue],
        context: dict | None = None,
        row: int | None = None,
    ) -> None:
        facility_id = str(record.get("facility_id", ""))
        value = record.get("quantity") or record.get("doses_given") or record.get("temperature")
        if value is None:
            return

        mean, std = self._get_stats(facility_id)
        if mean is None or std is None or std == 0:
            return

        z_score = abs(float(value) - mean) / std
        if z_score > 3.0:
            issues.append(
                ValidationIssue(
                    row,
                    None,
                    f"Statistical outlier: value {value} is {z_score:.1f} std deviations "
                    f"from facility mean {mean:.1f} (std={std:.1f}).",
                    Severity.WARNING,
                )
            )


# ── CompletenessChecker ───────────────────────────────────────────────────────


class CompletenessChecker:
    """Tracks which (facility, date) combinations have data and flags gaps.

    Also checks that required fields within each record are non-null.
    """

    # Fields required for each record type
    REQUIRED_FIELDS: dict[str, list[str]] = {
        "inventory": ["facility_id", "vaccine_code", "batch_number", "quantity", "expiry_date"],
        "cold_chain": ["equipment_id", "facility_id", "temperature", "timestamp", "sensor_id"],
        "coverage": ["facility_id", "vaccine_code", "date", "doses_given", "target_population"],
    }

    def __init__(self, record_type: str = "inventory") -> None:
        self._record_type = record_type
        self._seen: set[tuple[str, str]] = set()  # (facility_id, date)
        self._required = self.REQUIRED_FIELDS.get(record_type, [])

    def validate(
        self,
        record: dict,
        issues: list[ValidationIssue],
        context: dict | None = None,
        row: int | None = None,
    ) -> None:
        # Check required fields
        for field_name in self._required:
            val = record.get(field_name)
            if val is None or (isinstance(val, str) and not val.strip()):
                issues.append(
                    ValidationIssue(
                        row,
                        field_name,
                        f"Required field '{field_name}' is missing or empty.",
                        Severity.ERROR,
                    )
                )

        # Track (facility, date) presence
        facility_id = str(record.get("facility_id", ""))
        record_date = str(
            record.get("date") or record.get("timestamp", "")
        )
        if facility_id and record_date:
            self._seen.add((facility_id, record_date[:10]))  # YYYY-MM-DD prefix

    def missing_facility_dates(
        self, expected: set[tuple[str, str]]
    ) -> set[tuple[str, str]]:
        """Return (facility_id, date) pairs that are in expected but not seen."""
        return expected - self._seen
