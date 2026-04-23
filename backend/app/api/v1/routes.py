"""Route management API — DAG fetch, disruption simulation, and LLM narratives.

Endpoints:
  GET  /api/v1/routes/dag/{country_code}                       — fetch active DAG
  POST /api/v1/routes/simulate                                 — run disruption simulation
  GET  /api/v1/routes/alternatives/{scenario_id}               — fetch ranked alternatives
  POST /api/v1/routes/dag/{country_code}/rebuild               — trigger DAG rebuild (admin)
  GET  /api/v1/routes/simulate/{scenario_id}/narrative/stream  — SSE LLM narrative
"""

from __future__ import annotations

import json
import logging
import uuid
from collections.abc import AsyncGenerator
from typing import Any, Generic, TypeVar

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.logistics import (
    DisruptionScenarioORM,
)
from app.models.user import User, UserRole
from app.services import route_service
from app.services.cascade_simulator import CascadeSimulator
from app.services.route_llm import stream_route_narrative

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/routes", tags=["routes"])

settings = get_settings()

_simulator = CascadeSimulator()

# ---------------------------------------------------------------------------
# Response envelope
# ---------------------------------------------------------------------------

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Standard ``{ data, error, meta }`` response envelope."""

    data: T | None = None
    error: str | None = None
    meta: dict[str, Any] = {}


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class SimulateRequest(BaseModel):
    """Request body for POST /api/v1/routes/simulate."""

    dag_id: str
    disrupted_node_ids: list[str] = []
    disrupted_edge_ids: list[str] = []
    label: str | None = None


# ---------------------------------------------------------------------------
# Authorization helper
# ---------------------------------------------------------------------------


def _require_admin(user: User) -> None:
    """Raise 403 if the user does not have an admin-tier role."""
    admin_roles = {UserRole.admin, UserRole.platform_admin, UserRole.national_admin}
    if user.role not in admin_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required for this operation.",
        )


# ---------------------------------------------------------------------------
# LLM client helper (used only by SSE narrative endpoint)
# ---------------------------------------------------------------------------


def _build_anthropic_client() -> anthropic.AsyncAnthropic:
    """Instantiate the Anthropic async client from settings."""
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM service is not configured (ANTHROPIC_API_KEY missing).",
        )
    return anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


# ---------------------------------------------------------------------------
# Endpoint 1 — GET /dag/{country_code}
# ---------------------------------------------------------------------------


@router.get(
    "/dag/{country_code}",
    summary="Fetch active DAG for a country",
    responses={
        200: {"description": "Active logistics DAG"},
        404: {"description": "No DAG found for this country"},
    },
)
async def get_active_dag(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    """Return the most recent active :class:`LogisticsDAG` for ``country_code``.

    The response includes the full node and edge lists.  For large DAGs
    (> 400 nodes) consider the ``include_edges`` query param to reduce payload.
    """
    dag = await route_service.get_active_dag(country_code.upper(), db)
    return {
        "data": dag.model_dump(mode="json"),
        "error": None,
        "meta": {
            "country_code": dag.country_code,
            "version": dag.version,
            "node_count": len(dag.nodes),
            "edge_count": len(dag.edges),
        },
    }


# ---------------------------------------------------------------------------
# Endpoint 2 — POST /simulate
# ---------------------------------------------------------------------------


@router.post(
    "/simulate",
    summary="Run a disruption simulation",
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {"description": "Simulation complete — propagation result returned"},
        404: {"description": "DAG not found"},
    },
)
async def simulate_disruption(
    body: SimulateRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    """Run the cascade failure simulator for the given disruption scenario.

    Creates a persisted :class:`DisruptionScenario` and returns the computed
    :class:`PropagationResult`.  The result is cached on the scenario row so
    that the SSE narrative and alternatives endpoints can read it without
    re-running the simulation.
    """
    try:
        dag_uuid = uuid.UUID(body.dag_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid dag_id: {body.dag_id!r}",
        )

    dag = await route_service.get_dag_by_id(dag_uuid, db)

    # Persist the scenario (without result yet)
    scenario_orm = await route_service.create_scenario(
        dag_id=dag_uuid,
        disrupted_node_ids=body.disrupted_node_ids,
        disrupted_edge_ids=body.disrupted_edge_ids,
        db=db,
        label=body.label,
    )
    scenario = route_service.orm_to_scenario(scenario_orm)

    # Run simulation (pure, in-memory — < 2 s for ~400-node graph)
    result = _simulator.simulate(dag, scenario)

    # Cache result on the scenario row, then commit both
    await route_service.save_propagation_result(scenario_orm, result, db)
    await db.commit()

    logger.info(
        "Simulation complete: scenario=%s affected=%d",
        scenario.id,
        len(result.affected_node_ids),
    )

    return {
        "data": {
            "scenario_id": scenario.id,
            "propagation": result.model_dump(mode="json"),
        },
        "error": None,
        "meta": {
            "dag_id": body.dag_id,
            "affected_count": len(result.affected_node_ids),
            "population_impacted": result.population_impacted,
        },
    }


# ---------------------------------------------------------------------------
# Endpoint 3 — GET /alternatives/{scenario_id}
# ---------------------------------------------------------------------------


@router.get(
    "/alternatives/{scenario_id}",
    summary="Fetch ranked alternative routes for a scenario",
    responses={
        200: {"description": "Ranked list of alternative routes"},
        404: {"description": "Scenario not found"},
        422: {"description": "Propagation result not yet computed"},
    },
)
async def get_alternatives(
    scenario_id: uuid.UUID,
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    """Return ranked alternative routing options from a computed scenario.

    Alternatives are ranked by ``feasibility_score`` (descending), then by
    ``additional_transit_hours`` (ascending).  Supports ``limit``/``offset``
    pagination.
    """
    scenario_orm = await route_service.get_scenario(scenario_id, db)
    propagation = route_service.orm_to_propagation_result(scenario_orm)

    all_alternatives = propagation.alternative_routes
    page = all_alternatives[offset : offset + limit]

    return {
        "data": [alt.model_dump(mode="json") for alt in page],
        "error": None,
        "meta": {
            "scenario_id": str(scenario_id),
            "total": len(all_alternatives),
            "limit": limit,
            "offset": offset,
        },
    }


# ---------------------------------------------------------------------------
# Endpoint 4 — POST /dag/{country_code}/rebuild (admin only)
# ---------------------------------------------------------------------------


@router.post(
    "/dag/{country_code}/rebuild",
    summary="Trigger DAG rebuild from DHIS2 (admin)",
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        202: {"description": "DAG rebuild initiated — new DAG record created"},
        403: {"description": "Admin role required"},
        404: {"description": "No DHIS2 data source configured for this country"},
    },
)
async def rebuild_dag(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    """Retire the current DAG and rebuild it from DHIS2 org unit hierarchy.

    Requires admin role (``platform_admin``, ``admin``, or ``national_admin``).

    In Phase 2A the rebuild creates a new versioned DAG record but does not
    re-fetch from DHIS2 inline (DHIS2 sync is handled by a background Celery
    task).  Returns the new DAG id and version immediately.

    Phase 2B will trigger the full DHIS2 fetch synchronously or enqueue a
    Celery job and return a task id.
    """
    _require_admin(current_user)

    # Use a placeholder data_source_id for Phase 2A
    # In Phase 2B this will be fetched from ExternalDataSource table
    data_source_id = f"dhis2-{country_code.lower()}"

    new_dag = await route_service.rebuild_dag(
        country_code=country_code.upper(),
        data_source_id=data_source_id,
        db=db,
    )
    await db.commit()

    logger.info(
        "DAG rebuild complete: country=%s dag_id=%s version=%d",
        country_code,
        new_dag.id,
        new_dag.version,
    )

    return {
        "data": {
            "dag_id": new_dag.id,
            "country_code": new_dag.country_code,
            "version": new_dag.version,
            "generated_at": new_dag.generated_at.isoformat(),
        },
        "error": None,
        "meta": {"status": "rebuilt"},
    }


# ---------------------------------------------------------------------------
# Endpoint 5 (pre-existing) — SSE narrative stream
# ---------------------------------------------------------------------------


async def _sse_narrative_generator(
    scenario_id: uuid.UUID,
    db: AsyncSession,
) -> AsyncGenerator[str, None]:
    """Generate SSE events for the narrative stream, then cache the result."""
    scenario_orm = await route_service.get_scenario(scenario_id, db)
    scenario = route_service.orm_to_scenario(scenario_orm)
    propagation = route_service.orm_to_propagation_result(scenario_orm)
    dag = await route_service.get_dag_by_id(uuid.UUID(scenario.dag_id), db)
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

        data: {"token": "…"}\\n\\n
        data: [DONE]\\n\\n

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
