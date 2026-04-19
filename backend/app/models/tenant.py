"""Multi-tenant domain models: Country, Organization, District, Facility."""

from __future__ import annotations

import enum
import uuid

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ── Enums ──────────────────────────────────────────────────────────────────────


class OrgType(str, enum.Enum):
    government = "government"
    ngo = "ngo"
    donor = "donor"
    provider = "provider"


class FacilityType(str, enum.Enum):
    hospital = "hospital"
    health_center = "health_center"
    dispensary = "dispensary"
    warehouse = "warehouse"


# ── Models ─────────────────────────────────────────────────────────────────────


class Country(Base):
    """Top-level tenant: a sovereign country operating VaxAI Vision."""

    __tablename__ = "countries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # ISO 3166-1 alpha-2 (e.g. "KE", "TZ", "GH")
    iso_code: Mapped[str] = mapped_column(String(2), nullable=False, unique=True, index=True)
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    default_language: Mapped[str | None] = mapped_column(String(8), nullable=True)
    dhis2_instance_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    organizations: Mapped[list["Organization"]] = relationship(
        "Organization", back_populates="country", lazy="select"
    )
    districts: Mapped[list["District"]] = relationship(
        "District", back_populates="country", lazy="select"
    )
    facilities: Mapped[list["Facility"]] = relationship(
        "Facility", back_populates="country", lazy="select"
    )


class Organization(Base):
    """A national or sub-national health organization (government body, NGO, donor, provider)."""

    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    country_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("countries.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    org_type: Mapped[OrgType] = mapped_column(
        Enum(OrgType, name="org_type"), nullable=False, default=OrgType.government
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    country: Mapped["Country"] = relationship("Country", back_populates="organizations")
    facilities: Mapped[list["Facility"]] = relationship(
        "Facility", back_populates="organization", lazy="select"
    )


class District(Base):
    """Administrative district within a country — the mid-tier tenant scope."""

    __tablename__ = "districts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("countries.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    region: Mapped[str | None] = mapped_column(String(255), nullable=True)
    population: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    country: Mapped["Country"] = relationship("Country", back_populates="districts")
    facilities: Mapped[list["Facility"]] = relationship(
        "Facility", back_populates="district_rel", lazy="select"
    )


class Facility(Base):
    """A physical health facility (hospital, clinic, warehouse) — the leaf tenant scope."""

    __tablename__ = "facilities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    # Human-readable code (e.g. DHIS2 UID or national facility code)
    facility_code: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    country_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("countries.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    district_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("districts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Geographic / administrative metadata
    district: Mapped[str | None] = mapped_column(String(255), nullable=True)
    region: Mapped[str | None] = mapped_column(String(255), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    facility_type: Mapped[FacilityType] = mapped_column(
        Enum(FacilityType, name="facility_type"), nullable=False, default=FacilityType.health_center
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    country: Mapped["Country"] = relationship("Country", back_populates="facilities")
    organization: Mapped["Organization"] = relationship("Organization", back_populates="facilities")
    district_rel: Mapped["District | None"] = relationship("District", back_populates="facilities")
