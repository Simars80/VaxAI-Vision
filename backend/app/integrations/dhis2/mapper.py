"""Transforms DHIS2 API responses into VaxAI domain models.

Uses a configurable mapping layer (MappingConfig) so that country-specific
DHIS2 data element IDs can be mapped to the correct VaxAI schema fields.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_DEFAULT_MAPPING_PATH = Path(__file__).parent / "default_mapping.json"


class MappingConfig:
    """Country-specific DHIS2 → VaxAI field mapping configuration.

    Expected JSON structure::

        {
          "country_code": "SL",
          "data_elements": {
            "<dhis2_data_element_id>": {
              "vaxai_field": "doses_administered | stock_on_hand | wastage | ...",
              "vaccine_type": "BCG | Penta | OPV | ..."
            }
          },
          "org_unit_level_facility": 4,
          "stock_data_set": "<dataSet-id>",
          "immunization_data_set": "<dataSet-id>"
        }
    """

    def __init__(self, config: dict[str, Any]) -> None:
        self.country_code: str = config.get("country_code", "XX")
        self.data_elements: dict[str, dict] = config.get("data_elements", {})
        self.org_unit_level_facility: int = config.get("org_unit_level_facility", 4)
        self.stock_data_set: str | None = config.get("stock_data_set")
        self.immunization_data_set: str | None = config.get("immunization_data_set")

    @classmethod
    def from_file(cls, path: str | Path) -> MappingConfig:
        with open(path) as f:
            return cls(json.load(f))

    @classmethod
    def default(cls) -> MappingConfig:
        if _DEFAULT_MAPPING_PATH.exists():
            return cls.from_file(_DEFAULT_MAPPING_PATH)
        return cls({})

    def resolve(self, data_element_id: str) -> dict | None:
        """Return the VaxAI mapping for a given DHIS2 data element, or None."""
        return self.data_elements.get(data_element_id)


class DHIS2Mapper:
    """Stateless transformer: DHIS2 JSON → VaxAI domain dicts."""

    def __init__(self, mapping: MappingConfig | None = None) -> None:
        self.mapping = mapping or MappingConfig.default()

    # -- Organisation Units → CoverageFacility / ColdChainFacility -----------

    def map_organisation_units(self, units: list[dict]) -> list[dict]:
        """Convert DHIS2 org units into VaxAI facility records.

        Returns dicts ready for insertion into coverage_facilities or
        cold_chain_facilities tables.
        """
        facilities: list[dict] = []
        for unit in units:
            lat, lng = self._extract_coordinates(unit)
            facilities.append(
                {
                    "dhis2_id": unit.get("id", ""),
                    "name": unit.get("displayName", ""),
                    "level": unit.get("level"),
                    "parent_id": (unit.get("parent") or {}).get("id"),
                    "parent_name": (unit.get("parent") or {}).get("displayName"),
                    "country": self.mapping.country_code,
                    "lat": lat,
                    "lng": lng,
                }
            )
        return facilities

    # -- Data Value Sets → SupplyTransaction / CoverageFacility rows ---------

    def map_data_values(self, data_values: list[dict]) -> dict[str, list[dict]]:
        """Classify and transform raw data values by VaxAI domain.

        Returns::

            {
                "inventory": [...],    # SupplyTransaction-shaped dicts
                "coverage": [...],     # coverage metric dicts
                "unmapped": [...]      # data values with no mapping config
            }
        """
        result: dict[str, list[dict]] = {
            "inventory": [],
            "coverage": [],
            "unmapped": [],
        }

        for dv in data_values:
            de_id = dv.get("dataElement", "")
            mapping = self.mapping.resolve(de_id)

            if mapping is None:
                result["unmapped"].append(dv)
                continue

            vaxai_field = mapping.get("vaxai_field", "")
            vaccine_type = mapping.get("vaccine_type", "unknown")

            if vaxai_field in ("stock_on_hand", "consumed", "wastage"):
                result["inventory"].append(
                    self._to_inventory_record(dv, vaxai_field, vaccine_type)
                )
            elif vaxai_field in ("doses_administered", "target_population"):
                result["coverage"].append(
                    self._to_coverage_record(dv, vaxai_field, vaccine_type)
                )
            else:
                result["unmapped"].append(dv)

        return result

    # -- Analytics → aggregated coverage metrics -----------------------------

    def map_analytics(self, analytics: dict) -> list[dict]:
        """Convert DHIS2 analytics response rows into coverage metrics."""
        headers = analytics.get("headers", [])
        rows = analytics.get("rows", [])

        col_index = {h["name"]: i for i, h in enumerate(headers)}
        dx_idx = col_index.get("dx")
        pe_idx = col_index.get("pe")
        ou_idx = col_index.get("ou")
        val_idx = col_index.get("value")

        if dx_idx is None or val_idx is None:
            return []

        metadata_items = analytics.get("metaData", {}).get("items", {})

        records = []
        for row in rows:
            de_id = row[dx_idx] if dx_idx is not None else None
            mapping = self.mapping.resolve(de_id) if de_id else None
            records.append(
                {
                    "data_element_id": de_id,
                    "data_element_name": metadata_items.get(de_id, {}).get("name", ""),
                    "period": row[pe_idx] if pe_idx is not None else None,
                    "org_unit_id": row[ou_idx] if ou_idx is not None else None,
                    "org_unit_name": metadata_items.get(
                        row[ou_idx] if ou_idx is not None else "", {}
                    ).get("name", ""),
                    "value": self._safe_float(row[val_idx] if val_idx is not None else None),
                    "vaxai_field": mapping.get("vaxai_field") if mapping else None,
                    "vaccine_type": mapping.get("vaccine_type") if mapping else None,
                }
            )
        return records

    # -- Private helpers -----------------------------------------------------

    def _to_inventory_record(
        self, dv: dict, field: str, vaccine_type: str
    ) -> dict:
        tx_type_map = {
            "stock_on_hand": "adjustment",
            "consumed": "issue",
            "wastage": "wastage",
        }
        return {
            "dhis2_data_element": dv.get("dataElement"),
            "org_unit_id": dv.get("orgUnit"),
            "period": dv.get("period"),
            "transaction_type": tx_type_map.get(field, "adjustment"),
            "quantity": self._safe_float(dv.get("value")),
            "vaccine_type": vaccine_type,
            "source": "dhis2",
        }

    def _to_coverage_record(
        self, dv: dict, field: str, vaccine_type: str
    ) -> dict:
        return {
            "dhis2_data_element": dv.get("dataElement"),
            "org_unit_id": dv.get("orgUnit"),
            "period": dv.get("period"),
            "field": field,
            "value": self._safe_float(dv.get("value")),
            "vaccine_type": vaccine_type,
            "source": "dhis2",
        }

    @staticmethod
    def _extract_coordinates(unit: dict) -> tuple[float | None, float | None]:
        """Pull latitude/longitude from DHIS2 org unit geometry or coordinates."""
        # Prefer GeoJSON geometry (DHIS2 ≥2.32)
        geo = unit.get("geometry")
        if geo and geo.get("type") == "Point":
            coords = geo.get("coordinates", [])
            if len(coords) >= 2:
                return coords[1], coords[0]  # GeoJSON is [lng, lat]

        # Legacy coordinates field: "[lng, lat]"
        raw = unit.get("coordinates")
        if raw and isinstance(raw, str):
            try:
                coords = json.loads(raw)
                if isinstance(coords, list) and len(coords) >= 2:
                    return float(coords[1]), float(coords[0])
            except (json.JSONDecodeError, ValueError, TypeError):
                pass

        return None, None

    @staticmethod
    def _safe_float(val: Any) -> float:
        try:
            return float(val)
        except (TypeError, ValueError):
            return 0.0
