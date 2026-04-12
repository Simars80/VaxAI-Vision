"""Transforms OpenLMIS API responses into VaxAI domain models.

Uses a configurable mapping layer (OpenLMISMappingConfig) so that
country-specific OpenLMIS orderable IDs can be mapped to VaxAI schema fields.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_DEFAULT_MAPPING_PATH = Path(__file__).parent / "default_mapping.json"


class OpenLMISMappingConfig:
    """Country-specific OpenLMIS → VaxAI field mapping configuration.

    Expected JSON structure::

        {
          "country_code": "XX",
          "orderable_mappings": {
            "<openlmis_orderable_id>": {
              "vaxai_field": "stock_on_hand | consumed | wastage | doses_administered",
              "vaccine_type": "BCG | Penta | OPV | ..."
            }
          },
          "epi_program_id": "<program-uuid>",
          "geographic_zone_level_facility": 4
        }
    """

    def __init__(self, config: dict[str, Any]) -> None:
        self.country_code: str = config.get("country_code", "XX")
        self.orderable_mappings: dict[str, dict] = config.get("orderable_mappings", {})
        self.epi_program_id: str | None = config.get("epi_program_id")
        self.geographic_zone_level_facility: int = config.get(
            "geographic_zone_level_facility", 4
        )

    @classmethod
    def from_file(cls, path: str | Path) -> OpenLMISMappingConfig:
        with open(path) as f:
            return cls(json.load(f))

    @classmethod
    def default(cls) -> OpenLMISMappingConfig:
        if _DEFAULT_MAPPING_PATH.exists():
            return cls.from_file(_DEFAULT_MAPPING_PATH)
        return cls({})

    def resolve(self, orderable_id: str) -> dict | None:
        return self.orderable_mappings.get(orderable_id)


class OpenLMISMapper:
    """Stateless transformer: OpenLMIS JSON → VaxAI domain dicts."""

    def __init__(self, mapping: OpenLMISMappingConfig | None = None) -> None:
        self.mapping = mapping or OpenLMISMappingConfig.default()

    def map_facilities(self, facilities: list[dict]) -> list[dict]:
        """Convert OpenLMIS facilities into VaxAI facility records."""
        result: list[dict] = []
        for fac in facilities:
            lat, lng = self._extract_coordinates(fac)
            geo_zone = fac.get("geographicZone") or {}
            facility_type = fac.get("type") or {}
            result.append(
                {
                    "openlmis_id": fac.get("id", ""),
                    "name": fac.get("name", ""),
                    "code": fac.get("code", ""),
                    "facility_type": facility_type.get("name", ""),
                    "active": fac.get("active", True),
                    "geographic_zone": geo_zone.get("name", ""),
                    "geographic_zone_id": geo_zone.get("id", ""),
                    "country": self.mapping.country_code,
                    "lat": lat,
                    "lng": lng,
                }
            )
        return result

    def map_stock_card_summaries(self, summaries: list[dict]) -> dict[str, list[dict]]:
        """Classify and transform stock card summaries by VaxAI domain.

        Returns::

            {
                "inventory": [...],    # SupplyTransaction-shaped dicts
                "unmapped": [...]      # summaries with no mapping config
            }
        """
        result: dict[str, list[dict]] = {"inventory": [], "unmapped": []}

        for summary in summaries:
            orderable = summary.get("orderable") or {}
            orderable_id = orderable.get("id", "")
            mapping = self.mapping.resolve(orderable_id)

            if mapping is None:
                result["unmapped"].append(summary)
                continue

            vaxai_field = mapping.get("vaxai_field", "")
            vaccine_type = mapping.get("vaccine_type", "unknown")

            if vaxai_field in ("stock_on_hand", "consumed", "wastage"):
                result["inventory"].append(
                    self._to_inventory_record(summary, vaxai_field, vaccine_type)
                )
            else:
                result["unmapped"].append(summary)

        return result

    def map_requisitions(self, requisitions: list[dict]) -> dict[str, list[dict]]:
        """Classify requisition line items into usage data.

        Returns::

            {
                "usage": [...],       # consumption/usage-shaped dicts
                "unmapped": [...]
            }
        """
        result: dict[str, list[dict]] = {"usage": [], "unmapped": []}

        for req in requisitions:
            facility = req.get("facility") or {}
            facility_id = facility.get("id", "")
            period = req.get("processingPeriod") or {}
            period_name = period.get("name", "")

            for line in req.get("requisitionLineItems", []):
                orderable = line.get("orderable") or {}
                orderable_id = orderable.get("id", "")
                mapping = self.mapping.resolve(orderable_id)

                if mapping is None:
                    result["unmapped"].append(line)
                    continue

                vaccine_type = mapping.get("vaccine_type", "unknown")
                result["usage"].append(
                    {
                        "orderable_id": orderable_id,
                        "orderable_name": orderable.get(
                            "fullProductName",
                            orderable.get("name", ""),
                        ),
                        "facility_id": facility_id,
                        "period": period_name,
                        "quantity_consumed": self._safe_float(
                            line.get("totalConsumedQuantity", 0)
                        ),
                        "stock_on_hand": self._safe_float(line.get("stockOnHand", 0)),
                        "quantity_requested": self._safe_float(
                            line.get("requestedQuantity", 0)
                        ),
                        "vaccine_type": vaccine_type,
                        "source": "openlmis",
                    }
                )

        return result

    def _to_inventory_record(
        self, summary: dict, field: str, vaccine_type: str
    ) -> dict:
        tx_type_map = {
            "stock_on_hand": "adjustment",
            "consumed": "issue",
            "wastage": "wastage",
        }
        orderable = summary.get("orderable") or {}
        facility = summary.get("facility") or {}
        return {
            "openlmis_orderable_id": orderable.get("id", ""),
            "orderable_name": orderable.get(
                "fullProductName", orderable.get("name", "")
            ),
            "facility_id": facility.get("id", ""),
            "stock_on_hand": self._safe_float(summary.get("stockOnHand", 0)),
            "transaction_type": tx_type_map.get(field, "adjustment"),
            "quantity": self._safe_float(summary.get("stockOnHand", 0)),
            "vaccine_type": vaccine_type,
            "source": "openlmis",
        }

    @staticmethod
    def _extract_coordinates(facility: dict) -> tuple[float | None, float | None]:
        location = facility.get("location") or {}
        lat = location.get("latitude")
        lng = location.get("longitude")
        if lat is not None and lng is not None:
            try:
                return float(lat), float(lng)
            except (TypeError, ValueError):
                pass

        geo_zone = facility.get("geographicZone") or {}
        lat = geo_zone.get("latitude")
        lng = geo_zone.get("longitude")
        if lat is not None and lng is not None:
            try:
                return float(lat), float(lng)
            except (TypeError, ValueError):
                pass

        return None, None

    @staticmethod
    def _safe_float(val: Any) -> float:
        try:
            return float(val)
        except (TypeError, ValueError):
            return 0.0
