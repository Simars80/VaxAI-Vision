"""PHI data classification catalogue for VaxAI Vision.

Defines which model fields contain Protected Health Information (PHI) under
HIPAA's 18 identifiers (§ 164.514).  Used by:
  - PHI access middleware (to decide when to emit audit log entries)
  - Data export / de-identification utilities
  - Code review / schema review tooling
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class PhiField:
    model: str  # SQLAlchemy model class name
    column: str  # Column name
    identifier: str  # HIPAA identifier category
    notes: str = ""


# ---------------------------------------------------------------------------
# Catalogue of PHI fields across the VaxAI Vision data model
# ---------------------------------------------------------------------------
PHI_FIELDS: tuple[PhiField, ...] = (
    # ── PatientCensus ──────────────────────────────────────────────────────
    PhiField(
        "PatientCensus",
        "fhir_patient_id",
        "unique_identifier",
        "Direct patient identifier from the EHR system",
    ),
    PhiField(
        "PatientCensus",
        "age_years",
        "age",
        "HIPAA identifier when combined with geography or condition",
    ),
    PhiField(
        "PatientCensus",
        "gender",
        "demographic",
        "Low sensitivity individually; PHI in combination",
    ),
    PhiField(
        "PatientCensus",
        "country_code",
        "geographic_subdivision",
        "Country-level geography; phi when combined with age/condition",
    ),
    PhiField(
        "PatientCensus",
        "extra",
        "other_identifier",
        "Raw FHIR resource may contain names, dates, addresses",
    ),
    # ── SupplyTransaction ──────────────────────────────────────────────────
    PhiField(
        "SupplyTransaction",
        "facility_id",
        "geographic_subdivision",
        "Facility identifier can be used to infer patient population",
    ),
    PhiField(
        "SupplyTransaction",
        "lot_number",
        "device_identifier",
        "Lot numbers can link back to individual patient records",
    ),
    PhiField(
        "SupplyTransaction",
        "fhir_resource_id",
        "unique_identifier",
        "Direct reference to an EHR resource",
    ),
)

# Set of model names that own at least one PHI field — used by middleware
PHI_RESOURCE_TYPES: frozenset[str] = frozenset(f.model for f in PHI_FIELDS)

# Mapping: resource_type → set of phi column names
PHI_COLUMNS_BY_MODEL: dict[str, set[str]] = {}
for _f in PHI_FIELDS:
    PHI_COLUMNS_BY_MODEL.setdefault(_f.model, set()).add(_f.column)
