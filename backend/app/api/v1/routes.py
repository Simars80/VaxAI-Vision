"""Route management API — DAG simulation and LLM narrative streaming.

Endpoints:
  GET  /api/v1/routes/simulate/{scenario_id}/narrative/stream
       Streams an LLM-generated disruption impact narrative via SSE.
"""

from __future__ import annotations

import json
import logging
import uuid
from collections.abc import AsyncGenerator

import anthropic
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.logistics import (
    DisruptionScenario,
    DisruptionScenarioORM,
    LogisticsDAG,
    LogisticsDagORM,
    LogisticsEdge,
    LogisticsEdgeORM,
    LogisticsNode,
    LogisticsNodeORM,
    PropagationResult,
    AlternativeRoute,
)
from app.models.user import User
from app.services.route_llm import stream_route_narrative

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/routes", tags=["routes"])

settings = get_settings()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _build_anthropic_client() -> anthropic.AsyncAnthropic:
    """Instantiate the Anthropic async client from settings."""
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM service is not configured (ANTHROPIC_API_KEY missing).",
        )
    return anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


async def _load_scenario(
    scenario_id: uuid.UUID, db: AsyncSession
) -> DisruptionScenarioORM:
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


async def _load_dag(dag_id: uuid.UUID, db: AsyncSession) -> LogisticsDAG:
    """Load a DAG and its nodes/edges from the database as a Pydantic model."""
    dag_result = await db.execute(
        select(LogisticsDagORM).where(LogisticsDagORM.id == dag_id)
    )
    dag_orm = dag_result.scalar_one_or_none()
    if dag_orm is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Logistics DAG {dag_id} not found.",
        )

    nodes_result = await db.execute(
        select(LogisticsNodeORM).where(LogisticsNodeORM.dag_id == dag_id)
    )
    nodes_orm = nodes_result.scalars().all()

    edges_result = await db.execute(
        select(LogisticsEdgeORM).where(LogisticsEdgeORM.dag_id == dag_id)
    )
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


def _orm_to_scenario(orm: DisruptionScenarioORM) -> DisruptionScenario:
    return DisruptionScenario(
        id=str(orm.id),
        dag_id=str(orm.dag_id),
        disrupted_node_ids=[str(n) for n in (orm.disrupted_node_ids or [])],
        disrupted_edge_ids=[str(e) for e in (orm.disrupted_edge_ids or [])],
        label=orm.label,
        created_at=orm.created_at,
    )


def _orm_to_propagation_result(orm: DisruptionScenarioORM) -> PropagationResult:
    """Deserialise the cached JSON propagation result from the ORM row."""
    if not orm.propagation_result:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Propagation result not yet computed for this scenario. "
                "Run simulation first."
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
# SSE event generator
# ---------------------------------------------------------------------------


async def _sse_narrative_generator(
    scenario_id: uuid.UUID,
    db: AsyncSession,
) -> AsyncGenerator[str, None]:
    """Generate SSE events for the narrative stream, then cache the result."""
    scenario_orm = await _load_scenario(scenario_id, db)
    scenario = _orm_to_scenario(scenario_orm)
    propagation = _orm_to_propagation_result(scenario_orm)
    dag = await _load_dag(uuid.UUID(scenario.dag_id), db)
    client = _build_anthropic_client()

    accumulated: list[str] = []

    try:
        async for token in stream_route_narrative(propagation, dag, scenario, client):
            accumulated.append(token)
            payload = json.dumps({"token": token})
            yield f"data: {payload}\n\n"

        yield "data: [DONE]\n\n"

        # Persist full narrative after streaming completes
        full_narrative = "".join(accumulated)
        await db.execute(
            text(
                "UPDATE disruption_scenarios "
                "SET narrative = :narrative "
                "WHERE id = :scenario_id"
            ),
            {"narrative": full_narrative, "scenario_id": scenario_id},
        )
        await db.commit()

        logger.info(
            "Narrative cached",
            extra={"scenario_id": str(scenario_id), "length": len(full_narrative)},
        )

    except anthropic.APIError as exc:
        logger.error(
            "LLM stream failed",
            extra={"scenario_id": str(scenario_id), "error": str(exc)},
        )
        error_payload = json.dumps({"error": "LLM service error; narrative unavailable."})
        yield f"data: {error_payload}\n\n"
        yield "data: [DONE]\n\n"


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.get(
    "/simulate/{scenario_id}/narrative/stream",
    summary="Stream disruption impact narrative (SSE)",
    response_description="Server-sent events: {token} chunks then [DONE]",
    responses={
        200: {"content": {"text/event-stream": {}}},
        404: {"description": "Scenario not found"},
        422: {"description": "Propagation result not yet available"},
        503: {"description": "LLM service not configured"},
    },
)
async def stream_scenario_narrative(
    scenario_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
) -> StreamingResponse:
    """Stream an LLM-generated narrative for a disruption scenario.

    The endpoint yields SSE events in the format::

        data: {"token": "…"}\n\n
        data: [DONE]\n\n

    After the stream completes the full narrative is stored in
    ``disruption_scenarios.narrative`` for subsequent retrieval.
    """
    return StreamingResponse(
        _sse_narrative_generator(scenario_id, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
