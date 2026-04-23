"""Unit tests for DHISRouteAdapter._ou_to_node and _derive_edges.

These tests exercise the pure mapping logic without any HTTP or DB calls.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.logistics import (
    ColdChainType,
    LogisticsEdge,
    LogisticsNode,
    NodeLevel,
    TransportMode,
)
from app.services.dag_builder import DHISRouteAdapter, _DEFAULT_RELIABILITY, _DEFAULT_TRANSIT_HOURS


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def adapter() -> DHISRouteAdapter:
    """Return a DHISRouteAdapter backed by a mock DHIS2 client."""
    mock_client = MagicMock()
    return DHISRouteAdapter(mock_client, data_source_id="test-source")


def _make_id_map(*dhis2_ids: str) -> dict[str, str]:
    """Build a minimal dhis2_to_internal map with stable deterministic UUIDs."""
    return {did: f"internal-{did}" for did in dhis2_ids}


# ---------------------------------------------------------------------------
# _ou_to_node tests
# ---------------------------------------------------------------------------


class TestOuToNode:
    def test_maps_level_national(self, adapter: DHISRouteAdapter) -> None:
        ou = {"id": "nat001", "name": "Sierra Leone", "level": 1}
        id_map = _make_id_map("nat001")
        node = adapter._ou_to_node(ou, id_map, "SL")
        assert node.level == NodeLevel.NATIONAL

    def test_maps_level_regional(self, adapter: DHISRouteAdapter) -> None:
        ou = {"id": "reg001", "name": "Northern Province", "level": 2}
        id_map = _make_id_map("reg001")
        node = adapter._ou_to_node(ou, id_map, "SL")
        assert node.level == NodeLevel.REGIONAL

    def test_maps_level_district(self, adapter: DHISRouteAdapter) -> None:
        ou = {"id": "dis001", "name": "Port Loko", "level": 3}
        id_map = _make_id_map("dis001")
        node = adapter._ou_to_node(ou, id_map, "SL")
        assert node.level == NodeLevel.DISTRICT

    def test_maps_level_facility(self, adapter: DHISRouteAdapter) -> None:
        ou = {"id": "fac001", "name": "Gbendembu CHC", "level": 4}
        id_map = _make_id_map("fac001")
        node = adapter._ou_to_node(ou, id_map, "SL")
        assert node.level == NodeLevel.FACILITY

    def test_unknown_level_defaults_to_facility(self, adapter: DHISRouteAdapter) -> None:
        ou = {"id": "unk001", "name": "Unknown", "level": 9}
        id_map = _make_id_map("unk001")
        node = adapter._ou_to_node(ou, id_map, "SL")
        assert node.level == NodeLevel.FACILITY

    def test_internal_id_from_map(self, adapter: DHISRouteAdapter) -> None:
        ou = {"id": "fac002", "name": "Test Facility", "level": 4}
        id_map = {"fac002": "fixed-uuid-1234"}
        node = adapter._ou_to_node(ou, id_map, "SL")
        assert node.id == "fixed-uuid-1234"

    def test_dhis2_id_preserved(self, adapter: DHISRouteAdapter) -> None:
        ou = {"id": "O6uvpzGd5pu", "name": "Sierra Leone", "level": 1}
        id_map = _make_id_map("O6uvpzGd5pu")
        node = adapter._ou_to_node(ou, id_map, "SL")
        assert node.dhis2_org_unit_id == "O6uvpzGd5pu"

    def test_country_code_set(self, adapter: DHISRouteAdapter) -> None:
        ou = {"id": "nat001", "name": "Sierra Leone", "level": 1}
        id_map = _make_id_map("nat001")
        node = adapter._ou_to_node(ou, id_map, "SL")
        assert node.country_code == "SL"

    def test_default_cold_chain_type_passive(self, adapter: DHISRouteAdapter) -> None:
        ou = {"id": "fac001", "name": "Facility", "level": 4}
        id_map = _make_id_map("fac001")
        node = adapter._ou_to_node(ou, id_map, "SL")
        assert node.cold_chain_type == ColdChainType.PASSIVE

    def test_is_active_default_true(self, adapter: DHISRouteAdapter) -> None:
        ou = {"id": "fac001", "name": "Facility", "level": 4}
        id_map = _make_id_map("fac001")
        node = adapter._ou_to_node(ou, id_map, "SL")
        assert node.is_active is True

    def test_geojson_point_coordinates(self, adapter: DHISRouteAdapter) -> None:
        ou = {
            "id": "fac001",
            "name": "Facility",
            "level": 4,
            "geometry": {"type": "Point", "coordinates": [-11.78, 8.46]},
        }
        id_map = _make_id_map("fac001")
        node = adapter._ou_to_node(ou, id_map, "SL")
        assert node.lat == pytest.approx(8.46)
        assert node.lng == pytest.approx(-11.78)

    def test_legacy_coordinate_string(self, adapter: DHISRouteAdapter) -> None:
        ou = {
            "id": "fac001",
            "name": "Facility",
            "level": 4,
            "coordinates": "[-11.78, 8.46]",
        }
        id_map = _make_id_map("fac001")
        node = adapter._ou_to_node(ou, id_map, "SL")
        assert node.lat == pytest.approx(8.46)
        assert node.lng == pytest.approx(-11.78)

    def test_missing_coordinates_returns_none(self, adapter: DHISRouteAdapter) -> None:
        ou = {"id": "fac001", "name": "Facility", "level": 4}
        id_map = _make_id_map("fac001")
        node = adapter._ou_to_node(ou, id_map, "SL")
        assert node.lat is None
        assert node.lng is None

    def test_polygon_geometry_returns_none_coords(self, adapter: DHISRouteAdapter) -> None:
        ou = {
            "id": "nat001",
            "name": "SL",
            "level": 1,
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[-11.0, 8.0], [-11.5, 8.5], [-11.0, 8.0]]],
            },
        }
        id_map = _make_id_map("nat001")
        node = adapter._ou_to_node(ou, id_map, "SL")
        assert node.lat is None
        assert node.lng is None

    def test_returns_logistics_node_type(self, adapter: DHISRouteAdapter) -> None:
        ou = {"id": "nat001", "name": "Sierra Leone", "level": 1}
        id_map = _make_id_map("nat001")
        node = adapter._ou_to_node(ou, id_map, "SL")
        assert isinstance(node, LogisticsNode)


# ---------------------------------------------------------------------------
# _derive_edges tests
# ---------------------------------------------------------------------------


class TestDeriveEdges:
    def test_single_parent_child_creates_one_edge(
        self, adapter: DHISRouteAdapter
    ) -> None:
        raw_ous = [
            {"id": "nat001", "name": "SL", "level": 1},
            {"id": "reg001", "name": "Northern", "level": 2, "parent": {"id": "nat001"}},
        ]
        id_map = _make_id_map("nat001", "reg001")
        edges = adapter._derive_edges(raw_ous, id_map, "SL")
        assert len(edges) == 1

    def test_edge_direction_source_is_parent(
        self, adapter: DHISRouteAdapter
    ) -> None:
        raw_ous = [
            {"id": "nat001", "name": "SL", "level": 1},
            {"id": "reg001", "name": "Northern", "level": 2, "parent": {"id": "nat001"}},
        ]
        id_map = _make_id_map("nat001", "reg001")
        edges = adapter._derive_edges(raw_ous, id_map, "SL")
        assert edges[0].source_node_id == id_map["nat001"]
        assert edges[0].target_node_id == id_map["reg001"]

    def test_no_edges_when_no_parents(self, adapter: DHISRouteAdapter) -> None:
        raw_ous = [
            {"id": "nat001", "name": "SL", "level": 1},
        ]
        id_map = _make_id_map("nat001")
        edges = adapter._derive_edges(raw_ous, id_map, "SL")
        assert edges == []

    def test_skips_missing_parent_not_in_map(
        self, adapter: DHISRouteAdapter
    ) -> None:
        raw_ous = [
            {"id": "reg001", "name": "Northern", "level": 2, "parent": {"id": "ghost001"}},
        ]
        id_map = _make_id_map("reg001")
        edges = adapter._derive_edges(raw_ous, id_map, "SL")
        assert edges == []

    def test_multi_level_hierarchy(self, adapter: DHISRouteAdapter) -> None:
        raw_ous = [
            {"id": "nat001", "name": "SL", "level": 1},
            {"id": "reg001", "name": "Northern", "level": 2, "parent": {"id": "nat001"}},
            {"id": "dis001", "name": "Port Loko", "level": 3, "parent": {"id": "reg001"}},
            {"id": "fac001", "name": "Gbendembu", "level": 4, "parent": {"id": "dis001"}},
        ]
        id_map = _make_id_map("nat001", "reg001", "dis001", "fac001")
        edges = adapter._derive_edges(raw_ous, id_map, "SL")
        # nat→reg, reg→dis, dis→fac
        assert len(edges) == 3

    def test_default_transit_time(self, adapter: DHISRouteAdapter) -> None:
        raw_ous = [
            {"id": "nat001", "name": "SL", "level": 1},
            {"id": "reg001", "name": "Northern", "level": 2, "parent": {"id": "nat001"}},
        ]
        id_map = _make_id_map("nat001", "reg001")
        edges = adapter._derive_edges(raw_ous, id_map, "SL")
        assert edges[0].transit_time_hours == _DEFAULT_TRANSIT_HOURS

    def test_default_reliability(self, adapter: DHISRouteAdapter) -> None:
        raw_ous = [
            {"id": "nat001", "name": "SL", "level": 1},
            {"id": "reg001", "name": "Northern", "level": 2, "parent": {"id": "nat001"}},
        ]
        id_map = _make_id_map("nat001", "reg001")
        edges = adapter._derive_edges(raw_ous, id_map, "SL")
        assert edges[0].reliability_score == _DEFAULT_RELIABILITY

    def test_default_transport_mode_truck(self, adapter: DHISRouteAdapter) -> None:
        raw_ous = [
            {"id": "nat001", "name": "SL", "level": 1},
            {"id": "reg001", "name": "Northern", "level": 2, "parent": {"id": "nat001"}},
        ]
        id_map = _make_id_map("nat001", "reg001")
        edges = adapter._derive_edges(raw_ous, id_map, "SL")
        assert edges[0].transport_mode == TransportMode.TRUCK

    def test_edge_is_active_by_default(self, adapter: DHISRouteAdapter) -> None:
        raw_ous = [
            {"id": "nat001", "name": "SL", "level": 1},
            {"id": "reg001", "name": "Northern", "level": 2, "parent": {"id": "nat001"}},
        ]
        id_map = _make_id_map("nat001", "reg001")
        edges = adapter._derive_edges(raw_ous, id_map, "SL")
        assert edges[0].is_active is True

    def test_edge_country_code(self, adapter: DHISRouteAdapter) -> None:
        raw_ous = [
            {"id": "nat001", "name": "SL", "level": 1},
            {"id": "reg001", "name": "Northern", "level": 2, "parent": {"id": "nat001"}},
        ]
        id_map = _make_id_map("nat001", "reg001")
        edges = adapter._derive_edges(raw_ous, id_map, "SL")
        assert edges[0].country_code == "SL"

    def test_returns_logistics_edge_instances(
        self, adapter: DHISRouteAdapter
    ) -> None:
        raw_ous = [
            {"id": "nat001", "name": "SL", "level": 1},
            {"id": "reg001", "name": "Northern", "level": 2, "parent": {"id": "nat001"}},
        ]
        id_map = _make_id_map("nat001", "reg001")
        edges = adapter._derive_edges(raw_ous, id_map, "SL")
        for edge in edges:
            assert isinstance(edge, LogisticsEdge)

    def test_multiple_children_same_parent(self, adapter: DHISRouteAdapter) -> None:
        raw_ous = [
            {"id": "nat001", "name": "SL", "level": 1},
            {"id": "reg001", "name": "Northern", "level": 2, "parent": {"id": "nat001"}},
            {"id": "reg002", "name": "Southern", "level": 2, "parent": {"id": "nat001"}},
            {"id": "reg003", "name": "Eastern", "level": 2, "parent": {"id": "nat001"}},
        ]
        id_map = _make_id_map("nat001", "reg001", "reg002", "reg003")
        edges = adapter._derive_edges(raw_ous, id_map, "SL")
        assert len(edges) == 3
        sources = {e.source_node_id for e in edges}
        assert sources == {id_map["nat001"]}

    def test_empty_input_returns_empty(self, adapter: DHISRouteAdapter) -> None:
        edges = adapter._derive_edges([], {}, "SL")
        assert edges == []
