"""Coverage map domain models — facility-level immunization coverage metrics."""

from __future__ import annotations

import uuid

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CoverageFacility(Base):
    """Facility-level immunization coverage record for the coverage map."""

    __tablename__ = "coverage_facilities"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    country: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    region: Mapped[str] = mapped_column(String(256), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    coverage_rate: Mapped[float] = mapped_column(Float, nullable=False)
    stock_status: Mapped[str] = mapped_column(
        String(16), nullable=False
    )  # adequate | low | critical
    vaccine_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    period: Mapped[str] = mapped_column(String(16), nullable=False)
    doses_administered: Mapped[int] = mapped_column(Integer, nullable=False)
    target_population: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
