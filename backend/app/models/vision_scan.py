"""Vision scan result persistence model."""

import enum
import uuid

from sqlalchemy import DateTime, Enum, Float, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class VVMStageDB(str, enum.Enum):
    stage_1 = "stage_1"
    stage_2 = "stage_2"
    stage_3 = "stage_3"
    stage_4 = "stage_4"


class VisionScanResult(Base):
    __tablename__ = "vision_scan_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    facility_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    image_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    classification: Mapped[VVMStageDB] = mapped_column(
        Enum(VVMStageDB, name="vvm_stage"), nullable=False
    )
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    scan_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="vvm", server_default="vvm"
    )
    scanned_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
