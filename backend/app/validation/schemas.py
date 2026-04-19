"""Pydantic validation schemas for pilot data uploads.

Three record types are supported:
  - InventoryRecord       — vaccine stock snapshot
  - ColdChainReadingRecord — sensor temperature reading
  - CoverageRecord        — immunisation coverage report

All schemas enforce strict typing and domain-specific constraints.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, Field, field_validator, model_validator

# ── WHO/EPI vaccine code registry (subset) ────────────────────────────────────
# Full codes follow the WHO EPI code convention; add more as needed.
WHO_VACCINE_CODES: frozenset[str] = frozenset(
    {
        # Traditional EPI antigens
        "BCG",
        "OPV",
        "OPV0",
        "OPV1",
        "OPV2",
        "OPV3",
        "IPV",
        "IPV1",
        "IPV2",
        "DTP",
        "DTP1",
        "DTP2",
        "DTP3",
        "DTPCV",
        "DTPCV1",
        "DTPCV2",
        "DTPCV3",
        "HepB",
        "HepB0",
        "HepB1",
        "HepB2",
        "HepB3",
        "HiB",
        "HiB1",
        "HiB2",
        "HiB3",
        "MCV",
        "MCV1",
        "MCV2",
        "RCV",
        "RCV1",
        "RCV2",
        "YF",
        "MenA",
        "MenC",
        "Rota",
        "Rota1",
        "Rota2",
        "Rota3",
        "PCV",
        "PCV1",
        "PCV2",
        "PCV3",
        "HPV",
        "HPV1",
        "HPV2",
        "TT",
        "TT1",
        "TT2",
        "TT3",
        "TT4",
        "TT5",
        "Td",
        "Typhoid",
        "Cholera",
        "JE",
        "Rabies",
        "Varicella",
        "MMR",
        "MMRV",
        # mRNA / novel vaccines
        "COVID19",
        "COVID19-mRNA",
        "COVID19-Vector",
        "COVID19-Protein",
        "RSV",
        "Influenza",
        "Influenza-H1N1",
        # Placeholder for facility-specific custom codes
        "CUSTOM",
    }
)

# Valid batch number pattern: alphanumeric, hyphens, underscores, 1-64 chars
_BATCH_RE = re.compile(r"^[A-Za-z0-9\-_]{1,64}$")

# Valid sensor / equipment ID pattern
_SENSOR_RE = re.compile(r"^[A-Za-z0-9\-_\.]{1,128}$")


# ── InventoryRecord ───────────────────────────────────────────────────────────


class InventoryRecord(BaseModel):
    """Snapshot of vaccine stock held at a facility.

    Corresponds to a row in a facility inventory upload (CSV/Excel).
    """

    model_config = {"str_strip_whitespace": True}

    facility_id: Annotated[str, Field(min_length=1, max_length=255)]
    vaccine_code: Annotated[str, Field(min_length=1, max_length=64)]
    batch_number: Annotated[str, Field(min_length=1, max_length=64)]
    quantity: Annotated[float, Field(ge=0, description="Non-negative dose count")]
    expiry_date: date
    storage_temp: float = Field(
        description="Observed storage temperature in °C at time of record"
    )
    # Optional enrichment fields
    opening_stock: float | None = Field(default=None, ge=0)
    received: float | None = Field(default=None, ge=0)
    administered: float | None = Field(default=None, ge=0)
    closing_stock: float | None = Field(default=None, ge=0)

    @field_validator("vaccine_code")
    @classmethod
    def vaccine_code_must_be_valid(cls, v: str) -> str:
        code = v.upper()
        if code not in WHO_VACCINE_CODES:
            raise ValueError(
                f"'{v}' is not a recognised WHO/EPI vaccine code. "
                f"Use one of: {sorted(WHO_VACCINE_CODES)}"
            )
        return code

    @field_validator("batch_number")
    @classmethod
    def batch_number_format(cls, v: str) -> str:
        if not _BATCH_RE.match(v):
            raise ValueError(
                f"Batch number '{v}' must be 1-64 alphanumeric / hyphen / underscore chars."
            )
        return v.upper()

    @field_validator("expiry_date")
    @classmethod
    def expiry_date_in_future(cls, v: date) -> date:
        # Expiry must be a real date; we don't reject already-expired here —
        # that is a business rule handled in rules.py.
        return v


# ── ColdChainReadingRecord ────────────────────────────────────────────────────


class ColdChainReadingRecord(BaseModel):
    """A single sensor temperature reading for a cold-chain unit.

    Maps 1-to-1 with ColdChainReading DB model.
    """

    model_config = {"str_strip_whitespace": True}

    equipment_id: Annotated[str, Field(min_length=1, max_length=128)]
    facility_id: Annotated[str, Field(min_length=1, max_length=255)]
    temperature: float = Field(description="Temperature reading in °C")
    timestamp: datetime
    sensor_id: Annotated[str, Field(min_length=1, max_length=128)]

    @field_validator("equipment_id", "sensor_id")
    @classmethod
    def id_format(cls, v: str) -> str:
        if not _SENSOR_RE.match(v):
            raise ValueError(
                f"ID '{v}' must be 1-128 chars: alphanumeric, hyphen, underscore or dot."
            )
        return v

    @field_validator("temperature")
    @classmethod
    def temperature_plausible(cls, v: float) -> float:
        # Absolute sanity bounds — anything outside these is almost certainly a
        # sensor or data-entry error.
        if v < -100 or v > 100:
            raise ValueError(
                f"Temperature {v}°C is outside the plausible sensor range (-100 to 100°C)."
            )
        return v


# ── CoverageRecord ────────────────────────────────────────────────────────────


class CoverageRecord(BaseModel):
    """Immunisation coverage report for one facility / vaccine / date.

    Corresponds to rows uploaded from DHIS2 exports or manual facility reports.
    """

    model_config = {"str_strip_whitespace": True}

    facility_id: Annotated[str, Field(min_length=1, max_length=255)]
    vaccine_code: Annotated[str, Field(min_length=1, max_length=64)]
    date: date
    doses_given: Annotated[float, Field(ge=0, description="Number of doses administered")]
    target_population: Annotated[
        float, Field(gt=0, description="Target population denominator (must be > 0)")
    ]
    coverage_rate: Annotated[
        float, Field(ge=0, le=100, description="Coverage percentage (0–100)")
    ]

    @field_validator("vaccine_code")
    @classmethod
    def vaccine_code_must_be_valid(cls, v: str) -> str:
        code = v.upper()
        if code not in WHO_VACCINE_CODES:
            raise ValueError(
                f"'{v}' is not a recognised WHO/EPI vaccine code."
            )
        return code

    @model_validator(mode="after")
    def coverage_rate_consistent(self) -> "CoverageRecord":
        """Warn when declared rate differs substantially from computed rate."""
        if self.target_population and self.target_population > 0:
            computed = (self.doses_given / self.target_population) * 100
            # Allow 2% tolerance for rounding
            if abs(computed - self.coverage_rate) > 2.0:
                # We store the declared rate but attach a warning via field
                # The pipeline will pick this up and generate a WARNING issue.
                object.__setattr__(self, "_rate_mismatch", computed)
        return self
