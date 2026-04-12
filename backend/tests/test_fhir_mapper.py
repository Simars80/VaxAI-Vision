"""Unit tests for the FHIR R4 data mapper."""

from __future__ import annotations

import pytest

from app.integrations.fhir.mapper import FHIRMapper, FHIRMappingConfig


@pytest.fixture
def mapping():
    return FHIRMappingConfig(
        {
            "country_code": "KE",
            "vaccine_code_system": "http://hl7.org/fhir/sid/cvx",
            "vaccine_code_mappings": {
                "19": {"vaccine_type": "BCG"},
                "02": {"vaccine_type": "OPV"},
                "104": {"vaccine_type": "Penta"},
            },
            "device_type_codes": {
                "refrigerator": "Cold chain refrigerator",
            },
            "supply_item_code_system": "http://snomed.info/sct",
        }
    )


@pytest.fixture
def mapper(mapping):
    return FHIRMapper(mapping)


class TestFHIRMappingConfig:
    def test_resolve_known_vaccine(self, mapping):
        result = mapping.resolve_vaccine("19")
        assert result is not None
        assert result["vaccine_type"] == "BCG"

    def test_resolve_unknown_vaccine_returns_none(self, mapping):
        assert mapping.resolve_vaccine("999") is None

    def test_country_code(self, mapping):
        assert mapping.country_code == "KE"

    def test_default_config_loads(self):
        config = FHIRMappingConfig.default()
        assert config.country_code


class TestMapLocations:
    def test_maps_location_with_position(self, mapper):
        locations = [
            {
                "id": "loc-001",
                "name": "Kenyatta National Hospital",
                "status": "active",
                "type": [
                    {
                        "coding": [{"code": "HOSP", "display": "Hospital"}],
                    }
                ],
                "position": {"latitude": -1.3, "longitude": 36.82},
                "managingOrganization": {"display": "Ministry of Health"},
                "partOf": {"reference": "Location/loc-district-1", "display": "Nairobi"},
                "address": {
                    "line": ["Hospital Road"],
                    "city": "Nairobi",
                    "state": "Nairobi County",
                    "country": "KE",
                },
            }
        ]
        result = mapper.map_locations(locations)
        assert len(result) == 1
        fac = result[0]
        assert fac["fhir_id"] == "loc-001"
        assert fac["name"] == "Kenyatta National Hospital"
        assert fac["facility_type"] == "Hospital"
        assert fac["country"] == "KE"
        assert fac["lat"] == pytest.approx(-1.3)
        assert fac["lng"] == pytest.approx(36.82)
        assert fac["managing_organization"] == "Ministry of Health"
        assert fac["part_of_id"] == "loc-district-1"
        assert "Hospital Road" in fac["address"]

    def test_maps_location_without_position(self, mapper):
        locations = [{"id": "loc-002", "name": "No Position Facility"}]
        result = mapper.map_locations(locations)
        assert result[0]["lat"] is None
        assert result[0]["lng"] is None

    def test_maps_location_with_text_type(self, mapper):
        locations = [
            {
                "id": "loc-003",
                "name": "Health Center",
                "type": [{"text": "Primary Care"}],
            }
        ]
        result = mapper.map_locations(locations)
        assert result[0]["facility_type"] == "Primary Care"


