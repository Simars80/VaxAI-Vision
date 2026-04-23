"""LLM service for vaccine logistics route impact narratives.

Streams an AI-generated supply chain analyst narrative for a given
disruption scenario using the Anthropic async SDK with SSE token delivery.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING

import anthropic

if TYPE_CHECKING:
    from app.models.logistics import (
        DisruptionScenario,
        LogisticsDAG,
        PropagationResult,
    )

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt constants
# ---------------------------------------------------------------------------

ROUTE_IMPACT_SYSTEM_PROMPT: str = (
    "You are a senior vaccine supply chain analyst for a global health NGO. "
    "Your role is to communicate disruption impacts clearly and concisely to "
    "health ministry officials and field operations teams. "
    "Write in plain English — no bullet points, no headings. "
    "Use human-readable location names only; never include internal UUIDs. "
    "Be factual, specific about populations and timelines, and end with a "
    "concrete recommended action. Limit your response to 3–4 sentences."
)

ROUTE_IMPACT_USER_TEMPLATE: str = (
    "A supply chain disruption has been detected in {country}. "
    "Disruption type: {disruption_label}. "
    "{affected_count} distribution node(s) are affected, serving a combined "
    "population of approximately {population:,}. "
    "Without intervention, facilities in the affected area are projected to "
    "reach stockout within {stockout_min:.0f}–{stockout_max:.0f} hours. "
    "Estimated antigen coverage reduction: {coverage_delta:.1f} percentage point(s). "
    "Top alternative routing options:\n{alternatives}\n"
    "Provide a concise impact narrative and single recommended action."
)

# ---------------------------------------------------------------------------
# Helper: format alternatives for the prompt
# ---------------------------------------------------------------------------

_COUNTRY_NAMES: dict[str, str] = {
    "SL": "Sierra Leone",
    "GH": "Ghana",
    "NG": "Nigeria",
    "KE": "Kenya",
    "TZ": "Tanzania",
    "ZM": "Zambia",
    "MZ": "Mozambique",
    "MW": "Malawi",
    "UG": "Uganda",
    "ET": "Ethiopia",
}


def _country_name(code: str) -> str:
    """Return human-readable country name, falling back to the ISO code."""
    return _COUNTRY_NAMES.get(code.upper(), code.upper())


def format_alternatives(alternatives: list) -> str:
    """Format top-3 AlternativeRoute objects as a human-readable numbered list.

    Args:
        alternatives: List of ``AlternativeRoute`` Pydantic models.

    Returns:
        A newline-separated numbered string, or a fallback message when empty.
    """
    if not alternatives:
        return "  (No viable alternative routes identified.)"

    top3 = alternatives[:3]
    lines: list[str] = []
    for i, alt in enumerate(top3, start=1):
        via = (
            f" via {len(alt.via_node_ids)} intermediate node(s)"
            if alt.via_node_ids
            else ""
        )
        lines.append(
            f"  {i}. +{alt.additional_transit_hours:.0f} h transit{via}; "
            f"protects ~{alt.population_protected:,} people "
            f"(feasibility {alt.feasibility_score:.0%})"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Core streaming function
# ---------------------------------------------------------------------------


async def stream_route_narrative(
    result: "PropagationResult",
    dag: "LogisticsDAG",
    scenario: "DisruptionScenario",
    client: anthropic.AsyncAnthropic,
) -> AsyncIterator[str]:
    """Stream LLM narrative tokens for a disruption scenario.

    Yields individual text tokens from the Anthropic streaming API.
    The caller is responsible for accumulating tokens and persisting the
    full narrative after the stream completes.

    Args:
        result: Cascade propagation result containing affected nodes and metrics.
        dag: The logistics DAG used for this simulation.
        scenario: The disruption scenario definition.
        client: An initialised ``anthropic.AsyncAnthropic`` client.

    Yields:
        Individual text token strings as they arrive from the model.
    """
    stockout_values = list(result.time_to_stockout_by_node.values())
    stockout_min = min(stockout_values) if stockout_values else 0.0
    stockout_max = max(stockout_values) if stockout_values else 0.0

    disruption_label = scenario.label or "Route disruption"
    alternatives_text = format_alternatives(result.alternative_routes)
    country_name = _country_name(dag.country_code)

    user_message = ROUTE_IMPACT_USER_TEMPLATE.format(
        country=country_name,
        disruption_label=disruption_label,
        affected_count=len(result.affected_node_ids),
        population=result.population_impacted,
        stockout_min=stockout_min,
        stockout_max=stockout_max,
        coverage_delta=abs(result.antigen_coverage_delta),
        alternatives=alternatives_text,
    )

    logger.info(
        "Streaming route narrative",
        extra={
            "scenario_id": scenario.id,
            "affected_nodes": len(result.affected_node_ids),
            "population_impacted": result.population_impacted,
        },
    )

    try:
        async with client.messages.stream(
            model="claude-opus-4-6",
            max_tokens=512,
            system=ROUTE_IMPACT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        ) as stream:
            async for text in stream.text_stream:
                yield text
    except anthropic.APIError as exc:
        logger.error(
            "Anthropic API error during narrative stream",
            extra={"scenario_id": scenario.id, "error": str(exc)},
        )
        raise
