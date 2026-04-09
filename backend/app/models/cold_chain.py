"""Cold chain monitoring domain models."""

import enum
import uuid

from sqlalchemy import Boolean, DateTime, Enum, Float, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AlertType(str, enum.Enum):
    high = "high"
    low = "low"


class AlertSeverity(str, enum.Enum):
    warning = "warning"
    critical = "critical"


class ReadingStatus(str, enum.Enum):
    normal = "normal"
    warning = "warning"
    breach = "breach"


class ColdChainFacility(Base):
    """Monitored cold storage units."""

    __tablename__ = "cold_chain_facilities"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country: Mapped[str] = mapped_column(String(128), nullable=False)
    min_temp_c: Mapped[float] = mapped_column(Float, nullable=False, default=2.0)
    max_temp_c: Mapped[float] = mapped_column(Float, nullable=False, default=8.0)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ColdChainReading(Base):
    """Time-series sensor temperature readings."""

    __tablename__ = "cold_chain_readings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    facility_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    sensor_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    timestamp: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    temp_celsius: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[ReadingStatus] = mapped_column(
        Enum(ReadingStatus, name="reading_status"),
        nullable=False,
        default=ReadingStatus.normal,
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ColdChainAlert(Base):
    """Temperature breach alert events."""

    __tablename__ = "cold_chain_alerts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    facility_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    sensor_id: Mapped[str] = mapped_column(String(64), nullable=False)
    alert_type: Mapped[AlertType] = mapped_column(
        Enum(AlertType, name="alert_type"),
        nullable=False,
    )
    peak_temp_celsius: Mapped[float] = mapped_column(Float, nullable=False)
    threshold_celsius: Mapped[float] = mapped_column(Float, nullable=False)
    start_time: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    end_time: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    severity: Mapped[AlertSeverity] = mapped_column(
        Enum(AlertSeverity, name="alert_severity"),
        nullable=False,
        default=AlertSeverity.warning,
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
