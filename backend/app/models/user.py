import enum
import uuid

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserRole(str, enum.Enum):
    # Platform-level (no tenant assignment required)
    platform_admin = "platform_admin"
    # Legacy alias — existing 'admin' rows remain valid; treated as platform_admin
    admin = "admin"
    # Country-scoped
    national_admin = "national_admin"
    # District-scoped
    district_manager = "district_manager"
    # Facility-scoped
    facility_manager = "facility_manager"
    # Functional roles (facility-scoped or unrestricted depending on assignment)
    clinician = "clinician"
    analyst = "analyst"
    viewer = "viewer"


# Ordered hierarchy — lower index = more privilege
ROLE_HIERARCHY: list[UserRole] = [
    UserRole.platform_admin,
    UserRole.admin,
    UserRole.national_admin,
    UserRole.district_manager,
    UserRole.facility_manager,
    UserRole.clinician,
    UserRole.analyst,
    UserRole.viewer,
]


def role_level(role: UserRole) -> int:
    """Lower number = higher privilege. Returns len(ROLE_HIERARCHY) for unknown roles."""
    try:
        return ROLE_HIERARCHY.index(role)
    except ValueError:
        return len(ROLE_HIERARCHY)


def has_at_least_role(user_role: UserRole, minimum_role: UserRole) -> bool:
    """Return True if user_role is at least as privileged as minimum_role."""
    return role_level(user_role) <= role_level(minimum_role)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), nullable=False, default=UserRole.viewer
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Legacy ISO-2 country shorthand (kept for backward compatibility)
    country_code: Mapped[str | None] = mapped_column(String(2), nullable=True)

    # ── Tenant assignment (all nullable — NULL = platform-level / no restriction) ──
    country_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("countries.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    facility_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("facilities.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
