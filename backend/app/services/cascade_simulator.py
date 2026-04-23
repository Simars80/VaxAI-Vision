"""Cascade failure propagation engine for vaccine logistics DAGs.

Given a :class:`~app.models.logistics.LogisticsDAG` and a
:class:`~app.models.logistics.DisruptionScenario`, the
:class:`CascadeSimulator` computes:

- which downstream nodes are affected (BFS),
- time-to-stockout per affected facility/district node,
- total population impacted,
- estimated antigen coverage reduction, and
- ranked alternative routing options via Dijkstra.

Public utilities:
    ``topological_sort(adj)`` — Kahn's algorithm; raises ``ValueError`` on cycles.
"""

from __future__ import annotations

import heapq
import logging
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.logistics import (
        AlternativeRoute,
        DisruptionScenario,
        LogisticsDAG,
        LogisticsNode,
        PropagationResult,
    )

from app.models.logistics import AlternativeRoute, NodeLevel, PropagationResult

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_DEFAULT_STOCKOUT_FACILITY_HOURS: float = 72.0   # 3 days for facility nodes
_DEFAULT_STOCKOUT_DISTRICT_HOURS: float = 168.0  # 7 days for district / higher nodes
_MAX_ALTERNATIVES_PER_NODE: int = 3              # top alternatives returned per node
_INF: float = float("inf")


# ---------------------------------------------------------------------------
# Public utility — topological sort (Kahn's algorithm)
# ---------------------------------------------------------------------------


def topological_sort(adj: dict[str, list[str]]) -> list[str]:
    """Return a topological ordering of nodes in ``adj``.

    Uses Kahn's BFS-based algorithm.

    Args:
        adj: Adjacency list ``{node_id: [child_node_ids]}``.

    Returns:
        List of node IDs in topological order (sources first).

    Raises:
        ValueError: If ``adj`` contains a cycle (not a DAG).
    """
    in_degree: dict[str, int] = {node: 0 for node in adj}
    for children in adj.values():
        for child in children:
            in_degree[child] = in_degree.get(child, 0) + 1

    queue: deque[str] = deque(n for n, deg in in_degree.items() if deg == 0)
    order: list[str] = []

    while queue:
        node = queue.popleft()
        order.append(node)
        for child in adj.get(node, []):
            in_degree[child] -= 1
            if in_degree[child] == 0:
                queue.append(child)

    if len(order) != len(in_degree):
        raise ValueError(
            "Cycle detected: adjacency list does not represent a valid DAG."
        )
    return order


# ---------------------------------------------------------------------------
# CascadeSimulator
# ---------------------------------------------------------------------------


