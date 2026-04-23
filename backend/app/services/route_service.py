"""Route management service — DB operations for DAG, scenarios, and propagation.

Keeps all SQL/ORM logic out of FastAPI route handlers.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.logistics import (
    AlternativeRoute,
    DisruptionScenario,
    DisruptionScenarioORM,
    LogisticsDAG,
    LogisticsDagORM,
    LogisticsEdge,
    LogisticsEdgeORM,
    LogisticsNode,
    LogisticsNodeORM,
    PropagationResult,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# DAG loading
# ---------------------------------------------------------------------------


async def get_active_dag(country_code: str, db: AsyncSession) -> LogisticsDAG:
    """Fetch the most recent active DAG for a country from the database.

    Args:
        country_code: ISO 3166-1 alpha-2 code (e.g. ``"SL"``).
        db: SQLAlchemy async session.

    Returns:
        Fully hydrated :class:`LogisticsDAG` Pydantic model.

    Raises:
        HTTPException 404: If no active DAG exists for ``country_code``.
    """
    dag_result = await db.execute(
        select(LogisticsDagORM)
        .where(
            LogisticsDagORM.country_code == country_code.upper(),
            LogisticsDagORM.is_current.is_(True),
        )
        .order_by(LogisticsDagORM.version.desc())
        .limit(1)
    )
    dag_orm = dag_result.scalar_one_or_none()
    if dag_orm is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active DAG found for country_code={country_code!r}.",
        )
    return await _hydrate_dag(dag_orm, db)


async def get_dag_by_id(dag_id: uuid.UUID, db: AsyncSession) -> LogisticsDAG:
    """Fetch a specific DAG by its primary key.

    Args:
        dag_id: UUID of the DAG.
        db: SQLAlchemy async session.

    Returns:
        Fully hydrated :class:`LogisticsDAG` Pydantic model.

    Raises:
        HTTPException 404: If the DAG does not exist.
    """
    dag_result = await db.execute(
        select(LogisticsDagORM).where(LogisticsDagORM.id == dag_id)
    )
    dag_orm = dag_result.scalar_one_or_none()
    if dag_orm is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"DAG {dag_id} not found.",
        )
    return await _hydrate_dag(dag_orm, db)


async def _hydrate_dag(dag_orm: LogisticsDagORM, db: AsyncSession) -> LogisticsDAG:
    """Load nodes and edges for a DAG ORM row and return a Pydantic model."""
    nodes_result = await db.execute(
        select(LogisticsNodeORM).where(LogisticsNodeORM.dag_id == dag_orm.id)
    )
    edges_result = await db.execute(
        select(LogisticsEdgeORM).where(LogisticsEdgeORM.dag_id == dag_orm.id)
    )
    nodes_orm = nodes_result.scalars().all()
    edges_orm = edges_result.scalars().all()

    nodes = [
        LogisticsNode(
            id=str(n.id),
            dhis2_org_unit_id=n.dhis2_org_unit_id,
            name=n.name,
            level=n.level,  # type: ignore[arg-type]
            lat=n.lat,
            lng=n.lng,
            population_served=n.population_served,
            cold_chain_type=n.cold_chain_type,  # type: ignore[arg-type]
            cold_chain_capacity_litres=n.cold_chain_capacity_litres,
            is_active=n.is_active,
            stockout_frequency=n.stockout_frequency,
            country_code=n.country_code,
        )
        for n in nodes_orm
    ]
    edges = [
        LogisticsEdge(
            id=str(e.id),
            source_node_id=str(e.source_node_id),
            target_node_id=str(e.target_node_id),
            distance_km=e.distance_km,
            transit_time_hours=e.transit_time_hours,
            cold_chain_capacity_litres=e.cold_chain_capacity_litres,
            reliability_score=e.reliability_score,
            cost_per_unit_usd=e.cost_per_unit_usd,
            transport_mode=e.transport_mode,  # type: ignore[arg-type]
            is_active=e.is_active,
            country_code=e.country_code,
        )
        for e in edges_orm
    ]

    return LogisticsDAG(
        id=str(dag_orm.id),
        country_code=dag_orm.country_code,
        nodes=nodes,
        edges=edges,
        generated_at=dag_orm.generated_at,
        dhis2_data_source_id=str(dag_orm.dhis2_data_source_id),
        version=dag_orm.version,
    )


# ---------------------------------------------------------------------------
# Scenario management
# ---------------------------------------------------------------------------


async def create_scenario(
    dag_id: uuid.UUID,
    disrupted_node_ids: list[str],
    disrupted_edge_ids: list[str],
    db: AsyncSession,
    label: str | None = None,
) -> DisruptionScenarioORM:
    """Persist a new disruption scenario (without propagation result).

    Args:
        dag_id: UUID of the parent DAG.
        disrupted_node_ids: Node IDs to mark as disrupted.
        disrupted_edge_ids: Edge IDs to mark as disrupted.
        db: SQLAlchemy async session.
        label: Optional human-readable label for the scenario.

    Returns:
        Newly created :class:`DisruptionScenarioORM`.
    """
    scenario_orm = DisruptionScenarioORM(
        id=uuid.uuid4(),
        dag_id=dag_id,
        disrupted_node_ids=disrupted_node_ids,
        disrupted_edge_ids=disrupted_edge_ids,
        label=label,
    )
    db.add(scenario_orm)
    await db.flush()  # assign PK without committing outer transaction
    return scenario_orm


async def save_propagation_result(
    scenario_orm: DisruptionScenarioORM,
    result: PropagationResult,
    db: AsyncSession,
) -> None:
    """Persist a computed propagation result back to the scenario ORM row.

    Args:
        scenario_orm: The scenario to update.
        result: The simulation output to cache.
        db: SQLAlchemy async session.
    """
    scenario_orm.propagation_result = result.model_dump(mode="json")
    await db.flush()


async def get_scenario(
    scenario_id: uuid.UUID, db: AsyncSession
) -> DisruptionScenarioORM:
    """Fetch a scenario ORM row by ID.

    Args:
        scenario_id: UUID of the disruption scenario.
        db: SQLAlchemy async session.

    Returns:
        :class:`DisruptionScenarioORM`.

    Raises:
        HTTPException 404: If the scenario does not exist.
    """
    result = await db.execute(
        select(DisruptionScenarioORM).where(DisruptionScenarioORM.id == scenario_id)
    )
    orm = result.scalar_one_or_none()
    if orm is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Disruption scenario {scenario_id} not found.",
        )
    return orm


# ---------------------------------------------------------------------------
# ORM → Pydantic conversions
# ---------------------------------------------------------------------------


def orm_to_scenario(orm: DisruptionScenarioORM) -> DisruptionScenario:
    """Convert a :class:`DisruptionScenarioORM` to a Pydantic model."""
    return DisruptionScenario(
        id=str(orm.id),
        dag_id=str(orm.dag_id),
        disrupted_node_ids=[str(n) for n in (orm.disrupted_node_ids or [])],
        disrupted_edge_ids=[str(e) for e in (orm.disrupted_edge_ids or [])],
        label=orm.label,
        created_at=orm.created_at,
    )


def orm_to_propagation_result(orm: DisruptionScenarioORM) -> PropagationResult:
    """Deserialise the cached propagation result from the ORM row.

    Raises:
        HTTPException 422: If the scenario has not been simulated yet.
    """
    if not orm.propagation_result:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Propagation result not yet computed for this scenario. "
                "Run POST /api/v1/routes/simulate first."
            ),
        )
    raw = orm.propagation_result
    alternative_routes = [
        AlternativeRoute(**alt) for alt in raw.get("alternative_routes", [])
    ]
    return PropagationResult(
        scenario_id=raw["scenario_id"],
        affected_node_ids=raw.get("affected_node_ids", []),
        time_to_stockout_by_node=raw.get("time_to_stockout_by_node", {}),
        population_impacted=raw.get("population_impacted", 0),
        antigen_coverage_delta=raw.get("antigen_coverage_delta", 0.0),
        alternative_routes=alternative_routes,
        computed_at=raw["computed_at"],
    )


# ---------------------------------------------------------------------------
# DAG rebuild
# ---------------------------------------------------------------------------


async def rebuild_dag(
    country_code: str,
    data_source_id: str,
    db: AsyncSession,
) -> LogisticsDAG:
    """Mark existing DAGs as non-current and persist a freshly built DAG.

    This function is intentionally separated from DHIS2 fetching — callers
    are responsible for building the :class:`LogisticsDAG` Pydantic model
    (e.g. via :class:`~app.services.dag_builder.DHISRouteAdapter`) and then
    passing it here for persistence.

    Args:
        country_code: ISO 3166-1 alpha-2 code.
        data_source_id: DHIS2 data source identifier.
        db: SQLAlchemy async session.

    Returns:
        The persisted (not yet in-DB nodes/edges) :class:`LogisticsDAG`.

    Note:
        Callers must commit the session after this returns.
    """
    # Retire all existing current DAGs for this country
    existing = await db.execute(
        select(LogisticsDagORM).where(
            LogisticsDagORM.country_code == country_code.upper(),
            LogisticsDagORM.is_current.is_(True),
        )
    )
    for old_orm in existing.scalars().all():
        old_orm.is_current = False

    await db.flush()

    # Determine next version number
    version_result = await db.execute(
        select(LogisticsDagORM.version)
        .where(LogisticsDagORM.country_code == country_code.upper())
        .order_by(LogisticsDagORM.version.desc())
        .limit(1)
    )
    latest_version = version_result.scalar_one_or_none() or 0
    next_version = latest_version + 1

    logger.info(
        "Rebuilding DAG for country=%s version=%d", country_code, next_version
    )

    # Create the new DAG ORM row (without nodes/edges — caller persists those)
    new_dag_orm = LogisticsDagORM(
        id=uuid.uuid4(),
        country_code=country_code.upper(),
        dhis2_data_source_id=data_source_id,
        generated_at=datetime.now(tz=timezone.utc),
        version=next_version,
        is_current=True,
    )
    db.add(new_dag_orm)
    await db.flush()

    return LogisticsDAG(
        id=str(new_dag_orm.id),
        country_code=new_dag_orm.country_code,
        nodes=[],
        edges=[],
        generated_at=new_dag_orm.generated_at,
        dhis2_data_source_id=new_dag_orm.dhis2_data_source_id,
        version=new_dag_orm.version,
    )
