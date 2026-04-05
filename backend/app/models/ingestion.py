"""Models for ingestion jobs and audit logs."""
import enum
import uuid

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class IngestionSource(str, enum.Enum):
    csv = "csv"
    excel = "excel"
    fhir_r4 = "fhir_r4"


class IngestionStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    partial = "partial"


class IngestionJob(Base):
    """Tracks each ingestion job submitted via CSV/Excel upload or EHR connector."""

    __tablename__ = "ingestion_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    source: Mapped[IngestionSource] = mapped_column(
        Enum(IngestionSource, name="ingestion_source"), nullable=False
    )
    status: Mapped[IngestionStatus] = mapped_column(
        Enum(IngestionStatus, name="ingestion_status"),
        nullable=False,
        default=IngestionStatus.pending,
    )
    # For CSV/Excel uploads: original filename
    file_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # For FHIR: base URL of the FHIR server
    fhir_base_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    # Celery task ID for status polling
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Row counts
    rows_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rows_succeeded: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rows_failed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Error summary (if any)
    error_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Who triggered this job
    triggered_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class IngestionAuditLog(Base):
    """Row-level audit trail for every ingestion operation."""

    __tablename__ = "ingestion_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    row_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # "inserted", "updated", "skipped", "error"
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    detail: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
