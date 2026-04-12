"""Unit tests for the mSupply data mapper."""

from __future__ import annotations

import pytest

from app.integrations.msupply.mapper import MSupplyMapper, MSupplyMappingConfig


@pytest.fixture
def mapping():
    return MSupplyMappingConfig(
        {
            "country_code": "SL",
            "store_type_facility": "facility",
            "store_type_warehouse": "warehouse",
            "item_mappings": {
                "BCG_VAX": {"vaxai_field": "stock_on_hand", "vaccine_type": "BCG"},
                "PENTA_VAX": {"vaxai_field": "stock_on_hand", "vaccine_type": "Penta"},
                "BCG_USED": {"vaxai_field": "consumed", "vaccine_type": "BCG"},
                "BCG_WASTE": {"vaxai_field": "wastage", "vaccine_type": "BCG"},
            },
        }
    )


@pytest.fixture
def mapper(mapping):
    return MSupplyMapper(mapping)


class TestMSupplyMappingConfig:
    def test_resolve_known_item(self, mapping):
        result = mapping.resolve("BCG_VAX")
        assert result is not None
        assert result["vaxai_field"] == "stock_on_hand"

    def test_resolve_unknown_item_returns_none(self, mapping):
        assert mapping.resolve("UNKNOWN_ITEM") is None

    def test_country_code(self, mapping):
        assert mapping.country_code == "SL"

    def test_default_config_loads(self):
        config = MSupplyMappingConfig.default()
        assert config.country_code


class TestMapStores:
    def test_maps_store_with_coordinates(self, mapper):
        stores = [
            {
                "id": "STORE1",
                "name": "Kailahun Warehouse",
                "code": "KL-WH-01",
                "type": "warehouse",
                "latitude": 8.28,
                "longitude": -11.19,
            }
        ]
        result = mapper.map_stores(stores)
        assert len(result) == 1
        fac = result[0]
        assert fac["msupply_id"] == "STORE1"
        assert fac["name"] == "Kailahun Warehouse"
        assert fac["code"] == "KL-WH-01"
        assert fac["country"] == "SL"
        assert fac["lat"] == pytest.approx(8.28)
        assert fac["lng"] == pytest.approx(-11.19)

    def test_maps_store_without_coordinates(self, mapper):
        stores = [{"id": "STORE2", "name": "No Coords", "code": "NC-01"}]
        result = mapper.map_stores(stores)
        assert result[0]["lat"] is None
        assert result[0]["lng"] is None

    def test_maps_store_with_name_1_fallback(self, mapper):
        stores = [{"id": "S3", "name_1": "Fallback Name", "code": "FB"}]
        result = mapper.map_stores(stores)
        assert result[0]["name"] == "Fallback Name"


class TestMapStockLines:
    def test_maps_stock_on_hand_to_inventory(self, mapper):
        lines = [
            {
                "item_code": "BCG_VAX",
                "store_id": "STORE1",
                "batch": "B001",
                "expiry_date": "2025-06-30",
                "available_number_of_packs": 500,
            }
        ]
        result = mapper.map_stock_lines(lines)
        assert len(result["inventory"]) == 1
        inv = result["inventory"][0]
        assert inv["transaction_type"] == "adjustment"
        assert inv["quantity"] == 500.0
        assert inv["vaccine_type"] == "BCG"
        assert inv["batch"] == "B001"

    def test_maps_consumed_to_inventory(self, mapper):
        lines = [
            {
                "item_code": "BCG_USED",
                "store_id": "STORE1",
                "available_number_of_packs": 120,
            }
        ]
        result = mapper.map_stock_lines(lines)
        assert len(result["inventory"]) == 1
        assert result["inventory"][0]["transaction_type"] == "issue"

    def test_maps_wastage_to_inventory(self, mapper):
        lines = [
            {
                "item_code": "BCG_WASTE",
                "store_id": "STORE1",
                "available_number_of_packs": 12,
            }
        ]
        result = mapper.map_stock_lines(lines)
        assert len(result["inventory"]) == 1
        assert result["inventory"][0]["transaction_type"] == "wastage"

    def test_unmapped_items_go_to_unmapped(self, mapper):
        lines = [{"item_code": "UNKNOWN", "store_id": "STORE1"}]
        result = mapper.map_stock_lines(lines)
        assert len(result["unmapped"]) == 1
        assert len(result["inventory"]) == 0

    def test_mixed_stock_lines(self, mapper):
        lines = [
            {"item_code": "BCG_VAX", "store_id": "S1", "available_number_of_packs": 100},
            {"item_code": "BCG_USED", "store_id": "S1", "available_number_of_packs": 50},
            {"item_code": "UNKNOWN", "store_id": "S1"},
        ]
        result = mapper.map_stock_lines(lines)
        assert len(result["inventory"]) == 2
        assert len(result["unmapped"]) == 1


class TestMapRequisitions:
    def test_maps_requisition_lines(self, mapper):
        lines = [
            {
                "item_code": "BCG_VAX",
                "store_id": "STORE1",
                "actual_consumption": 200,
                "stock_on_hand": 300,
                "requested_quantity": 500,
            }
        ]
        result = mapper.map_requisitions(lines)
        assert len(result["usage"]) == 1
        usage = result["usage"][0]
        assert usage["quantity_consumed"] == 200.0
        assert usage["stock_on_hand"] == 300.0
        assert usage["quantity_requested"] == 500.0
        assert usage["vaccine_type"] == "BCG"
        assert usage["source"] == "msupply"

    def test_unmapped_requisition_lines(self, mapper):
        lines = [{"item_code": "UNKNOWN", "store_id": "S1"}]
        result = mapper.map_requisitions(lines)
        assert len(result["unmapped"]) == 1
        assert len(result["usage"]) == 0

    def test_non_numeric_values_default_to_zero(self, mapper):
        lines = [
            {
                "item_code": "BCG_VAX",
                "store_id": "S1",
                "actual_consumption": "N/A",
            }
        ]
        result = mapper.map_requisitions(lines)
        assert result["usage"][0]["quantity_consumed"] == 0.0


class TestHelpers:
    def test_safe_float_with_valid_number(self):
        assert MSupplyMapper._safe_float("123.45") == pytest.approx(123.45)

    def test_safe_float_with_none(self):
        assert MSupplyMapper._safe_float(None) == 0.0

    def test_safe_float_with_invalid_string(self):
        assert MSupplyMapper._safe_float("N/A") == 0.0

    def test_extract_coordinates_with_lat_lng(self):
        store = {"latitude": "8.28", "longitude": "-11.19"}
        lat, lng = MSupplyMapper._extract_coordinates(store)
        assert lat == pytest.approx(8.28)
        assert lng == pytest.approx(-11.19)

    def test_extract_coordinates_missing(self):
        lat, lng = MSupplyMapper._extract_coordinates({})
        assert lat is None
        assert lng is None
