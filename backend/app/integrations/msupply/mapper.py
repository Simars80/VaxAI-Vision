"""Transforms mSupply API responses into VaxAI domain models.

Uses a configurable mapping layer (MSupplyMappingConfig) so that
country-specific mSupply item codes can be mapped to VaxAI schema fields.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_DEFAULT_MAPPING_PATH = Path(__file__).parent / "default_mapping.json"


class MSupplyMappingConfig:
    """Country-specific mSupply → VaxAI field mapping configuration.

    Expected JSON structure::

        {
          "country_code": "XX",
          "item_mappings": {
            "<msupply_item_code>": {
              "vaxai_field": "stock_on_hand | consumed | wastage | doses_administered",
              "vaccine_type": "BCG | Penta | OPV | ..."
            }
          },
          "store_type_facility": "facility",
          "store_type_warehouse": "warehouse"
        }
    """

    def __init__(self, config: dict[str, Any]) -> None:
        self.country_code: str = config.get("country_code", "XX")
        self.item_mappings: dict[str, dict] = config.get("item_mappings", {})
        self.store_type_facility: str = config.get("store_type_facility", "facility")
        self.store_type_warehouse: str = config.get("store_type_warehouse", "warehouse")

    @classmethod
    def from_file(cls, path: str | Path) -> MSupplyMappingConfig:
        with open(path) as f:
            return cls(json.load(f))

    @classmethod
    def default(cls) -> MSupplyMappingConfig:
        if _DEFAULT_MAPPING_PATH.exists():
            return cls.from_file(_DEFAULT_MAPPING_PATH)
        return cls({})

    def resolve(self, item_code: str) -> dict | None:
        return self.item_mappings.get(item_code)


class MSupplyMapper:
    """Stateless transformer: mSupply JSON → VaxAI domain dicts."""

    def __init__(self, mapping: MSupplyMappingConfig | None = None) -> None:
        self.mapping = mapping or MSupplyMappingConfig.default()

    def map_stores(self, stores: list[dict]) -> list[dict]:
        """Convert mSupply stores into VaxAI facility records."""
        facilities: list[dict] = []
        for store in stores:
            lat, lng = self._extract_coordinates(store)
            facilities.append(
                {
                    "msupply_id": store.get("id", ""),
                    "name": store.get("name", store.get("name_1", "")),
                    "code": store.get("code", ""),
                    "store_type": store.get("type", store.get("store_mode", "")),
                    "country": self.mapping.country_code,
                    "lat": lat,
                    "lng": lng,
                }
            )
        return facilities

    def map_stock_lines(self, stock_lines: list[dict]) -> dict[str, list[dict]]:
        """Classify and transform stock lines by VaxAI domain.

        Returns::

            {
                "inventory": [...],    # SupplyTransaction-shaped dicts
                "unmapped": [...]      # stock lines with no mapping config
            }
        """
        result: dict[str, list[dict]] = {"inventory": [], "unmapped": []}

        for line in stock_lines:
            item_code = line.get("item_code", line.get("item_id", ""))
            mapping = self.mapping.resolve(item_code)

            if mapping is None:
                result["unmapped"].append(line)
                continue

            vaxai_field = mapping.get("vaxai_field", "")
            vaccine_type = mapping.get("vaccine_type", "unknown")

            if vaxai_field in ("stock_on_hand", "consumed", "wastage"):
                result["inventory"].append(
                    self._to_inventory_record(line, vaxai_field, vaccine_type)
                )
            else:
                result["unmapped"].append(line)

        return result

    def map_requisitions(self, requisition_lines: list[dict]) -> dict[str, list[dict]]:
        """Classify requisition line items into usage data.

        Returns::

            {
                "usage": [...],       # consumption/usage-shaped dicts
                "unmapped": [...]
            }
        """
        result: dict[str, list[dict]] = {"usage": [], "unmapped": []}

        for line in requisition_lines:
            item_code = line.get("item_code", line.get("item_id", ""))
            mapping = self.mapping.resolve(item_code)

            if mapping is None:
                result["unmapped"].append(line)
                continue

            vaccine_type = mapping.get("vaccine_type", "unknown")
            result["usage"].append(
                {
                    "item_code": item_code,
                    "store_id": line.get("store_id", ""),
                    "quantity_consumed": self._safe_float(
                        line.get("actual_consumption",
                                 line.get("consumption", 0))
                    ),
                    "stock_on_hand": self._safe_float(
                        line.get("stock_on_hand",
                                 line.get("closing_stock", 0))
                    ),
                    "quantity_requested": self._safe_float(
                        line.get("requested_quantity",
                                 line.get("suggested_quantity", 0))
                    ),
                    "vaccine_type": vaccine_type,
                    "source": "msupply",
                }
            )

        return result

    def _to_inventory_record(
        self, line: dict, field: str, vaccine_type: str
    ) -> dict:
        tx_type_map = {
            "stock_on_hand": "adjustment",
            "consumed": "issue",
            "wastage": "wastage",
        }
        quantity = self._safe_float(
            line.get("available_number_of_packs",
                      line.get("total_number_of_packs",
                               line.get("quantity", 0)))
        )
        return {
            "msupply_item_code": line.get("item_code", line.get("item_id", "")),
            "store_id": line.get("store_id", ""),
            "batch": line.get("batch", ""),
            "expiry_date": line.get("expiry_date"),
            "transaction_type": tx_type_map.get(field, "adjustment"),
            "quantity": quantity,
            "vaccine_type": vaccine_type,
            "source": "msupply",
        }

    @staticmethod
    def _extract_coordinates(store: dict) -> tuple[float | None, float | None]:
        lat = store.get("latitude") or store.get("lat")
        lng = store.get("longitude") or store.get("lng") or store.get("lon")
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
