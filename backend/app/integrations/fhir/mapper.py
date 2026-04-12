"""Transforms FHIR R4 resources into VaxAI domain models.

Uses a configurable mapping layer (FHIRMappingConfig) so that
vaccine codes and resource types can be mapped to VaxAI schema fields.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_DEFAULT_MAPPING_PATH = Path(__file__).parent / "default_mapping.json"


class FHIRMappingConfig:
    """FHIR resource → VaxAI field mapping configuration.

    Expected JSON structure::

        {
          "country_code": "XX",
          "vaccine_code_system": "http://hl7.org/fhir/sid/cvx",
          "vaccine_code_mappings": {
            "<cvx-code>": {
              "vaccine_type": "BCG | Penta | OPV | ..."
            }
          },
          "device_type_codes": { ... },
          "supply_item_code_system": "http://snomed.info/sct"
        }
    """

    def __init__(self, config: dict[str, Any]) -> None:
        self.country_code: str = config.get("country_code", "XX")
        self.vaccine_code_system: str = config.get(
            "vaccine_code_system", "http://hl7.org/fhir/sid/cvx"
        )
        self.vaccine_code_mappings: dict[str, dict] = config.get(
            "vaccine_code_mappings", {}
        )
        self.device_type_codes: dict[str, str] = config.get("device_type_codes", {})
        self.supply_item_code_system: str = config.get(
            "supply_item_code_system", "http://snomed.info/sct"
        )

    @classmethod
    def from_file(cls, path: str | Path) -> FHIRMappingConfig:
        with open(path) as f:
            return cls(json.load(f))

    @classmethod
    def default(cls) -> FHIRMappingConfig:
        if _DEFAULT_MAPPING_PATH.exists():
            return cls.from_file(_DEFAULT_MAPPING_PATH)
        return cls({})

    def resolve_vaccine(self, code: str) -> dict | None:
        return self.vaccine_code_mappings.get(code)


class FHIRMapper:
    """Stateless transformer: FHIR R4 resources -> VaxAI domain dicts."""

    def __init__(self, mapping: FHIRMappingConfig | None = None) -> None:
        self.mapping = mapping or FHIRMappingConfig.default()

    # -- Location -> facilities -----------------------------------------------

    def map_locations(self, locations: list[dict]) -> list[dict]:
        """Convert FHIR Location resources into VaxAI facility records."""
        result: list[dict] = []
        for loc in locations:
            lat, lng = self._extract_position(loc)
            managing_org = loc.get("managingOrganization") or {}
            part_of = loc.get("partOf") or {}
            loc_type = self._extract_first_coding_display(loc.get("type", []))

            result.append(
                {
                    "fhir_id": loc.get("id", ""),
                    "name": loc.get("name", ""),
                    "status": loc.get("status", ""),
                    "facility_type": loc_type,
                    "managing_organization": managing_org.get("display", ""),
                    "part_of_id": part_of.get("reference", "").replace("Location/", ""),
                    "part_of_name": part_of.get("display", ""),
                    "address": self._extract_address(loc),
                    "country": self.mapping.country_code,
                    "lat": lat,
                    "lng": lng,
                }
            )
        return result

    # -- Immunization -> coverage data ----------------------------------------

    def map_immunizations(self, immunizations: list[dict]) -> dict[str, list[dict]]:
        """Convert FHIR Immunization resources into VaxAI coverage records.

        Returns::

            {
                "coverage": [...],
                "unmapped": [...]
            }
        """
        result: dict[str, list[dict]] = {"coverage": [], "unmapped": []}

        for imm in immunizations:
            vaccine_code = self._extract_vaccine_code(imm)
            mapping = (
                self.mapping.resolve_vaccine(vaccine_code) if vaccine_code else None
            )

            if mapping is None:
                result["unmapped"].append(imm)
                continue

            location_ref = (imm.get("location") or {}).get("reference", "")
            result["coverage"].append(
                {
                    "fhir_id": imm.get("id", ""),
                    "vaccine_code": vaccine_code,
                    "vaccine_type": mapping.get("vaccine_type", "unknown"),
                    "status": imm.get("status", ""),
                    "occurrence_date": imm.get("occurrenceDateTime", ""),
                    "facility_ref": location_ref.replace("Location/", ""),
                    "patient_ref": (imm.get("patient") or {}).get("reference", ""),
                    "dose_quantity": self._extract_dose_quantity(imm),
                    "is_primary_source": imm.get("primarySource", True),
                    "source": "fhir",
                }
            )

        return result

    # -- SupplyDelivery / SupplyRequest -> inventory --------------------------

    def map_supply_deliveries(self, deliveries: list[dict]) -> list[dict]:
        """Convert FHIR SupplyDelivery resources into VaxAI inventory records."""
        result: list[dict] = []
        for sd in deliveries:
            item_code, item_name = self._extract_supplied_item(sd)
            destination = (sd.get("destination") or {}).get("reference", "")
            quantity = self._extract_supply_quantity(sd)

            result.append(
                {
                    "fhir_id": sd.get("id", ""),
                    "item_code": item_code,
                    "item_name": item_name,
                    "transaction_type": "receipt",
                    "quantity": quantity,
                    "facility_ref": destination.replace("Location/", ""),
                    "occurrence_date": (
                        sd.get("occurrenceDateTime")
                        or (sd.get("occurrencePeriod") or {}).get("start", "")
                    ),
                    "status": sd.get("status", ""),
                    "source": "fhir",
                }
            )
        return result

    def map_supply_requests(self, requests: list[dict]) -> list[dict]:
        """Convert FHIR SupplyRequest resources into VaxAI inventory request records."""
        result: list[dict] = []
        for sr in requests:
            item_code, item_name = self._extract_item_codeable(
                sr.get("itemCodeableConcept") or sr.get("itemReference") or {}
            )
            deliver_to = (sr.get("deliverTo") or {}).get("reference", "")
            quantity = self._safe_float((sr.get("quantity") or {}).get("value"))

            result.append(
                {
                    "fhir_id": sr.get("id", ""),
                    "item_code": item_code,
                    "item_name": item_name,
                    "transaction_type": "request",
                    "quantity": quantity,
                    "facility_ref": deliver_to.replace("Location/", ""),
                    "authored_on": sr.get("authoredOn", ""),
                    "status": sr.get("status", ""),
                    "priority": sr.get("priority", ""),
                    "source": "fhir",
                }
            )
        return result

    # -- Device -> cold chain equipment ---------------------------------------

    def map_devices(self, devices: list[dict]) -> list[dict]:
        """Convert FHIR Device resources into VaxAI cold chain equipment records."""
        result: list[dict] = []
        for dev in devices:
            device_type = self._extract_first_coding_display(
                [dev.get("type")] if dev.get("type") else []
            )
            location_ref = (dev.get("location") or {}).get("reference", "")

            result.append(
                {
                    "fhir_id": dev.get("id", ""),
                    "device_name": (dev.get("deviceName") or [{}])[0].get("name", "")
                    if dev.get("deviceName")
                    else dev.get("type", {}).get("text", ""),
                    "device_type": device_type,
                    "status": dev.get("status", ""),
                    "manufacturer": dev.get("manufacturer", ""),
                    "model_number": dev.get("modelNumber", ""),
                    "serial_number": dev.get("serialNumber", ""),
                    "facility_ref": location_ref.replace("Location/", ""),
                    "source": "fhir",
                }
            )
        return result

    # -- Private helpers ------------------------------------------------------

    @staticmethod
    def _extract_position(location: dict) -> tuple[float | None, float | None]:
        position = location.get("position")
        if position:
            lat = position.get("latitude")
            lng = position.get("longitude")
            if lat is not None and lng is not None:
                try:
                    return float(lat), float(lng)
                except (TypeError, ValueError):
                    pass
        return None, None

    @staticmethod
    def _extract_address(location: dict) -> str:
        addr = location.get("address") or {}
        lines = addr.get("line", [])
        parts = lines + [
            addr.get("city", ""),
            addr.get("state", ""),
            addr.get("postalCode", ""),
            addr.get("country", ""),
        ]
        return ", ".join(p for p in parts if p)

    @staticmethod
    def _extract_first_coding_display(type_list: list) -> str:
        for t in type_list:
            if not t:
                continue
            for coding in t.get("coding", []):
                display = coding.get("display")
                if display:
                    return display
            text = t.get("text")
            if text:
                return text
        return ""

    @staticmethod
    def _extract_vaccine_code(immunization: dict) -> str | None:
        vaccine_cc = immunization.get("vaccineCode") or {}
        for coding in vaccine_cc.get("coding", []):
            code = coding.get("code")
            if code:
                return code
        return None

    @staticmethod
    def _extract_dose_quantity(immunization: dict) -> float:
        dq = immunization.get("doseQuantity") or {}
        val = dq.get("value")
        if val is not None:
            try:
                return float(val)
            except (TypeError, ValueError):
                pass
        return 1.0

    @staticmethod
    def _extract_supplied_item(supply_delivery: dict) -> tuple[str, str]:
        supplied = supply_delivery.get("suppliedItem") or {}
        item_cc = supplied.get("itemCodeableConcept") or {}
        item_ref = supplied.get("itemReference") or {}

        for coding in item_cc.get("coding", []):
            return coding.get("code", ""), coding.get("display", "")

        if item_ref.get("display"):
            ref = item_ref.get("reference", "")
            return ref, item_ref["display"]

        return "", item_cc.get("text", "")

    @staticmethod
    def _extract_item_codeable(item: dict) -> tuple[str, str]:
        if "coding" in item:
            for coding in item["coding"]:
                return coding.get("code", ""), coding.get("display", "")
            return "", item.get("text", "")
        return item.get("reference", ""), item.get("display", "")

    @staticmethod
    def _extract_supply_quantity(supply_delivery: dict) -> float:
        supplied = supply_delivery.get("suppliedItem") or {}
        quantity = supplied.get("quantity") or {}
        val = quantity.get("value")
        if val is not None:
            try:
                return float(val)
            except (TypeError, ValueError):
                pass
        return 0.0

    @staticmethod
    def _safe_float(val: Any) -> float:
        try:
            return float(val)
        except (TypeError, ValueError):
            return 0.0
