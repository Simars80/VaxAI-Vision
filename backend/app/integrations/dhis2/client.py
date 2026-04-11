"""DHIS2 Web API client with Basic Auth and Personal Access Token support.

Implements the ExternalDataSource adapter pattern. Fetches organisation units,
data value sets, analytics, and data elements from any DHIS2 2.36+ instance.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_DEFAULT_PAGE_SIZE = 50
_DEFAULT_TIMEOUT = 60.0


class DHIS2ClientError(Exception):
    """Raised when the DHIS2 API returns an unexpected response."""


class DHIS2Client:
    """Async DHIS2 Web API client.

    Supports Basic Auth (username/password) and Personal Access Token (PAT).

    Usage::

        async with DHIS2Client(base_url="https://play.dhis2.org/40.4.0",
                                username="admin", password="district") as client:
            units = await client.fetch_organisation_units()
    """

    def __init__(
        self,
        base_url: str,
        *,
        username: str | None = None,
        password: str | None = None,
        personal_access_token: str | None = None,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._username = username
        self._password = password
        self._pat = personal_access_token
        self._timeout = timeout
        self._client: httpx.AsyncClient | None = None

    # -- Context manager -----------------------------------------------------

    async def __aenter__(self) -> DHIS2Client:
        self._client = self._build_client()
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    def _build_client(self) -> httpx.AsyncClient:
        headers: dict[str, str] = {"Accept": "application/json"}
        auth = None

        if self._pat:
            headers["Authorization"] = f"ApiToken {self._pat}"
        elif self._username and self._password:
            auth = httpx.BasicAuth(self._username, self._password)

        return httpx.AsyncClient(
            base_url=self.base_url,
            headers=headers,
            auth=auth,
            timeout=self._timeout,
            follow_redirects=True,
        )

    def _client_or_raise(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = self._build_client()
        return self._client

    # -- Internal request helpers --------------------------------------------

    async def _get_json(
        self, path: str, params: dict[str, str] | None = None
    ) -> dict:
        client = self._client_or_raise()
        try:
            resp = await client.get(path, params=params or {})
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise DHIS2ClientError(
                f"DHIS2 GET {path} failed [{exc.response.status_code}]: "
                f"{exc.response.text[:512]}"
            ) from exc
        except httpx.RequestError as exc:
            raise DHIS2ClientError(
                f"Network error fetching {path}: {exc}"
            ) from exc
        return resp.json()

    async def _get_paged(
        self,
        path: str,
        collection_key: str,
        params: dict[str, str] | None = None,
        max_items: int = 1000,
    ) -> list[dict]:
        """Fetch all pages of a DHIS2 paginated collection."""
        params = {**(params or {}), "pageSize": str(_DEFAULT_PAGE_SIZE), "page": "1"}
        items: list[dict] = []

        while len(items) < max_items:
            data = await self._get_json(path, params)
            batch = data.get(collection_key, [])
            items.extend(batch)

            pager = data.get("pager", {})
            current_page = pager.get("page", 1)
            page_count = pager.get("pageCount", 1)

            if current_page >= page_count:
                break
            params["page"] = str(current_page + 1)

        return items[:max_items]

    # -- Public data fetchers ------------------------------------------------

    async def fetch_organisation_units(
        self,
        *,
        level: int | None = None,
        fields: str = "id,displayName,level,coordinates,geometry,parent[id,displayName]",
        max_items: int = 1000,
    ) -> list[dict]:
        """Fetch organisation units (facilities, districts, etc.)."""
        params: dict[str, str] = {"fields": fields}
        if level is not None:
            params["level"] = str(level)

        return await self._get_paged(
            "/api/organisationUnits",
            "organisationUnits",
            params=params,
            max_items=max_items,
        )

    async def fetch_data_value_sets(
        self,
        *,
        data_set: str | None = None,
        org_unit: str | None = None,
        period: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        data_element_group: str | None = None,
        org_unit_group: str | None = None,
        children: bool = False,
    ) -> list[dict]:
        """Fetch raw data values from the dataValueSets endpoint."""
        params: dict[str, str] = {}
        if data_set:
            params["dataSet"] = data_set
        if org_unit:
            params["orgUnit"] = org_unit
        if period:
            params["period"] = period
        if start_date:
            params["startDate"] = start_date
        if end_date:
            params["endDate"] = end_date
        if data_element_group:
            params["dataElementGroup"] = data_element_group
        if org_unit_group:
            params["orgUnitGroup"] = org_unit_group
        if children:
            params["children"] = "true"

        data = await self._get_json("/api/dataValueSets.json", params)
        return data.get("dataValues", [])

    async def fetch_analytics(
        self,
        *,
        dimension: list[str],
        filter_params: list[str] | None = None,
        aggregation_type: str | None = None,
    ) -> dict:
        """Fetch aggregated analytics data.

        ``dimension`` entries follow DHIS2 syntax, e.g.::

            ["dx:fbfJHSPpUQD;cYeuwXTCPkU", "pe:LAST_12_MONTHS", "ou:ImspTQPwCqd"]
        """
        params: dict[str, str] = {}
        for i, dim in enumerate(dimension):
            params[f"dimension"] = dim if i == 0 else params["dimension"]
        # DHIS2 analytics supports repeated dimension params via list
        # We need to send them as separate params — use the raw approach
        query_parts = [f"dimension={d}" for d in dimension]
        if filter_params:
            query_parts.extend(f"filter={f}" for f in filter_params)
        if aggregation_type:
            query_parts.append(f"aggregationType={aggregation_type}")

        query_string = "&".join(query_parts)
        data = await self._get_json(f"/api/analytics.json?{query_string}")
        return data

    async def fetch_data_elements(
        self,
        *,
        fields: str = "id,displayName,valueType,domainType,categoryCombo[id,displayName]",
        max_items: int = 2000,
    ) -> list[dict]:
        """Fetch data element metadata (for mapping configuration)."""
        return await self._get_paged(
            "/api/dataElements",
            "dataElements",
            params={"fields": fields},
            max_items=max_items,
        )

    async def test_connection(self) -> dict:
        """Verify connectivity by hitting /api/system/info."""
        return await self._get_json("/api/system/info")
