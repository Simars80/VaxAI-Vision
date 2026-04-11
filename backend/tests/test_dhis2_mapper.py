"""Unit tests for the DHIS2 data mapper."""

from __future__ import annotations

import pytest

from app.integrations.dhis2.mapper import DHIS2Mapper, MappingConfig


@pytest.fixture
def mapping():
    return MappingConfig(
        {
            "country_code": "SL",
            "org_unit_level_facility": 4,
            "data_elements": {
                "DE_BCG": {"vaxai_field": "doses_administered", "vaccine_type": "BCG"},
                "DE_STOCK": {"vaxai_field": "stock_on_hand", "vaccine_type": "BCG"},
                "DE_WASTE": {"vaxai_field": "wastage", "vaccine_type": "Penta3"},
                "DE_TARGET": {"vaxai_field": "target_population", "vaccine_type": "all"},
            },
        }
    )


@pytest.fixture
def mapper(mapping):
    return DHIS2Mapper(mapping)


class TestMappingConfig:
    def test_resolve_known_element(self, mapping):
        result = mapping.resolve("DE_BCG")
        assert result is not None
        assert result["vaxai_field"] == "doses_administered"

    def test_resolve_unknown_element_returns_none(self, mapping):
        assert mapping.resolve("UNKNOWN") is None

    def test_country_code(self, mapping):
        assert mapping.country_code == "SL"

    def test_default_config_loads(self):
        config = MappingConfig.default()
        assert config.country_code  # should have a default


class TestMapOrganisationUnits:
    def test_maps_units_with_geometry(self, mapper):
        units = [
            {
                "id": "OU1",
                "displayName": "Kailahun Hospital",
                "level": 4,
                "geometry": {"type": "Point", "coordinates": [-11.19, 8.28]},
                "parent": {"id": "P1", "displayName": "Kailahun District"},
            }
        ]
        result = mapper.map_organisation_units(units)
        assert len(result) == 1
        fac = result[0]
        assert fac["dhis2_id"] == "OU1"
        assert fac["name"] == "Kailahun Hospital"
        assert fac["lat"] == pytest.approx(8.28)
        assert fac["lng"] == pytest.approx(-11.19)
        assert fac["country"] == "SL"
        assert fac["parent_name"] == "Kailahun District"

    def test_maps_units_with_legacy_coordinates(self, mapper):
        units = [
            {
                "id": "OU2",
                "displayName": "Bo Clinic",
                "level": 4,
                "coordinates": "[-11.74, 7.97]",
                "parent": None,
            }
        ]
        result = mapper.map_organisation_units(units)
        assert result[0]["lat"] == pytest.approx(7.97)
        assert result[0]["lng"] == pytest.approx(-11.74)

    def test_maps_units_without_coordinates(self, mapper):
        units = [{"id": "OU3", "displayName": "No Coords", "level": 3}]
        result = mapper.map_organisation_units(units)
        assert result[0]["lat"] is None
        assert result[0]["lng"] is None


class TestMapDataValues:
    def test_maps_doses_to_coverage(self, mapper):
        data_values = [
            {"dataElement": "DE_BCG", "period": "202401", "orgUnit": "OU1", "value": "150"},
        ]
        result = mapper.map_data_values(data_values)
        assert len(result["coverage"]) == 1
        assert result["coverage"][0]["field"] == "doses_administered"
        assert result["coverage"][0]["value"] == 150.0
        assert result["coverage"][0]["vaccine_type"] == "BCG"

    def test_maps_stock_to_inventory(self, mapper):
        data_values = [
            {"dataElement": "DE_STOCK", "period": "202401", "orgUnit": "OU1", "value": "500"},
        ]
        result = mapper.map_data_values(data_values)
        assert len(result["inventory"]) == 1
        assert result["inventory"][0]["transaction_type"] == "adjustment"
        assert result["inventory"][0]["quantity"] == 500.0

    def test_maps_wastage_to_inventory(self, mapper):
        data_values = [
            {"dataElement": "DE_WASTE", "period": "202401", "orgUnit": "OU1", "value": "12"},
        ]
        result = mapper.map_data_values(data_values)
        assert len(result["inventory"]) == 1
        assert result["inventory"][0]["transaction_type"] == "wastage"

    def test_maps_target_population_to_coverage(self, mapper):
        data_values = [
            {"dataElement": "DE_TARGET", "period": "202401", "orgUnit": "OU1", "value": "10000"},
        ]
        result = mapper.map_data_values(data_values)
        assert len(result["coverage"]) == 1
        assert result["coverage"][0]["field"] == "target_population"

    def test_unmapped_elements_go_to_unmapped(self, mapper):
        data_values = [
            {"dataElement": "UNKNOWN_DE", "period": "202401", "orgUnit": "OU1", "value": "99"},
        ]
        result = mapper.map_data_values(data_values)
        assert len(result["unmapped"]) == 1
        assert len(result["inventory"]) == 0
        assert len(result["coverage"]) == 0

    def test_mixed_data_values(self, mapper):
        data_values = [
            {"dataElement": "DE_BCG", "period": "202401", "orgUnit": "OU1", "value": "100"},
            {"dataElement": "DE_STOCK", "period": "202401", "orgUnit": "OU1", "value": "500"},
            {"dataElement": "UNKNOWN", "period": "202401", "orgUnit": "OU1", "value": "1"},
        ]
        result = mapper.map_data_values(data_values)
        assert len(result["coverage"]) == 1
        assert len(result["inventory"]) == 1
        assert len(result["unmapped"]) == 1

    def test_non_numeric_value_defaults_to_zero(self, mapper):
        data_values = [
            {"dataElement": "DE_BCG", "period": "202401", "orgUnit": "OU1", "value": "N/A"},
        ]
        result = mapper.map_data_values(data_values)
        assert result["coverage"][0]["value"] == 0.0


class TestMapAnalytics:
    def test_maps_analytics_rows(self, mapper):
        analytics = {
            "headers": [
                {"name": "dx", "column": "Data"},
                {"name": "pe", "column": "Period"},
                {"name": "ou", "column": "Organisation unit"},
                {"name": "value", "column": "Value"},
            ],
            "rows": [
                ["DE_BCG", "202401", "OU1", "250"],
                ["DE_STOCK", "202401", "OU1", "1000"],
            ],
            "metaData": {
                "items": {
                    "DE_BCG": {"name": "BCG doses"},
                    "DE_STOCK": {"name": "BCG stock"},
                    "OU1": {"name": "Kailahun Hospital"},
                }
            },
        }
        result = mapper.map_analytics(analytics)
        assert len(result) == 2
        assert result[0]["value"] == 250.0
        assert result[0]["data_element_name"] == "BCG doses"
        assert result[0]["org_unit_name"] == "Kailahun Hospital"
        assert result[0]["vaxai_field"] == "doses_administered"

    def test_empty_analytics(self, mapper):
        assert mapper.map_analytics({"headers": [], "rows": []}) == []
