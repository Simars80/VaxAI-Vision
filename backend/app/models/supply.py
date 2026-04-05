"""Normalized supply chain domain models."""
import enum
import uuid

from sqlalchemy import DateTime, Enum, Float, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SupplyCategory(str, enum.Enum):
    vaccine = "vaccine"
    cold_chain = "cold_chain"
    consumable = "consumable"
    equipment = "equipment"
    other = "other"


class SupplyItem(Base):
    """Master catalogue of supply items (vaccines, consumables, equipment)."""

    __tablename__ = "supply_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # External/EHR reference code (e.g. NDC, GTIN, internal code)
    external_code: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[SupplyCategory] = mapped_column(
        Enum(SupplyCategory, name="supply_category"),
        nullable=False,
        default=SupplyCategory.other,
    )
    unit_of_measure: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Cold-chain specifics
    min_temp_celsius: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_temp_celsius: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Source metadata
    source_job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    extra: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SupplyTransaction(Base):
    """Records each stock movement: receipt, issue, adjustment, wastage."""

    __tablename__ = "supply_transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    supply_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    transaction_type: Mapped[str] = mapped_column(
        String(32), nullable=False
    )  # receipt | issue | adjustment | wastage
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit_of_measure: Mapped[str | None] = mapped_column(String(64), nullable=True)
    facility_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    facility_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    transaction_date: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    lot_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    expiry_date: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Raw FHIR resource ID when populated from EHR
    fhir_resource_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extra: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PatientCensus(Base):
    """Patient population snapshot ingested from FHIR (read-only import)."""

    __tablename__ = "patient_census"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    fhir_patient_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    facility_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    age_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # ISO 3166-1 alpha-2 country code
    country_code: Mapped[str | None] = mapped_column(String(2), nullable=True)
    census_date: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    extra: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
