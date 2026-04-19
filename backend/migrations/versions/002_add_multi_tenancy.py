"""Add multi-tenancy: countries, organizations, districts, facilities tables
and tenant columns on users.

Revision ID: 002
Revises: 001
Create Date: 2026-04-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── ENUM types ─────────────────────────────────────────────────────────────

    org_type = postgresql.ENUM(
        "government", "ngo", "donor", "provider",
        name="org_type",
        create_type=True,
    )
    org_type.create(op.get_bind(), checkfirst=True)

    facility_type = postgresql.ENUM(
        "hospital", "health_center", "dispensary", "warehouse",
        name="facility_type",
        create_type=True,
    )
    facility_type.create(op.get_bind(), checkfirst=True)

    # ── New UserRole values ───────────────────────────────────────────────────
    # Add new enum values to existing user_role type
    # PostgreSQL requires ALTER TYPE ... ADD VALUE outside a transaction block,
    # so we use op.execute with a conditional check pattern.
    conn = op.get_bind()
    existing_roles = [
        row[0]
        for row in conn.execute(
            sa.text(
                "SELECT enumlabel FROM pg_enum e "
                "JOIN pg_type t ON e.enumtypid = t.oid "
                "WHERE t.typname = 'user_role'"
            )
        ).fetchall()
    ]

    new_roles = ["platform_admin", "national_admin", "district_manager", "facility_manager"]
    for role in new_roles:
        if role not in existing_roles:
            # Must run outside transaction; use COMMIT trick via raw execute
            conn.execute(sa.text(f"ALTER TYPE user_role ADD VALUE IF NOT EXISTS '{role}'"))

    # ── countries ──────────────────────────────────────────────────────────────
    op.create_table(
        "countries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("iso_code", sa.String(2), nullable=False, unique=True),
        sa.Column("timezone", sa.String(64), nullable=True),
        sa.Column("default_language", sa.String(8), nullable=True),
        sa.Column("dhis2_instance_url", sa.String(1024), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_countries_iso_code", "countries", ["iso_code"], unique=True)

    # ── organizations ──────────────────────────────────────────────────────────
    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column(
            "country_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("countries.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "org_type",
            org_type,
            nullable=False,
            server_default="government",
        ),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_organizations_country_id", "organizations", ["country_id"])

    # ── districts ──────────────────────────────────────────────────────────────
    op.create_table(
        "districts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "country_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("countries.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("region", sa.String(255), nullable=True),
        sa.Column("population", sa.Integer, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_districts_country_id", "districts", ["country_id"])

    # ── facilities ─────────────────────────────────────────────────────────────
    op.create_table(
        "facilities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column("facility_code", sa.String(128), nullable=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "country_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("countries.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "district_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("districts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("district", sa.String(255), nullable=True),
        sa.Column("region", sa.String(255), nullable=True),
        sa.Column("latitude", sa.Float, nullable=True),
        sa.Column("longitude", sa.Float, nullable=True),
        sa.Column(
            "facility_type",
            facility_type,
            nullable=False,
            server_default="health_center",
        ),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_facilities_country_id", "facilities", ["country_id"])
    op.create_index("ix_facilities_organization_id", "facilities", ["organization_id"])
    op.create_index("ix_facilities_district_id", "facilities", ["district_id"])
    op.create_index("ix_facilities_facility_code", "facilities", ["facility_code"])

    # ── Add tenant columns to users ────────────────────────────────────────────
    op.add_column(
        "users",
        sa.Column(
            "country_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("countries.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "facility_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("facilities.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_users_country_id", "users", ["country_id"])
    op.create_index("ix_users_organization_id", "users", ["organization_id"])
    op.create_index("ix_users_facility_id", "users", ["facility_id"])


def downgrade() -> None:
    # Remove indexes and columns from users
    op.drop_index("ix_users_facility_id", table_name="users")
    op.drop_index("ix_users_organization_id", table_name="users")
    op.drop_index("ix_users_country_id", table_name="users")
    op.drop_column("users", "facility_id")
    op.drop_column("users", "organization_id")
    op.drop_column("users", "country_id")

    # Drop tenant tables (order matters for FK constraints)
    op.drop_index("ix_facilities_facility_code", table_name="facilities")
    op.drop_index("ix_facilities_district_id", table_name="facilities")
    op.drop_index("ix_facilities_organization_id", table_name="facilities")
    op.drop_index("ix_facilities_country_id", table_name="facilities")
    op.drop_table("facilities")

    op.drop_index("ix_districts_country_id", table_name="districts")
    op.drop_table("districts")

    op.drop_index("ix_organizations_country_id", table_name="organizations")
    op.drop_table("organizations")

    op.drop_index("ix_countries_iso_code", table_name="countries")
    op.drop_table("countries")

    sa.Enum(name="facility_type").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="org_type").drop(op.get_bind(), checkfirst=True)

    # Note: removing enum values from user_role is not straightforward in PostgreSQL;
    # the added values (platform_admin, national_admin, district_manager, facility_manager)
    # will remain in the enum type. This is acceptable for downgrade scenarios.
