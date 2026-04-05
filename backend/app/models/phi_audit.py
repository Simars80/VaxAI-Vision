"""HIPAA PHI access audit log — immutable record of every PHI read/write."""
import uuid

from sqlalchemy import DateTime, Index, String, Text, func
from sqlalchemy.dialects.postgresql import INET, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PhiAccessLog(Base):
    """Immutable audit trail for Protected Health Information access.

    HIPAA § 164.312(b) — Technical Safeguard: Audit Controls
    Every read or write of PHI must be logged here. Records must never be
    deleted or modified; archival is handled at the database/storage layer.
    """

    __tablename__ = "phi_access_logs"
    __table_args__ = (
        # Fast look-up by user and time window (HIPAA audit queries)
        Index("ix_phi_access_user_time", "user_id", "accessed_at"),
        # Look-up by resource for incident response
        Index("ix_phi_access_resource", "resource_type", "resource_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Who accessed PHI (NULL allowed for system/service-account access)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_role: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # What was accessed
    resource_type: Mapped[str] = mapped_column(
        String(64), nullable=False
    )  # e.g. "Patient", "SupplyTransaction"
    resource_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # HTTP method / action: GET, POST, PATCH, DELETE, EXPORT
    action: Mapped[str] = mapped_column(String(16), nullable=False)
    # API route that was called
    endpoint: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Network context
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Outcome: "success" | "denied" | "error"
    outcome: Mapped[str] = mapped_column(String(16), nullable=False, default="success")
    http_status: Mapped[int | None] = mapped_column(nullable=True)

    accessed_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
