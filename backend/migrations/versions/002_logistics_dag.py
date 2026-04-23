"""Add logistics DAG tables: logistics_dags, logistics_nodes, logistics_edges, disruption_scenarios.

Revision ID: 002
Revises: 001
Create Date: 2026-04-23

Non-destructive: all new tables and indexes, no existing schema changes.
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
    # -- Enums ---------------------------------------------------------------
    node_level = postgresql.ENUM(
        "national", "regional", "district", "facility",
        name="node_level",
        create_type=True,
    )
    node_level.create(op.get_bind(), checkfirst=True)

    cold_chain_type = postgresql.ENUM(
        "active", "passive", "none",
        name="cold_chain_type",
        create_type=True,
    )
    cold_chain_type.create(op.get_bind(), checkfirst=True)

    transport_mode = postgresql.ENUM(
        "truck", "motorbike", "boat", "air", "walk",
        name="transport_mode",
        create_type=True,
    )
    transport_mode.create(op.get_bind(), checkfirst=True)

    # -- logistics_dags ------------------------------------------------------
    op.create_table(
        "logistics_dags",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("dhis2_data_source_id", sa.String(64), nullable=False),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("is_current", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "idx_logistics_dags_country_current",
        "logistics_dags",
        ["country_code", "is_current"],
    )

    # -- logistics_nodes -----------------------------------------------------
    op.create_table(
        "logistics_nodes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column(
            "dag_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("logistics_dags.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("dhis2_org_unit_id", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column(
            "level",
            node_level,
            nullable=False,
        ),
        sa.Column("lat", sa.Double, nullable=True),
        sa.Column("lng", sa.Double, nullable=True),
        sa.Column("population_served", sa.Integer, nullable=True),
        sa.Column(
            "cold_chain_type",
            cold_chain_type,
            nullable=False,
            server_default="passive",
        ),
        sa.Column("cold_chain_capacity_litres", sa.Double, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("stockout_frequency", sa.Double, nullable=True),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("idx_logistics_nodes_dag", "logistics_nodes", ["dag_id"])

    # -- logistics_edges -----------------------------------------------------
    op.create_table(
        "logistics_edges",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column(
            "dag_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("logistics_dags.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "source_node_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("logistics_nodes.id"),
            nullable=False,
        ),
        sa.Column(
            "target_node_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("logistics_nodes.id"),
            nullable=False,
        ),
        sa.Column("distance_km", sa.Double, nullable=True),
        sa.Column(
            "transit_time_hours", sa.Double, nullable=False, server_default="24.0"
        ),
        sa.Column("cold_chain_capacity_litres", sa.Double, nullable=True),
        sa.Column(
            "reliability_score", sa.Double, nullable=False, server_default="0.85"
        ),
        sa.Column("cost_per_unit_usd", sa.Double, nullable=True),
        sa.Column(
            "transport_mode",
            transport_mode,
            nullable=False,
            server_default="truck",
        ),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("country_code", sa.String(2), nullable=False),
    )
    op.create_index("idx_logistics_edges_dag", "logistics_edges", ["dag_id"])

    # -- disruption_scenarios ------------------------------------------------
    op.create_table(
        "disruption_scenarios",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column(
            "dag_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("logistics_dags.id"),
            nullable=False,
        ),
        sa.Column(
            "disrupted_node_ids",
            postgresql.JSONB,
            nullable=False,
            server_default="'[]'::jsonb",
        ),
        sa.Column(
            "disrupted_edge_ids",
            postgresql.JSONB,
            nullable=False,
            server_default="'[]'::jsonb",
        ),
        sa.Column("label", sa.Text, nullable=True),
        sa.Column("propagation_result", postgresql.JSONB, nullable=True),
        sa.Column("narrative", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "idx_disruption_scenarios_dag", "disruption_scenarios", ["dag_id"]
    )


def downgrade() -> None:
    op.drop_index("idx_disruption_scenarios_dag", table_name="disruption_scenarios")
    op.drop_table("disruption_scenarios")

    op.drop_index("idx_logistics_edges_dag", table_name="logistics_edges")
    op.drop_table("logistics_edges")

    op.drop_index("idx_logistics_nodes_dag", table_name="logistics_nodes")
    op.drop_table("logistics_nodes")

    op.drop_index("idx_logistics_dags_country_current", table_name="logistics_dags")
    op.drop_table("logistics_dags")

    op.execute("DROP TYPE IF EXISTS transport_mode")
    op.execute("DROP TYPE IF EXISTS cold_chain_type")
    op.execute("DROP TYPE IF EXISTS node_level")
