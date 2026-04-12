"""Unit tests for the OpenLMIS data mapper."""

from __future__ import annotations

import pytest

from app.integrations.openlmis.mapper import OpenLMISMapper, OpenLMISMappingConfig


@pytest.fixture
def mapping():
    return OpenLMISMappingConfig(
        {
            "country_code": "TZ",
            "epi_program_id": "epi-program-uuid",
            "geographic_zone_level_facility": 4,
            "orderable_mappings": {
                "bcg-orderable-id": {"vaxai_field": "stock_on_hand", "vaccine_type": "BCG"},
                "penta-orderable-id": {"vaxai_field": "stock_on_hand", "vaccine_type": "Penta"},
                "bcg-consumed-id": {"vaxai_field": "consumed", "vaccine_type": "BCG"},
                "bcg-wastage-id": {"vaxai_field": "wastage", "vaccine_type": "BCG"},
            },
        }
    )


@pytest.fixture
def mapper(mapping):
    return OpenLMISMapper(mapping)


class TestOpenLMISMappingConfig:
    def test_resolve_known_orderable(self, mapping):
        result = mapping.resolve("bcg-orderable-id")
        assert result is not None
        assert result["vaxai_field"] == "stock_on_hand"

    def test_resolve_unknown_orderable_returns_none(self, mapping):
        assert mapping.resolve("unknown-id") is None

    def test_country_code(self, mapping):
        assert mapping.country_code == "TZ"

    def test_default_config_loads(self):
        config = OpenLMISMappingConfig.default()
        assert config.country_code


class TestMapFacilities:
    def test_maps_facility_with_location(self, mapper):
        facilities = [
            {
                "id": "fac-uuid-1",
                "name": "Muhimbili Hospital",
                "code": "MH-001",
                "active": True,
                "type": {"name": "District Hospital"},
                "geographicZone": {"id": "gz-1", "name": "Dar es Salaam"},
                "location": {"latitude": -6.8, "longitude": 39.28},
            }
        ]
        result = mapper.map_facilities(facilities)
        assert len(result) == 1
        fac = result[0]
        assert fac["openlmis_id"] == "fac-uuid-1"
        assert fac["name"] == "Muhimbili Hospital"
        assert fac["code"] == "MH-001"
        assert fac["facility_type"] == "District Hospital"
        assert fac["country"] == "TZ"
        assert fac["lat"] == pytest.approx(-6.8)
        assert fac["lng"] == pytest.approx(39.28)

    def test_maps_facility_without_coordinates(self, mapper):
        facilities = [{"id": "fac-2", "name": "No Coords", "code": "NC-01"}]
        result = mapper.map_facilities(facilities)
        assert result[0]["lat"] is None
        assert result[0]["lng"] is None

    def test_maps_facility_with_geo_zone_coordinates(self, mapper):
        facilities = [
            {
                "id": "fac-3",
                "name": "Zone Coords Facility",
                "code": "ZC-01",
                "geographicZone": {
                    "id": "gz-2",
                    "name": "Mwanza",
                    "latitude": -2.52,
                    "longitude": 32.9,
                },
            }
        ]
        result = mapper.map_facilities(facilities)
        assert result[0]["lat"] == pytest.approx(-2.52)
        assert result[0]["lng"] == pytest.approx(32.9)

    def test_inactive_facility(self, mapper):
        facilities = [
            {"id": "fac-4", "name": "Closed", "code": "CL-01", "active": False}
        ]
        result = mapper.map_facilities(facilities)
        assert result[0]["active"] is False


