"""DHIS2 sync configuration and audit log models."""

import enum
import uuid

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SyncStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class DHIS2SyncConfig(Base):
    """Stores DHIS2 instance connection details and mapping config."""

    __tablename__ = "dhis2_sync_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    base_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    # Auth — only one of (username+password) or pat should be set
    auth_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    auth_password_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    auth_pat_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, default="XX")
    mapping_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class DHIS2SyncLog(Base):
    """Audit trail for each sync run."""

    __tablename__ = "dhis2_sync_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    config_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    status: Mapped[SyncStatus] = mapped_column(
        Enum(SyncStatus, name="dhis2_sync_status"),
        nullable=False,
        default=SyncStatus.pending,
    )
    sync_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="full"
    )  # full | incremental
    records_fetched: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    records_created: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    records_updated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    records_failed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    started_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
