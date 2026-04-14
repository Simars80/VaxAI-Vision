"""Add scan_sessions and scan_detections tables for AR stock counter.

Revision ID: 001
Revises: None
Create Date: 2026-04-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    session_status = postgresql.ENUM(
        "draft", "active", "reconciling", "complete", "cancelled",
        name="session_status",
        create_type=True,
    )
    session_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "scan_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("facility_id", sa.String(255), nullable=False, index=True),
        sa.Column("facility_name", sa.String(512), nullable=True),
        sa.Column(
            "status",
            session_status,
            nullable=False,
            server_default="draft",
        ),
        sa.Column("operator_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("frame_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("product_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reconciliation_summary", postgresql.JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "scan_detections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("scan_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("frame_index", sa.Integer, nullable=False),
        sa.Column("product_code", sa.String(128), nullable=False, index=True),
        sa.Column("product_name", sa.String(512), nullable=True),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="1"),
        sa.Column("confidence", sa.Float, nullable=False, server_default="0"),
        sa.Column("bounding_box", postgresql.JSONB, nullable=True),
        sa.Column("extra", postgresql.JSONB, nullable=True),
        sa.Column(
            "detected_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("scan_detections")
    op.drop_table("scan_sessions")
    sa.Enum(name="session_status").drop(op.get_bind(), checkfirst=True)
