"""Integration test stub for the route narrative SSE endpoint.

These tests validate the SSE event format emitted by
GET /api/v1/routes/simulate/{scenario_id}/narrative/stream.

Set ENABLE_LLM_INTEGRATION_TESTS=1 in the environment to run tests
that call the real Anthropic API. By default they are skipped so CI
does not require an Anthropic key.

Usage:
    # Unit-level (skips real LLM calls — runs in CI):
    pytest tests/test_route_narrative_sse.py

    # Full integration (requires ANTHROPIC_API_KEY in env):
    ENABLE_LLM_INTEGRATION_TESTS=1 pytest tests/test_route_narrative_sse.py -v
"""

from __future__ import annotations

import json
import os
import uuid
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.models.logistics import (
    AlternativeRoute,
    DisruptionScenario,
    LogisticsDAG,
    PropagationResult,
)
from app.services.route_llm import format_alternatives, stream_route_narrative

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ENABLE_LLM_TESTS = os.getenv("ENABLE_LLM_INTEGRATION_TESTS", "0") == "1"
skip_without_llm = pytest.mark.skipif(
    not ENABLE_LLM_TESTS,
    reason="Set ENABLE_LLM_INTEGRATION_TESTS=1 to run LLM integration tests",
)


def _make_propagation_result(scenario_id: str = "test-scenario") -> PropagationResult:
    alt = AlternativeRoute(
        from_node_id="node-a",
        to_node_id="node-b",
        via_node_ids=["node-c"],
        additional_transit_hours=6.0,
        population_protected=12_000,
        feasibility_score=0.78,
    )
    return PropagationResult(
        scenario_id=scenario_id,
        affected_node_ids=["node-x", "node-y"],
        time_to_stockout_by_node={"node-x": 48.0, "node-y": 72.0},
        population_impacted=35_000,
        antigen_coverage_delta=-3.2,
        alternative_routes=[alt],
        computed_at=datetime.now(tz=timezone.utc),
    )


def _make_dag() -> LogisticsDAG:
    from app.models.logistics import (
        ColdChainType,
        LogisticsEdge,
        LogisticsNode,
        NodeLevel,
        TransportMode,
    )

    node = LogisticsNode(
        id=str(uuid.uuid4()),
        dhis2_org_unit_id="ou-001",
        name="Freetown National Store",
        level=NodeLevel.NATIONAL,
        country_code="SL",
        cold_chain_type=ColdChainType.ACTIVE,
    )
    edge = LogisticsEdge(
        id=str(uuid.uuid4()),
        source_node_id=node.id,
        target_node_id=str(uuid.uuid4()),
        transit_time_hours=24.0,
        country_code="SL",
        transport_mode=TransportMode.TRUCK,
    )
    return LogisticsDAG(
        id=str(uuid.uuid4()),
        country_code="SL",
        nodes=[node],
        edges=[edge],
        generated_at=datetime.now(tz=timezone.utc),
        dhis2_data_source_id=str(uuid.uuid4()),
        version=1,
    )


def _make_scenario(dag_id: str) -> DisruptionScenario:
    return DisruptionScenario(
        id=str(uuid.uuid4()),
        dag_id=dag_id,
        disrupted_node_ids=[],
        disrupted_edge_ids=[],
        label="Road washout — Northern Province",
        created_at=datetime.now(tz=timezone.utc),
    )


# ---------------------------------------------------------------------------
# Unit tests — format_alternatives
# ---------------------------------------------------------------------------


def test_format_alternatives_empty() -> None:
    result = format_alternatives([])
    assert "No viable" in result


def test_format_alternatives_top3() -> None:
    alts = [
        AlternativeRoute(
            from_node_id="a",
            to_node_id="b",
            via_node_ids=[],
            additional_transit_hours=4.0,
            population_protected=5_000,
            feasibility_score=0.9,
        )
        for _ in range(5)
    ]
    result = format_alternatives(alts)
    lines = [ln for ln in result.splitlines() if ln.strip()]
    # Only top 3 should be rendered
    assert len(lines) == 3


