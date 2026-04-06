"""Pydantic schemas for the ingestion pipeline."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.ingestion import IngestionSource, IngestionStatus


# ── Ingestion Job ──────────────────────────────────────────────────────────────


class IngestionJobResponse(BaseModel):
    id: uuid.UUID
    source: IngestionSource
    status: IngestionStatus
    file_name: str | None = None
    fhir_base_url: str | None = None
    celery_task_id: str | None = None
    rows_total: int | None = None
    rows_succeeded: int | None = None
    rows_failed: int | None = None
    error_summary: str | None = None
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


# ── CSV / Excel Upload ─────────────────────────────────────────────────────────


class CSVColumnMapping(BaseModel):
    """Optional column-name overrides so clients can map non-standard CSV headers."""

    item_code: str = "item_code"
    item_name: str = "item_name"
    category: str = "category"
    unit_of_measure: str = "unit_of_measure"
    transaction_type: str = "transaction_type"
    quantity: str = "quantity"
    facility_id: str = "facility_id"
    facility_name: str = "facility_name"
    transaction_date: str = "transaction_date"
    lot_number: str = "lot_number"
    expiry_date: str = "expiry_date"


class CSVUploadRequest(BaseModel):
    """Metadata sent alongside the multipart file upload."""

    column_mapping: CSVColumnMapping = Field(default_factory=CSVColumnMapping)


# ── FHIR Connector ─────────────────────────────────────────────────────────────


class FHIRConnectorRequest(BaseModel):
    """Parameters for triggering a FHIR R4 pull job."""

    fhir_base_url: str = Field(
        ...,
        description="Base URL of the FHIR R4 server, e.g. https://ehr.example.com/fhir/R4",
    )
    bearer_token: str | None = Field(
        default=None,
        description="Optional Bearer token for SMART-on-FHIR / OAuth2 auth",
    )
    # Which resource types to pull
    fetch_patients: bool = True
    fetch_supply_deliveries: bool = True
    # Incremental pull — only fetch resources updated after this timestamp
    updated_after: datetime | None = None
    # Max resources to pull per resource type (safety limit)
    max_resources: int = Field(default=500, ge=1, le=5000)


# ── Audit Log ─────────────────────────────────────────────────────────────────


class AuditLogEntry(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    row_index: int | None = None
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    detail: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
