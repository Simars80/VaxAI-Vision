"""DAG builder and DHIS2 route adapter.

Extends the existing ExternalDataSource (DHIS2) adapter pattern to fetch
org unit hierarchy and convert it into a LogisticsDAG of nodes and edges.

Scope: Phase 2A — Sierra Leone (SL) DHIS2 demo data, levels 1–4.
Default transit time 24h, reliability 0.85.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import uuid4

from app.integrations.dhis2.client import DHIS2Client
from app.models.logistics import (
    ColdChainType,
    LogisticsDAG,
    LogisticsEdge,
    LogisticsNode,
    NodeLevel,
    TransportMode,
)

logger = logging.getLogger(__name__)

# Phase 2A defaults — will be enriched from DHIS2 data elements in Phase 2B
_DEFAULT_TRANSIT_HOURS: float = 24.0
_DEFAULT_RELIABILITY: float = 0.85
_MAX_OU_LEVEL: int = 4

_LEVEL_MAP: dict[int, NodeLevel] = {
    1: NodeLevel.NATIONAL,
    2: NodeLevel.REGIONAL,
    3: NodeLevel.DISTRICT,
    4: NodeLevel.FACILITY,
}


class DHISRouteAdapter:
    """Extends the ExternalDataSource pull logic to build a LogisticsDAG.

    Wraps an existing DHIS2Client (ExternalDataSource adapter) and adds
    org-unit-to-node mapping and edge derivation from the OU parent hierarchy.
    No new data source abstraction is introduced.

    Usage::

        async with DHIS2Client(base_url=..., username=..., password=...) as client:
            adapter = DHISRouteAdapter(client, data_source_id="dhis2-sl")
            dag = await adapter.build_dag("SL")
    """

    def __init__(
        self,
        dhis2_client: DHIS2Client,
        *,
        data_source_id: str,
        max_level: int = _MAX_OU_LEVEL,
    ) -> None:
        self._client = dhis2_client
        self._data_source_id = data_source_id
        self._max_level = max_level

    # -----------------------------------------------------------------------
    # Public interface
    # -----------------------------------------------------------------------

    async def fetch_org_units(self, country_code: str) -> list[dict]:
        """Fetch raw DHIS2 org unit objects for levels 1 through max_level.

        Calls::

            GET /api/organisationUnits.json
                ?fields=id,name,level,coordinates,geometry,parent[id,name]
                &paging=false&level=1&level=2&...

        Returns a flat list of raw org unit dicts suitable for ``_ou_to_node``.
        """
        logger.info(
            "Fetching DHIS2 org units for country=%s up to level=%d",
            country_code,
            self._max_level,
        )
        fields = (
            "id,name,level,coordinates,geometry,"
            "parent[id,name],"
            "openingDate,closedDate"
        )
        all_units: list[dict] = []
        for level in range(1, self._max_level + 1):
            batch = await self._client.fetch_organisation_units(
                level=level,
                fields=fields,
                max_items=5000,
            )
            logger.debug(
                "country=%s level=%d fetched %d org units",
                country_code,
                level,
                len(batch),
            )
            all_units.extend(batch)
        return all_units

    async def build_dag(self, country_code: str) -> LogisticsDAG:
        """Build a LogisticsDAG from DHIS2 org unit hierarchy.

        Maps every org unit to a LogisticsNode and every parent→child
        OU relationship to a directed LogisticsEdge.

        Args:
            country_code: ISO 3166-1 alpha-2 code (e.g. ``"SL"``).

        Returns:
            A fully-formed :class:`LogisticsDAG` ready for persistence.
        """
        raw_ous = await self.fetch_org_units(country_code)
        if not raw_ous:
            logger.warning(
                "No org units returned from DHIS2 for country=%s", country_code
            )

        # Build internal id map: dhis2_id → internal UUID string
        dhis2_to_internal: dict[str, str] = {
            ou["id"]: str(uuid4()) for ou in raw_ous
        }

        nodes = [
            self._ou_to_node(ou, dhis2_to_internal, country_code)
            for ou in raw_ous
        ]
        edges = self._derive_edges(raw_ous, dhis2_to_internal, country_code)

        logger.info(
            "Built DAG for country=%s: %d nodes, %d edges",
            country_code,
            len(nodes),
            len(edges),
        )
        return LogisticsDAG(
            id=str(uuid4()),
            country_code=country_code,
            nodes=nodes,
            edges=edges,
            generated_at=datetime.now(tz=timezone.utc),
            dhis2_data_source_id=self._data_source_id,
            version=1,
        )

    # -----------------------------------------------------------------------
    # Internal helpers (tested directly by unit tests)
    # -----------------------------------------------------------------------

    def _ou_to_node(
        self,
        ou: dict,
        dhis2_to_internal: dict[str, str],
        country_code: str,
    ) -> LogisticsNode:
        """Convert a raw DHIS2 org unit dict to a LogisticsNode.

        Args:
            ou: Raw org unit dict from DHIS2 API.
            dhis2_to_internal: Mapping of DHIS2 id → internal UUID string.
            country_code: ISO 3166-1 alpha-2 code.

        Returns:
            :class:`LogisticsNode` with defaults applied for missing fields.
        """
        level_int = ou.get("level", 4)
        node_level = _LEVEL_MAP.get(level_int, NodeLevel.FACILITY)
        lat, lng = self._parse_coordinates(ou)

        internal_id = dhis2_to_internal.get(ou["id"], str(uuid4()))
        return LogisticsNode(
            id=internal_id,
            dhis2_org_unit_id=ou["id"],
            name=ou.get("name", ""),
            level=node_level,
            lat=lat,
            lng=lng,
            cold_chain_type=ColdChainType.PASSIVE,
            is_active=True,
            country_code=country_code,
        )

    def _derive_edges(
        self,
        raw_ous: list[dict],
        dhis2_to_internal: dict[str, str],
        country_code: str,
    ) -> list[LogisticsEdge]:
        """Create one directed edge per parent→child OU relationship.

        Uses Phase 2A defaults: transit_time_hours=24.0, reliability_score=0.85,
        transport_mode=TRUCK. Skips edges where parent is not in the fetched set.

        Args:
            raw_ous: Flat list of raw DHIS2 org unit dicts.
            dhis2_to_internal: Mapping of DHIS2 id → internal UUID string.
            country_code: ISO 3166-1 alpha-2 code.

        Returns:
            List of :class:`LogisticsEdge` instances (source=parent, target=child).
        """
        edges: list[LogisticsEdge] = []
        for ou in raw_ous:
            parent = ou.get("parent")
            if not parent:
                continue
            parent_dhis2_id = parent.get("id")
            if not parent_dhis2_id or parent_dhis2_id not in dhis2_to_internal:
                # Parent is outside the fetched level range — skip silently
                continue

            source_id = dhis2_to_internal[parent_dhis2_id]
            target_id = dhis2_to_internal[ou["id"]]

            edges.append(
                LogisticsEdge(
                    id=str(uuid4()),
                    source_node_id=source_id,
                    target_node_id=target_id,
                    transit_time_hours=_DEFAULT_TRANSIT_HOURS,
                    reliability_score=_DEFAULT_RELIABILITY,
                    transport_mode=TransportMode.TRUCK,
                    is_active=True,
                    country_code=country_code,
                )
            )
        return edges

    # -----------------------------------------------------------------------
    # Coordinate parsing
    # -----------------------------------------------------------------------

    @staticmethod
    def _parse_coordinates(ou: dict) -> tuple[float | None, float | None]:
        """Extract (lat, lng) from DHIS2 coordinates or geometry fields.

        DHIS2 may return coordinates as:
        - ``"coordinates": "[lng, lat]"`` (legacy point string)
        - ``"geometry": {"type": "Point", "coordinates": [lng, lat]}``
        - ``"geometry": {"type": "Polygon", ...}`` — centroid returned as None

        Returns (lat, lng) or (None, None) if unavailable.
        """
        # Prefer geometry.coordinates for Point types
        geometry = ou.get("geometry")
        if isinstance(geometry, dict):
            geo_type = geometry.get("type")
            coords = geometry.get("coordinates")
            if geo_type == "Point" and isinstance(coords, list) and len(coords) >= 2:
                try:
                    return float(coords[1]), float(coords[0])  # GeoJSON: [lng, lat]
                except (TypeError, ValueError):
                    pass

        # Fall back to legacy coordinates string "[lng, lat]"
        coord_str = ou.get("coordinates")
        if isinstance(coord_str, str) and coord_str.strip():
            try:
                import json

                coords = json.loads(coord_str)
                if isinstance(coords, list) and len(coords) >= 2:
                    return float(coords[1]), float(coords[0])
            except (ValueError, TypeError, Exception):
                pass

        return None, None
