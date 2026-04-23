"""Pydantic and SQLAlchemy models for vaccine logistics route management (DAG).

This module defines:
- Enums: NodeLevel, ColdChainType, TransportMode
- Pydantic models: LogisticsNode, LogisticsEdge, LogisticsDAG,
  DisruptionScenario, PropagationResult, AlternativeRoute
- SQLAlchemy ORM models: LogisticsNodeORM, LogisticsEdgeORM,
  LogisticsDagORM, DisruptionScenarioORM
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import (
    ARRAY,
    Boolean,
    DateTime,
    Double,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class NodeLevel(str, enum.Enum):
    NATIONAL = "national"
    REGIONAL = "regional"
    DISTRICT = "district"
    FACILITY = "facility"


class ColdChainType(str, enum.Enum):
    ACTIVE = "active"
    PASSIVE = "passive"
    NONE = "none"


class TransportMode(str, enum.Enum):
    TRUCK = "truck"
    MOTORBIKE = "motorbike"
    BOAT = "boat"
    AIR = "air"
    WALK = "walk"


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class LogisticsNode(BaseModel):
    """Supply chain node mapped from a DHIS2 organisation unit."""

    id: str = Field(description="UUID, internal")
    dhis2_org_unit_id: str = Field(description="DHIS2 OU identifier")
    name: str
    level: NodeLevel
    lat: float | None = None
    lng: float | None = None
    population_served: int | None = None
    cold_chain_type: ColdChainType = ColdChainType.PASSIVE
    cold_chain_capacity_litres: float | None = None
    is_active: bool = True
    stockout_frequency: float | None = Field(
        default=None, ge=0.0, le=1.0, description="Derived from DHIS2 (0–1)"
    )
    country_code: str = Field(min_length=2, max_length=2)


class LogisticsEdge(BaseModel):
    """Directed shipping route between two nodes."""

    id: str
    source_node_id: str
    target_node_id: str
    distance_km: float | None = None
    transit_time_hours: float = Field(default=24.0, ge=0.0)
    cold_chain_capacity_litres: float | None = None
    reliability_score: float = Field(default=0.85, ge=0.0, le=1.0)
    cost_per_unit_usd: float | None = None
    transport_mode: TransportMode = TransportMode.TRUCK
    is_active: bool = True
    country_code: str = Field(min_length=2, max_length=2)


class LogisticsDAG(BaseModel):
    """Container for the full vaccine supply chain graph."""

    id: str
    country_code: str = Field(min_length=2, max_length=2)
    nodes: list[LogisticsNode]
    edges: list[LogisticsEdge]
    generated_at: datetime
    dhis2_data_source_id: str
    version: int = 1

    def get_node(self, node_id: str) -> LogisticsNode | None:
        """Return a node by internal id, or None if not found."""
        for node in self.nodes:
            if node.id == node_id:
                return node
        return None

    def to_adjacency(self) -> dict[str, list[str]]:
        """Return {node_id: [child_node_ids]} for active edges only."""
        adj: dict[str, list[str]] = {n.id: [] for n in self.nodes}
        for edge in self.edges:
            if edge.is_active:
                adj.setdefault(edge.source_node_id, []).append(edge.target_node_id)
        return adj


class DisruptionScenario(BaseModel):
    """User-defined disruption for simulation."""

    id: str
    dag_id: str
    disrupted_node_ids: list[str] = Field(default_factory=list)
    disrupted_edge_ids: list[str] = Field(default_factory=list)
    label: str | None = None
    created_at: datetime


class AlternativeRoute(BaseModel):
    """A viable rerouting option for an affected facility."""

    from_node_id: str
    to_node_id: str
    via_node_ids: list[str] = Field(default_factory=list)
    additional_transit_hours: float
    population_protected: int
    feasibility_score: float = Field(ge=0.0, le=1.0)


class PropagationResult(BaseModel):
    """Output of the cascade failure algorithm."""

    scenario_id: str
    affected_node_ids: list[str]
    time_to_stockout_by_node: dict[str, float]
    population_impacted: int
    antigen_coverage_delta: float
    alternative_routes: list[AlternativeRoute]
    computed_at: datetime


# ---------------------------------------------------------------------------
# SQLAlchemy ORM models
# ---------------------------------------------------------------------------


class LogisticsDagORM(Base):
    """Stores one version of the logistics DAG per country."""

    __tablename__ = "logistics_dags"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    dhis2_data_source_id: Mapped[str] = mapped_column(String(64), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    nodes: Mapped[list[LogisticsNodeORM]] = relationship(
        "LogisticsNodeORM", back_populates="dag", cascade="all, delete-orphan"
    )
    edges: Mapped[list[LogisticsEdgeORM]] = relationship(
        "LogisticsEdgeORM", back_populates="dag", cascade="all, delete-orphan"
    )
    scenarios: Mapped[list[DisruptionScenarioORM]] = relationship(
        "DisruptionScenarioORM", back_populates="dag"
    )


class LogisticsNodeORM(Base):
    """Normalized storage for DAG nodes."""

    __tablename__ = "logistics_nodes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    dag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("logistics_dags.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dhis2_org_unit_id: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    level: Mapped[str] = mapped_column(
        SAEnum("national", "regional", "district", "facility", name="node_level"),
        nullable=False,
    )
    lat: Mapped[float | None] = mapped_column(Double, nullable=True)
    lng: Mapped[float | None] = mapped_column(Double, nullable=True)
    population_served: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cold_chain_type: Mapped[str] = mapped_column(
        SAEnum("active", "passive", "none", name="cold_chain_type"),
        nullable=False,
        default="passive",
    )
    cold_chain_capacity_litres: Mapped[float | None] = mapped_column(
        Double, nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    stockout_frequency: Mapped[float | None] = mapped_column(Double, nullable=True)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    dag: Mapped[LogisticsDagORM] = relationship(
        "LogisticsDagORM", back_populates="nodes"
    )


class LogisticsEdgeORM(Base):
    """Normalized storage for DAG edges."""

    __tablename__ = "logistics_edges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    dag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("logistics_dags.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("logistics_nodes.id"),
        nullable=False,
    )
    target_node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("logistics_nodes.id"),
        nullable=False,
    )
    distance_km: Mapped[float | None] = mapped_column(Double, nullable=True)
    transit_time_hours: Mapped[float] = mapped_column(
        Double, nullable=False, default=24.0
    )
    cold_chain_capacity_litres: Mapped[float | None] = mapped_column(
        Double, nullable=True
    )
    reliability_score: Mapped[float] = mapped_column(
        Double, nullable=False, default=0.85
    )
    cost_per_unit_usd: Mapped[float | None] = mapped_column(Double, nullable=True)
    transport_mode: Mapped[str] = mapped_column(
        SAEnum("truck", "motorbike", "boat", "air", "walk", name="transport_mode"),
        nullable=False,
        default="truck",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False)

    dag: Mapped[LogisticsDagORM] = relationship(
        "LogisticsDagORM", back_populates="edges"
    )


class DisruptionScenarioORM(Base):
    """User-defined disruption scenario with cached propagation result."""

    __tablename__ = "disruption_scenarios"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    dag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("logistics_dags.id"),
        nullable=False,
        index=True,
    )
    disrupted_node_ids: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    disrupted_edge_ids: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    label: Mapped[str | None] = mapped_column(Text, nullable=True)
    propagation_result: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True
    )
    narrative: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    dag: Mapped[LogisticsDagORM] = relationship(
        "LogisticsDagORM", back_populates="scenarios"
    )