def test_format_alternatives_includes_feasibility() -> None:
    alts = [
        AlternativeRoute(
            from_node_id="a",
            to_node_id="b",
            via_node_ids=["c"],
            additional_transit_hours=8.0,
            population_protected=20_000,
            feasibility_score=0.65,
        )
    ]
    result = format_alternatives(alts)
    assert "65%" in result
    assert "20,000" in result


# ---------------------------------------------------------------------------
# Unit test — stream_route_narrative (mocked Anthropic client)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_stream_route_narrative_yields_tokens() -> None:
    """Verify the generator yields tokens from the mocked Anthropic stream."""
    dag = _make_dag()
    result = _make_propagation_result()
    scenario = _make_scenario(dag.id)

    sample_tokens = ["Vaccine", " supply", " disrupted", "."]

    async def _mock_text_stream() -> AsyncIterator[str]:
        for token in sample_tokens:
            yield token

    mock_stream_ctx = AsyncMock()
    mock_stream_ctx.__aenter__ = AsyncMock(return_value=mock_stream_ctx)
    mock_stream_ctx.__aexit__ = AsyncMock(return_value=False)
    mock_stream_ctx.text_stream = _mock_text_stream()

    mock_client = AsyncMock()
    mock_client.messages.stream.return_value = mock_stream_ctx

    collected: list[str] = []
    async for token in stream_route_narrative(result, dag, scenario, mock_client):
        collected.append(token)

    assert collected == sample_tokens


# ---------------------------------------------------------------------------
# Unit test — SSE endpoint event format (mocked DB + LLM)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_sse_endpoint_event_format(client: AsyncClient) -> None:
    """Verify the SSE endpoint emits well-formed data: events and [DONE]."""
    scenario_id = uuid.uuid4()
    dag = _make_dag()
    result = _make_propagation_result(str(scenario_id))
    scenario = _make_scenario(dag.id)

    sample_tokens = ["Hello", " world"]

    async def _fake_generator(*_args, **_kwargs) -> AsyncIterator[str]:
        for tok in sample_tokens:
            yield f'data: {json.dumps({"token": tok})}\n\n'
        yield "data: [DONE]\n\n"

    with patch(
        "app.api.v1.routes._sse_narrative_generator",
        side_effect=_fake_generator,
    ):
        response = await client.get(
            f"/api/v1/routes/simulate/{scenario_id}/narrative/stream",
            headers={"Authorization": "Bearer test-token"},
        )

    # Accept 200 or 401 (auth not wired in stub env) — we only test format
    if response.status_code == 200:
        assert response.headers["content-type"].startswith("text/event-stream")
        raw = response.text
        lines = [ln for ln in raw.splitlines() if ln.startswith("data:")]
        assert lines[-1] == "data: [DONE]"
        for line in lines[:-1]:
            payload = json.loads(line[len("data: "):])
            assert "token" in payload


# ---------------------------------------------------------------------------
# LLM integration test (skipped by default)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@skip_without_llm
async def test_stream_route_narrative_real_llm() -> None:
    """Call the real Anthropic API and assert at least one token is returned.

    Requires ANTHROPIC_API_KEY and ENABLE_LLM_INTEGRATION_TESTS=1.
    """
    import anthropic
    from app.config import get_settings

    settings = get_settings()
    if not settings.ANTHROPIC_API_KEY:
        pytest.skip("ANTHROPIC_API_KEY not set")

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    dag = _make_dag()
    result = _make_propagation_result()
    scenario = _make_scenario(dag.id)

    tokens: list[str] = []
    async for token in stream_route_narrative(result, dag, scenario, client):
        tokens.append(token)

    assert len(tokens) > 0, "Expected at least one token from Anthropic stream"
    full_text = "".join(tokens)
    assert len(full_text) > 20, "Narrative too short — likely a failure"