class TestMapImmunizations:
    def test_maps_known_vaccine_to_coverage(self, mapper):
        immunizations = [
            {
                "id": "imm-001",
                "status": "completed",
                "vaccineCode": {
                    "coding": [
                        {"system": "http://hl7.org/fhir/sid/cvx", "code": "19", "display": "BCG"}
                    ]
                },
                "occurrenceDateTime": "2025-01-15",
                "patient": {"reference": "Patient/pat-001"},
                "location": {"reference": "Location/loc-001"},
                "doseQuantity": {"value": 0.05, "unit": "mL"},
                "primarySource": True,
            }
        ]
        result = mapper.map_immunizations(immunizations)
        assert len(result["coverage"]) == 1
        assert len(result["unmapped"]) == 0
        cov = result["coverage"][0]
        assert cov["vaccine_code"] == "19"
        assert cov["vaccine_type"] == "BCG"
        assert cov["occurrence_date"] == "2025-01-15"
        assert cov["facility_ref"] == "loc-001"
        assert cov["dose_quantity"] == pytest.approx(0.05)
        assert cov["source"] == "fhir"

    def test_unmapped_vaccine_goes_to_unmapped(self, mapper):
        immunizations = [
            {
                "id": "imm-002",
                "status": "completed",
                "vaccineCode": {
                    "coding": [{"code": "999", "display": "Unknown Vaccine"}]
                },
            }
        ]
        result = mapper.map_immunizations(immunizations)
        assert len(result["unmapped"]) == 1
        assert len(result["coverage"]) == 0

    def test_immunization_without_vaccine_code(self, mapper):
        immunizations = [{"id": "imm-003", "status": "completed"}]
        result = mapper.map_immunizations(immunizations)
        assert len(result["unmapped"]) == 1

    def test_default_dose_quantity(self, mapper):
        immunizations = [
            {
                "id": "imm-004",
                "status": "completed",
                "vaccineCode": {"coding": [{"code": "19"}]},
            }
        ]
        result = mapper.map_immunizations(immunizations)
        assert result["coverage"][0]["dose_quantity"] == 1.0

    def test_multiple_immunizations_mixed(self, mapper):
        immunizations = [
            {
                "id": "imm-a",
                "vaccineCode": {"coding": [{"code": "19"}]},
                "status": "completed",
            },
            {
                "id": "imm-b",
                "vaccineCode": {"coding": [{"code": "02"}]},
                "status": "completed",
            },
            {
                "id": "imm-c",
                "vaccineCode": {"coding": [{"code": "888"}]},
                "status": "completed",
            },
        ]
        result = mapper.map_immunizations(immunizations)
        assert len(result["coverage"]) == 2
        assert len(result["unmapped"]) == 1
        types = {c["vaccine_type"] for c in result["coverage"]}
        assert types == {"BCG", "OPV"}


class TestMapSupplyDeliveries:
    def test_maps_supply_delivery(self, mapper):
        deliveries = [
            {
                "id": "sd-001",
                "status": "completed",
                "suppliedItem": {
                    "itemCodeableConcept": {
                        "coding": [{"code": "BCG-VAX", "display": "BCG Vaccine 20-dose"}]
                    },
                    "quantity": {"value": 1000, "unit": "doses"},
                },
                "destination": {"reference": "Location/loc-001"},
                "occurrenceDateTime": "2025-02-10",
            }
        ]
        result = mapper.map_supply_deliveries(deliveries)
        assert len(result) == 1
        inv = result[0]
        assert inv["fhir_id"] == "sd-001"
        assert inv["item_code"] == "BCG-VAX"
        assert inv["item_name"] == "BCG Vaccine 20-dose"
        assert inv["transaction_type"] == "receipt"
        assert inv["quantity"] == 1000.0
        assert inv["facility_ref"] == "loc-001"

    def test_maps_delivery_with_item_reference(self, mapper):
        deliveries = [
            {
                "id": "sd-002",
                "suppliedItem": {
                    "itemReference": {
                        "reference": "Medication/med-001",
                        "display": "OPV Vaccine",
                    },
                    "quantity": {"value": 500},
                },
            }
        ]
        result = mapper.map_supply_deliveries(deliveries)
        assert result[0]["item_name"] == "OPV Vaccine"

    def test_maps_delivery_with_zero_quantity(self, mapper):
        deliveries = [{"id": "sd-003", "suppliedItem": {}}]
        result = mapper.map_supply_deliveries(deliveries)
        assert result[0]["quantity"] == 0.0