class CascadeSimulator:
    """Compute cascade failure propagation for a vaccine logistics disruption.

    All methods are synchronous and operate on in-memory Pydantic models.
    The public :meth:`simulate` method completes in O(V + E) for BFS and
    O((V + E) log V) for Dijkstra alternative-finding.
    """

    # -----------------------------------------------------------------------
    # Public interface
    # -----------------------------------------------------------------------

    def simulate(
        self,
        dag: "LogisticsDAG",
        scenario: "DisruptionScenario",
    ) -> PropagationResult:
        """Run the full cascade failure simulation.

        Args:
            dag: The base logistics DAG (unmodified; disruptions are overlaid).
            scenario: Disruption scenario with sets of disrupted node/edge IDs.

        Returns:
            A :class:`PropagationResult` with affected nodes, stockout times,
            population impact, coverage delta, and ranked alternatives.
        """
        disrupted_nodes: set[str] = set(scenario.disrupted_node_ids)
        disrupted_edges: set[str] = set(scenario.disrupted_edge_ids)

        # Build the ORIGINAL adjacency (active edges only, no disruptions applied)
        # Used for BFS: we want all nodes reachable downstream from disrupted nodes.
        original_adj = self._build_adjacency(dag, set(), set())

        # Build the MODIFIED adjacency (disrupted nodes/edges removed)
        # Used for alternative route finding: represents what's still connected.
        modified_adj = self._build_adjacency(dag, disrupted_nodes, disrupted_edges)

        # BFS from disrupted nodes through the ORIGINAL graph to find downstream affected
        affected = self._downstream_affected(disrupted_nodes, original_adj)

        # Remove the directly disrupted nodes from affected (they are the cause)
        affected -= disrupted_nodes

        # Time-to-stockout per affected node
        ttso: dict[str, float] = {}
        for node_id in affected:
            node = dag.get_node(node_id)
            if node is not None and node.level in (
                NodeLevel.FACILITY,
                NodeLevel.DISTRICT,
            ):
                ttso[node_id] = self._time_to_stockout(node)

        # Population + coverage impact (facility-level only)
        population_impacted = sum(
            dag.get_node(n).population_served or 0
            for n in affected
            if dag.get_node(n) is not None
            and dag.get_node(n).level == NodeLevel.FACILITY
        )

        coverage_delta = self._estimate_coverage_delta(population_impacted, dag)

        # Alternative routes for isolated facility nodes (use modified graph)
        alternatives = self._find_alternatives(
            dag, affected, disrupted_nodes, disrupted_edges, modified_adj
        )

        result = PropagationResult(
            scenario_id=scenario.id,
            affected_node_ids=list(affected),
            time_to_stockout_by_node=ttso,
            population_impacted=population_impacted,
            antigen_coverage_delta=coverage_delta,
            alternative_routes=alternatives,
            computed_at=datetime.now(tz=timezone.utc),
        )

        logger.info(
            "Cascade simulation complete: scenario=%s affected=%d pop=%d",
            scenario.id,
            len(affected),
            population_impacted,
        )
        return result

    # -----------------------------------------------------------------------
    # Internal: graph construction
    # -----------------------------------------------------------------------

    def _build_adjacency(
        self,
        dag: "LogisticsDAG",
        disrupted_nodes: set[str],
        disrupted_edges: set[str],
    ) -> dict[str, list[str]]:
        """Build a child-adjacency list skipping disrupted nodes and edges.

        A node is excluded as a *source* if it is disrupted.  An edge is
        skipped if it is explicitly disrupted, its source is disrupted, or
        its target is disrupted (disrupted nodes cannot relay supply).

        Args:
            dag: Base logistics DAG.
            disrupted_nodes: Set of node IDs marked inactive in this scenario.
            disrupted_edges: Set of edge IDs marked inactive in this scenario.

        Returns:
            ``{node_id: [child_node_ids]}`` for non-disrupted topology.
        """
        adj: dict[str, list[str]] = {n.id: [] for n in dag.nodes}

        for edge in dag.edges:
            if not edge.is_active:
                continue
            if edge.id in disrupted_edges:
                continue
            if edge.source_node_id in disrupted_nodes:
                continue
            if edge.target_node_id in disrupted_nodes:
                continue
            adj.setdefault(edge.source_node_id, []).append(edge.target_node_id)

        return adj

    # -----------------------------------------------------------------------
    # Internal: BFS downstream affected
    # -----------------------------------------------------------------------

    def _downstream_affected(
        self,
        disrupted_nodes: set[str],
        children: dict[str, list[str]],
    ) -> set[str]:
        """BFS from disrupted nodes to collect all reachable downstream nodes.

        Args:
            disrupted_nodes: Starting set (the directly disrupted nodes).
            children: Adjacency list from :meth:`_build_adjacency` (modified graph).

        Returns:
            Set of all node IDs reachable from any disrupted node (inclusive).
        """
        visited: set[str] = set(disrupted_nodes)
        queue: deque[str] = deque(disrupted_nodes)

        while queue:
            current = queue.popleft()
            for child in children.get(current, []):
                if child not in visited:
                    visited.add(child)
                    queue.append(child)

        return visited

    # -----------------------------------------------------------------------
    # Internal: time-to-stockout
    # -----------------------------------------------------------------------

    @staticmethod
    def _time_to_stockout(node: "LogisticsNode") -> float:
        """Return estimated hours until stockout for an affected node.

        Defaults (Phase 2A — no real consumption data):
        - FACILITY: 72 h (3 days)
        - DISTRICT and above: 168 h (7 days)

        Args:
            node: The logistics node to estimate stockout for.

        Returns:
            Hours until projected stockout.
        """
        if node.level == NodeLevel.FACILITY:
            return _DEFAULT_STOCKOUT_FACILITY_HOURS
        return _DEFAULT_STOCKOUT_DISTRICT_HOURS

    # -----------------------------------------------------------------------
    # Internal: Dijkstra alternative routes
    # -----------------------------------------------------------------------

    def _find_alternatives(
        self,
        dag: "LogisticsDAG",
        affected: set[str],
        disrupted_nodes: set[str],
        disrupted_edges: set[str],
        modified_adj: dict[str, list[str]] | None = None,
    ) -> list["AlternativeRoute"]:
        """Find alternative supply routes for isolated facility nodes.

        For each affected *facility* node, runs Dijkstra from the nearest
        non-disrupted district/regional/national node to find the shortest
        non-disrupted path measured in ``transit_time_hours``.

        Args:
            dag: Base logistics DAG.
            affected: Set of affected node IDs (excludes the disrupted sources).
            disrupted_nodes: Set of node IDs inactive in this scenario.
            disrupted_edges: Set of edge IDs inactive in this scenario.
            modified_adj: Pre-built modified adjacency (optional). If provided,
                avoids re-iterating edges.

        Returns:
            Ranked list of :class:`AlternativeRoute` (by feasibility score, desc).
        """
        # Build forward adjacency with transit weights for Dijkstra.
        # Use only non-disrupted edges (same filter as modified_adj).
        forward: dict[str, list[tuple[str, float, str]]] = defaultdict(list)
        for edge in dag.edges:
            if not edge.is_active:
                continue
            if edge.id in disrupted_edges:
                continue
            if edge.source_node_id in disrupted_nodes:
                continue
            if edge.target_node_id in disrupted_nodes:
                continue
            forward[edge.source_node_id].append(
                (edge.target_node_id, edge.transit_time_hours, edge.id)
            )

        # Identify supply anchor nodes (non-disrupted, non-facility nodes)
        anchor_ids: set[str] = {
            n.id
            for n in dag.nodes
            if n.id not in disrupted_nodes
            and n.id not in affected
            and n.level != NodeLevel.FACILITY
        }

        alternatives: list[AlternativeRoute] = []

        # Process affected facility nodes
        affected_facilities = [
            dag.get_node(n)
            for n in affected
            if dag.get_node(n) is not None
            and dag.get_node(n).level == NodeLevel.FACILITY  # type: ignore[union-attr]
        ]

        for facility in affected_facilities:
            if facility is None:
                continue
            best = self._dijkstra_from_anchors(
                facility.id, anchor_ids, forward, dag
            )
            alternatives.extend(best)

        # Sort by feasibility descending, then additional_transit_hours ascending
        alternatives.sort(
            key=lambda r: (-r.feasibility_score, r.additional_transit_hours)
        )
        return alternatives[:_MAX_ALTERNATIVES_PER_NODE * len(affected_facilities) or 10]

    def _dijkstra_from_anchors(
        self,
        target_id: str,
        anchor_ids: set[str],
        forward: dict[str, list[tuple[str, float, str]]],
        dag: "LogisticsDAG",
    ) -> list["AlternativeRoute"]:
        """Run Dijkstra from all anchor nodes toward ``target_id``.

        Uses a reverse adjacency view: find the shortest path *to* the target
        by reversing edge direction and running Dijkstra from ``target_id``.

        Args:
            target_id: The isolated facility node to route supply to.
            anchor_ids: Set of non-disrupted supply nodes.
            forward: Forward adjacency with transit weights.
            dag: Base logistics DAG (for node lookups).

        Returns:
            Up to :data:`_MAX_ALTERNATIVES_PER_NODE` :class:`AlternativeRoute` items.
        """
        # Build reverse graph for backward Dijkstra from target
        reverse: dict[str, list[tuple[str, float]]] = defaultdict(list)
        for src, neighbors in forward.items():
            for tgt, weight, _ in neighbors:
                reverse[tgt].append((src, weight))

        # Dijkstra: distances from target backwards
        dist: dict[str, float] = {target_id: 0.0}
        prev: dict[str, str | None] = {target_id: None}
        heap: list[tuple[float, str]] = [(0.0, target_id)]

        while heap:
            d, node = heapq.heappop(heap)
            if d > dist.get(node, _INF):
                continue
            for neighbor, weight in reverse.get(node, []):
                nd = d + weight
                if nd < dist.get(neighbor, _INF):
                    dist[neighbor] = nd
                    prev[neighbor] = node
                    heapq.heappush(heap, (nd, neighbor))

        # Collect alternatives: one per reachable anchor
        results: list[AlternativeRoute] = []
        for anchor_id in anchor_ids:
            if anchor_id not in dist:
                continue

            total_hours = dist[anchor_id]

            # Reconstruct path
            path: list[str] = []
            cur: str | None = anchor_id
            while cur is not None and cur != target_id:
                path.append(cur)
                cur = prev.get(cur)
            path.append(target_id)
            via = path[1:-1]  # intermediate nodes (exclude anchor and target)

            target_node = dag.get_node(target_id)
            pop_protected = (
                target_node.population_served or 0
                if target_node is not None
                else 0
            )

            # Feasibility score: higher reliability degrades with additional transit
            # Simple heuristic: 1.0 - (extra_hours / 240h max considered)
            feasibility = max(0.0, 1.0 - total_hours / 240.0)

            results.append(
                AlternativeRoute(
                    from_node_id=anchor_id,
                    to_node_id=target_id,
                    via_node_ids=via,
                    additional_transit_hours=total_hours,
                    population_protected=pop_protected,
                    feasibility_score=round(feasibility, 4),
                )
            )

        results.sort(key=lambda r: (-r.feasibility_score, r.additional_transit_hours))
        return results[:_MAX_ALTERNATIVES_PER_NODE]

    # -----------------------------------------------------------------------
    # Internal: coverage delta estimation
    # -----------------------------------------------------------------------

    @staticmethod
    def _estimate_coverage_delta(population_impacted: int, dag: "LogisticsDAG") -> float:
        """Estimate antigen coverage reduction as a percentage delta.

        Phase 2A heuristic: proportion of total served population that is
        impacted, scaled by a 0.7 antigen-coverage factor (not all stock
        shortfalls translate to missed doses immediately).

        Args:
            population_impacted: Number of people in affected facility catchments.
            dag: Full DAG (used to compute total served population denominator).

        Returns:
            Coverage reduction in percentage points (0.0 – 100.0).
        """
        total_pop = sum(
            n.population_served or 0
            for n in dag.nodes
            if n.level == NodeLevel.FACILITY
        )
        if total_pop == 0:
            return 0.0
        raw_fraction = population_impacted / total_pop
        return round(min(raw_fraction * 0.7 * 100.0, 100.0), 2)
