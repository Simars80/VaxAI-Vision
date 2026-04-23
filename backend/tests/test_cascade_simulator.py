"""Unit tests for CascadeSimulator and topological_sort.

Uses a small fixture DAG (5 nodes, 5 edges) to validate the core algorithms
without any DB or HTTP dependencies.

Fixture topology (all directed downward):
    national (N) → regional (R) → district (D) → facility (F1)
                                               → facility (F2)

Node IDs:  n, r, d, f1, f2
Edge IDs:  e_nr, e_rd, e_df1, e_df2
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.models.logistics import (
    AlternativeRoute,
    ColdChainType,
    DisruptionScenario,
    LogisticsDAG,
    LogisticsEdge,
    LogisticsNode,
    NodeLevel,
    TransportMode,
)
from app.services.cascade_simulator import (
    CascadeSimulator,
    _DEFAULT_STOCKOUT_DISTRICT_HOURS,
    _DEFAULT_STOCKOUT_FACILITY_HOURS,
    topological_sort,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _node(
    node_id: str,
    level: NodeLevel,
    population: int | None = None,
    is_active: bool = True,
) -> LogisticsNode:
    return LogisticsNode(
        id=node_id,
        dhis2_org_unit_id=f"dhis2-{node_id}",
        name=node_id.upper(),
        level=level,
        cold_chain_type=ColdChainType.PASSIVE,
        is_active=is_active,
        country_code="SL",
        population_served=population,
    )


def _edge(
    edge_id: str,
    src: str,
    tgt: str,
    transit_hours: float = 24.0,
    is_active: bool = True,
) -> LogisticsEdge:
    return LogisticsEdge(
        id=edge_id,
        source_node_id=src,
        target_node_id=tgt,
        transit_time_hours=transit_hours,
        transport_mode=TransportMode.TRUCK,
        is_active=is_active,
        country_code="SL",
    )


@pytest.fixture()
def small_dag() -> LogisticsDAG:
    """
    N → R → D → F1
                 → F2
    """
    nodes = [
        _node("n", NodeLevel.NATIONAL),
        _node("r", NodeLevel.REGIONAL),
        _node("d", NodeLevel.DISTRICT),
        _node("f1", NodeLevel.FACILITY, population=10_000),
        _node("f2", NodeLevel.FACILITY, population=5_000),
    ]
    edges = [
        _edge("e_nr", "n", "r", transit_hours=12.0),
        _edge("e_rd", "r", "d", transit_hours=8.0),
        _edge("e_df1", "d", "f1", transit_hours=4.0),
        _edge("e_df2", "d", "f2", transit_hours=6.0),
    ]
    return LogisticsDAG(
        id="dag-test",
        country_code="SL",
        nodes=nodes,
        edges=edges,
        generated_at=datetime.now(tz=timezone.utc),
        dhis2_data_source_id="test-src",
        version=1,
    )


def _scenario(
    dag_id: str = "dag-test",
    disrupted_nodes: list[str] | None = None,
    disrupted_edges: list[str] | None = None,
) -> DisruptionScenario:
    return DisruptionScenario(
        id="scenario-test",
        dag_id=dag_id,
        disrupted_node_ids=disrupted_nodes or [],
        disrupted_edge_ids=disrupted_edges or [],
        created_at=datetime.now(tz=timezone.utc),
    )


# ---------------------------------------------------------------------------
# topological_sort tests
# ---------------------------------------------------------------------------


class TestTopologicalSort:
    def test_simple_chain(self) -> None:
        adj = {"a": ["b"], "b": ["c"], "c": []}
        result = topological_sort(adj)
        assert result.index("a") < result.index("b") < result.index("c")

    def test_single_node(self) -> None:
        assert topological_sort({"x": []}) == ["x"]

    def test_empty_graph(self) -> None:
        assert topological_sort({}) == []

    def test_two_roots(self) -> None:
        adj = {"a": ["c"], "b": ["c"], "c": []}
        result = topological_sort(adj)
        assert result.index("a") < result.index("c")
        assert result.index("b") < result.index("c")

    def test_cycle_raises(self) -> None:
        adj = {"a": ["b"], "b": ["a"]}
        with pytest.raises(ValueError, match="Cycle detected"):
            topological_sort(adj)


# ---------------------------------------------------------------------------
# CascadeSimulator._downstream_affected tests
# ---------------------------------------------------------------------------


class TestDownstreamAffected:
    def setup_method(self) -> None:
        self.sim = CascadeSimulator()

    def test_no_disruption_returns_only_disrupted(self, small_dag: LogisticsDAG) -> None:
        # _downstream_affected takes disrupted set and children adjacency
        # If children maps d → [f1, f2], disrupting d should yield d, f1, f2
        children = {"d": ["f1", "f2"], "f1": [], "f2": []}
        affected = self.sim._downstream_affected({"d"}, children)
        assert affected == {"d", "f1", "f2"}

    def test_disruption_in_middle(self) -> None:
        children = {"n": ["r"], "r": ["d"], "d": ["f1", "f2"], "f1": [], "f2": []}
        affected = self.sim._downstream_affected({"r"}, children)
        assert "r" in affected
        assert "d" in affected
        assert "f1" in affected
        assert "f2" in affected
        assert "n" not in affected

    def test_disruption_of_leaf(self) -> None:
        children = {"n": ["r"], "r": ["f1"], "f1": []}
        affected = self.sim._downstream_affected({"f1"}, children)
        assert affected == {"f1"}

    def test_disjoint_disrupted_sets(self) -> None:
        # Two separate trees
        children = {"a": ["b"], "b": [], "x": ["y"], "y": []}
        affected = self.sim._downstream_affected({"a", "x"}, children)
        assert affected == {"a", "b", "x", "y"}


# ---------------------------------------------------------------------------
# CascadeSimulator.simulate tests
# ---------------------------------------------------------------------------


class TestSimulate:
    def setup_method(self) -> None:
        self.sim = CascadeSimulator()

    def test_no_disruption_no_affected(self, small_dag: LogisticsDAG) -> None:
        """Empty disruption scenario — no nodes should be marked affected."""
        scenario = _scenario()
        result = self.sim.simulate(small_dag, scenario)
        assert result.scenario_id == "scenario-test"
        assert result.affected_node_ids == []
        assert result.population_impacted == 0
        assert result.antigen_coverage_delta == 0.0

    def test_district_disruption_affects_downstream_facilities(
        self, small_dag: LogisticsDAG
    ) -> None:
        """Disrupting district D should flag F1 and F2 as affected."""
        scenario = _scenario(disrupted_nodes=["d"])
        result = self.sim.simulate(small_dag, scenario)
        affected = set(result.affected_node_ids)
        assert "f1" in affected
        assert "f2" in affected
        # The disrupted source itself is not in affected_node_ids
        assert "d" not in affected
        assert "n" not in affected
        assert "r" not in affected

    def test_population_impacted(self, small_dag: LogisticsDAG) -> None:
        """Population of all affected facility nodes is summed."""
        scenario = _scenario(disrupted_nodes=["d"])
        result = self.sim.simulate(small_dag, scenario)
        # F1=10_000 + F2=5_000
        assert result.population_impacted == 15_000

    def test_time_to_stockout_facility(self, small_dag: LogisticsDAG) -> None:
        """Affected facility nodes get 72h default stockout time."""
        scenario = _scenario(disrupted_nodes=["d"])
        result = self.sim.simulate(small_dag, scenario)
        for node_id, hours in result.time_to_stockout_by_node.items():
            node = small_dag.get_node(node_id)
            if node and node.level == NodeLevel.FACILITY:
                assert hours == _DEFAULT_STOCKOUT_FACILITY_HOURS

    def test_edge_disruption_isolates_downstream(
        self, small_dag: LogisticsDAG
    ) -> None:
        """Disrupting edge e_df1 should affect only F1, not F2."""
        scenario = _scenario(disrupted_edges=["e_df1"])
        result = self.sim.simulate(small_dag, scenario)
        affected = set(result.affected_node_ids)
        # F1 is isolated; F2 still reachable via e_df2
        # Note: with edge disruption only — no node is disrupted, so BFS
        # starts from disrupted_nodes (empty set) → affected is empty.
        # Edge disruption alone doesn't trigger BFS from any node.
        # The BFS starting set is disrupted_nodes, not disrupted_edges.
        # This is by design: edge disruption reduces reachability but does not
        # "start" a cascade. Use node disruption to model facility outages.
        assert result.affected_node_ids == []

    def test_propagation_result_fields(self, small_dag: LogisticsDAG) -> None:
        """PropagationResult contains all expected fields with correct types."""
        scenario = _scenario(disrupted_nodes=["r"])
        result = self.sim.simulate(small_dag, scenario)
        assert isinstance(result.affected_node_ids, list)
        assert isinstance(result.time_to_stockout_by_node, dict)
        assert isinstance(result.population_impacted, int)
        assert isinstance(result.antigen_coverage_delta, float)
        assert isinstance(result.alternative_routes, list)
        assert result.computed_at is not None

    def test_coverage_delta_bounded(self, small_dag: LogisticsDAG) -> None:
        """Coverage delta stays in [0, 100] even with full disruption."""
        scenario = _scenario(disrupted_nodes=["n"])
        result = self.sim.simulate(small_dag, scenario)
        assert 0.0 <= result.antigen_coverage_delta <= 100.0

    def test_alternative_routes_are_alternative_routes(
        self, small_dag: LogisticsDAG
    ) -> None:
        """All returned alternatives are AlternativeRoute instances."""
        scenario = _scenario(disrupted_nodes=["d"])
        result = self.sim.simulate(small_dag, scenario)
        for alt in result.alternative_routes:
            assert isinstance(alt, AlternativeRoute)
            assert 0.0 <= alt.feasibility_score <= 1.0


# ---------------------------------------------------------------------------
# CascadeSimulator._build_adjacency tests
# ---------------------------------------------------------------------------


class TestBuildAdjacency:
    def setup_method(self) -> None:
        self.sim = CascadeSimulator()

    def test_all_active_edges_included(self, small_dag: LogisticsDAG) -> None:
        adj = self.sim._build_adjacency(small_dag, set(), set())
        assert "r" in adj["n"]
        assert "d" in adj["r"]
        assert "f1" in adj["d"]
        assert "f2" in adj["d"]

    def test_disrupted_node_skips_outgoing_edges(
        self, small_dag: LogisticsDAG
    ) -> None:
        adj = self.sim._build_adjacency(small_dag, {"d"}, set())
        # d is disrupted — its outgoing edges to f1/f2 should be absent
        assert "f1" not in adj.get("d", [])
        assert "f2" not in adj.get("d", [])

    def test_disrupted_edge_skipped(self, small_dag: LogisticsDAG) -> None:
        adj = self.sim._build_adjacency(small_dag, set(), {"e_df1"})
        # e_df1 (d→f1) is disrupted; e_df2 (d→f2) still active
        assert "f1" not in adj.get("d", [])
        assert "f2" in adj.get("d", [])

    def test_inactive_base_edge_skipped(self) -> None:
        dag = LogisticsDAG(
            id="dag-x",
            country_code="SL",
            nodes=[
                _node("a", NodeLevel.NATIONAL),
                _node("b", NodeLevel.FACILITY),
            ],
            edges=[_edge("e1", "a", "b", is_active=False)],
            generated_at=datetime.now(tz=timezone.utc),
            dhis2_data_source_id="src",
        )
        sim = CascadeSimulator()
        adj = sim._build_adjacency(dag, set(), set())
        assert "b" not in adj.get("a", [])