class TestMapSupplyRequests:
    def test_maps_supply_request(self, mapper):
        requests = [
            {
                "id": "sr-001",
                "status": "active",
                "priority": "routine",
                "itemCodeableConcept": {
                    "coding": [{"code": "PENTA", "display": "Pentavalent Vaccine"}]
                },
                "quantity": {"value": 2000},
                "deliverTo": {"reference": "Location/loc-002"},
                "authoredOn": "2025-03-01",
            }
        ]
        result = mapper.map_supply_requests(requests)
        assert len(result) == 1
        req = result[0]
        assert req["item_code"] == "PENTA"
        assert req["transaction_type"] == "request"
        assert req["quantity"] == 2000.0
        assert req["facility_ref"] == "loc-002"
        assert req["priority"] == "routine"


class TestMapDevices:
    def test_maps_device(self, mapper):
        devices = [
            {
                "id": "dev-001",
                "status": "active",
                "type": {
                    "coding": [{"code": "refrigerator", "display": "Vaccine Refrigerator"}],
                    "text": "Cold chain refrigerator",
                },
                "deviceName": [{"name": "Vestfrost MK304", "type": "user-friendly-name"}],
                "manufacturer": "Vestfrost",
                "modelNumber": "MK304",
                "serialNumber": "VF-2024-0001",
                "location": {"reference": "Location/loc-001"},
            }
        ]
        result = mapper.map_devices(devices)
        assert len(result) == 1
        dev = result[0]
        assert dev["fhir_id"] == "dev-001"
        assert dev["device_name"] == "Vestfrost MK304"
        assert dev["device_type"] == "Vaccine Refrigerator"
        assert dev["manufacturer"] == "Vestfrost"
        assert dev["serial_number"] == "VF-2024-0001"
        assert dev["facility_ref"] == "loc-001"
        assert dev["source"] == "fhir"

    def test_maps_device_without_device_name(self, mapper):
        devices = [
            {
                "id": "dev-002",
                "status": "inactive",
                "type": {"text": "Cold box"},
            }
        ]
        result = mapper.map_devices(devices)
        assert result[0]["device_name"] == "Cold box"

    def test_maps_device_with_empty_fields(self, mapper):
        devices = [{"id": "dev-003"}]
        result = mapper.map_devices(devices)
        assert result[0]["fhir_id"] == "dev-003"
        assert result[0]["device_type"] == ""


class TestHelpers:
    def test_safe_float_with_valid_number(self):
        assert FHIRMapper._safe_float("123.45") == pytest.approx(123.45)

    def test_safe_float_with_none(self):
        assert FHIRMapper._safe_float(None) == 0.0

    def test_safe_float_with_invalid_string(self):
        assert FHIRMapper._safe_float("N/A") == 0.0

    def test_extract_position_with_coordinates(self):
        loc = {"position": {"latitude": -1.3, "longitude": 36.82}}
        lat, lng = FHIRMapper._extract_position(loc)
        assert lat == pytest.approx(-1.3)
        assert lng == pytest.approx(36.82)

    def test_extract_position_missing(self):
        lat, lng = FHIRMapper._extract_position({})
        assert lat is None
        assert lng is None

    def test_extract_address(self):
        loc = {
            "address": {
                "line": ["123 Main St"],
                "city": "Nairobi",
                "state": "Nairobi County",
                "country": "KE",
            }
        }
        addr = FHIRMapper._extract_address(loc)
        assert "123 Main St" in addr
        assert "Nairobi" in addr

    def test_extract_vaccine_code(self):
        imm = {"vaccineCode": {"coding": [{"code": "19", "display": "BCG"}]}}
        assert FHIRMapper._extract_vaccine_code(imm) == "19"

    def test_extract_vaccine_code_missing(self):
        assert FHIRMapper._extract_vaccine_code({}) is None

    def test_extract_dose_quantity(self):
        imm = {"doseQuantity": {"value": 0.5}}
        assert FHIRMapper._extract_dose_quantity(imm) == pytest.approx(0.5)

    def test_extract_dose_quantity_default(self):
        assert FHIRMapper._extract_dose_quantity({}) == 1.0