class TestMapStockCardSummaries:
    def test_maps_stock_on_hand_to_inventory(self, mapper):
        summaries = [
            {
                "orderable": {"id": "bcg-orderable-id", "fullProductName": "BCG Vaccine"},
                "facility": {"id": "fac-1"},
                "stockOnHand": 500,
            }
        ]
        result = mapper.map_stock_card_summaries(summaries)
        assert len(result["inventory"]) == 1
        inv = result["inventory"][0]
        assert inv["transaction_type"] == "adjustment"
        assert inv["quantity"] == 500.0
        assert inv["vaccine_type"] == "BCG"
        assert inv["source"] == "openlmis"

    def test_maps_consumed_to_inventory(self, mapper):
        summaries = [
            {
                "orderable": {"id": "bcg-consumed-id", "fullProductName": "BCG Consumed"},
                "facility": {"id": "fac-1"},
                "stockOnHand": 120,
            }
        ]
        result = mapper.map_stock_card_summaries(summaries)
        assert len(result["inventory"]) == 1
        assert result["inventory"][0]["transaction_type"] == "issue"

    def test_maps_wastage_to_inventory(self, mapper):
        summaries = [
            {
                "orderable": {"id": "bcg-wastage-id"},
                "facility": {"id": "fac-1"},
                "stockOnHand": 12,
            }
        ]
        result = mapper.map_stock_card_summaries(summaries)
        assert len(result["inventory"]) == 1
        assert result["inventory"][0]["transaction_type"] == "wastage"

    def test_unmapped_items_go_to_unmapped(self, mapper):
        summaries = [
            {
                "orderable": {"id": "unknown-orderable"},
                "facility": {"id": "fac-1"},
                "stockOnHand": 100,
            }
        ]
        result = mapper.map_stock_card_summaries(summaries)
        assert len(result["unmapped"]) == 1
        assert len(result["inventory"]) == 0

    def test_mixed_summaries(self, mapper):
        summaries = [
            {
                "orderable": {"id": "bcg-orderable-id"},
                "facility": {"id": "fac-1"},
                "stockOnHand": 100,
            },
            {
                "orderable": {"id": "bcg-consumed-id"},
                "facility": {"id": "fac-1"},
                "stockOnHand": 50,
            },
            {
                "orderable": {"id": "unknown"},
                "facility": {"id": "fac-1"},
                "stockOnHand": 25,
            },
        ]
        result = mapper.map_stock_card_summaries(summaries)
        assert len(result["inventory"]) == 2
        assert len(result["unmapped"]) == 1


class TestMapRequisitions:
    def test_maps_requisition_line_items(self, mapper):
        requisitions = [
            {
                "facility": {"id": "fac-1"},
                "processingPeriod": {"name": "Jan 2025"},
                "requisitionLineItems": [
                    {
                        "orderable": {"id": "bcg-orderable-id", "fullProductName": "BCG Vaccine"},
                        "totalConsumedQuantity": 200,
                        "stockOnHand": 300,
                        "requestedQuantity": 500,
                    }
                ],
            }
        ]
        result = mapper.map_requisitions(requisitions)
        assert len(result["usage"]) == 1
        usage = result["usage"][0]
        assert usage["quantity_consumed"] == 200.0
        assert usage["stock_on_hand"] == 300.0
        assert usage["quantity_requested"] == 500.0
        assert usage["vaccine_type"] == "BCG"
        assert usage["source"] == "openlmis"
        assert usage["period"] == "Jan 2025"

    def test_unmapped_requisition_lines(self, mapper):
        requisitions = [
            {
                "facility": {"id": "fac-1"},
                "processingPeriod": {"name": "Jan 2025"},
                "requisitionLineItems": [
                    {"orderable": {"id": "unknown-id"}, "totalConsumedQuantity": 10}
                ],
            }
        ]
        result = mapper.map_requisitions(requisitions)
        assert len(result["unmapped"]) == 1
        assert len(result["usage"]) == 0

    def test_non_numeric_values_default_to_zero(self, mapper):
        requisitions = [
            {
                "facility": {"id": "fac-1"},
                "processingPeriod": {"name": "Feb 2025"},
                "requisitionLineItems": [
                    {
                        "orderable": {"id": "bcg-orderable-id"},
                        "totalConsumedQuantity": "N/A",
                    }
                ],
            }
        ]
        result = mapper.map_requisitions(requisitions)
        assert result["usage"][0]["quantity_consumed"] == 0.0

    def test_empty_requisition_line_items(self, mapper):
        requisitions = [
            {
                "facility": {"id": "fac-1"},
                "processingPeriod": {"name": "Mar 2025"},
                "requisitionLineItems": [],
            }
        ]
        result = mapper.map_requisitions(requisitions)
        assert len(result["usage"]) == 0
        assert len(result["unmapped"]) == 0


class TestHelpers:
    def test_safe_float_with_valid_number(self):
        assert OpenLMISMapper._safe_float("123.45") == pytest.approx(123.45)

    def test_safe_float_with_none(self):
        assert OpenLMISMapper._safe_float(None) == 0.0

    def test_safe_float_with_invalid_string(self):
        assert OpenLMISMapper._safe_float("N/A") == 0.0

    def test_extract_coordinates_with_location(self):
        fac = {"location": {"latitude": "-6.8", "longitude": "39.28"}}
        lat, lng = OpenLMISMapper._extract_coordinates(fac)
        assert lat == pytest.approx(-6.8)
        assert lng == pytest.approx(39.28)

    def test_extract_coordinates_with_geo_zone(self):
        fac = {"geographicZone": {"latitude": -2.52, "longitude": 32.9}}
        lat, lng = OpenLMISMapper._extract_coordinates(fac)
        assert lat == pytest.approx(-2.52)
        assert lng == pytest.approx(32.9)

    def test_extract_coordinates_missing(self):
        lat, lng = OpenLMISMapper._extract_coordinates({})
        assert lat is None
        assert lng is None
