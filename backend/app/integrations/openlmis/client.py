"""OpenLMIS v3 API client with OAuth2 authentication.

Implements the ExternalDataSource adapter pattern. Fetches facilities,
stock cards (inventory), requisitions (usage/consumption), and orderables
from any OpenLMIS v3 instance.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_DEFAULT_PAGE_SIZE = 50
_DEFAULT_TIMEOUT = 60.0


class OpenLMISClientError(Exception):
    """Raised when the OpenLMIS API returns an unexpected response."""


class OpenLMISClient:
    """Async OpenLMIS v3 API client.

    Uses OAuth2 client credentials flow for authentication.

    Usage::

        async with OpenLMISClient(
            base_url="https://openlmis.example.org",
            client_id="user-client",
            client_secret="secret",
        ) as client:
            facilities = await client.fetch_facilities()
    """

    def __init__(
        self,
        base_url: str,
        *,
        client_id: str | None = None,
        client_secret: str | None = None,
        username: str | None = None,
        password: str | None = None,
        access_token: str | None = None,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._client_id = client_id
        self._client_secret = client_secret
        self._username = username
        self._password = password
        self._access_token = access_token
        self._timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> OpenLMISClient:
        self._client = self._build_client()
        if not self._access_token:
            await self._authenticate()
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    def _build_client(self) -> httpx.AsyncClient:
        headers: dict[str, str] = {"Accept": "application/json"}
        if self._access_token:
            headers["Authorization"] = f"Bearer {self._access_token}"

        return httpx.AsyncClient(
            base_url=self.base_url,
            headers=headers,
            timeout=self._timeout,
            follow_redirects=True,
        )

    async def _authenticate(self) -> None:
        """Obtain an OAuth2 access token via client credentials or password grant."""
        client = self._client_or_raise()

        if self._username and self._password and self._client_id:
            data = {
                "grant_type": "password",
                "username": self._username,
                "password": self._password,
            }
            auth = httpx.BasicAuth(self._client_id, self._client_secret or "")
        elif self._client_id and self._client_secret:
            data = {"grant_type": "client_credentials"}
            auth = httpx.BasicAuth(self._client_id, self._client_secret)
        else:
            return

        try:
            resp = await client.post(
                "/api/oauth/token",
                data=data,
                auth=auth,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            token_data = resp.json()
            self._access_token = token_data["access_token"]
            client.headers["Authorization"] = f"Bearer {self._access_token}"
        except httpx.HTTPStatusError as exc:
            raise OpenLMISClientError(
                f"OAuth2 authentication failed [{exc.response.status_code}]: "
                f"{exc.response.text[:512]}"
            ) from exc
        except httpx.RequestError as exc:
            raise OpenLMISClientError(
                f"Network error during authentication: {exc}"
            ) from exc

    def _client_or_raise(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = self._build_client()
        return self._client

    async def _get_json(
        self, path: str, params: dict[str, str] | None = None
    ) -> dict | list:
        client = self._client_or_raise()
        try:
            resp = await client.get(path, params=params or {})
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise OpenLMISClientError(
                f"OpenLMIS GET {path} failed [{exc.response.status_code}]: "
                f"{exc.response.text[:512]}"
            ) from exc
        except httpx.RequestError as exc:
            raise OpenLMISClientError(f"Network error fetching {path}: {exc}") from exc
        return resp.json()

    async def _get_paged(
        self,
        path: str,
        collection_key: str = "content",
        params: dict[str, str] | None = None,
        max_items: int = 1000,
    ) -> list[dict]:
        """Fetch all pages of an OpenLMIS Spring Data paginated collection."""
        params = {**(params or {}), "size": str(_DEFAULT_PAGE_SIZE), "page": "0"}
        items: list[dict] = []

        while len(items) < max_items:
            data = await self._get_json(path, params)

            if isinstance(data, list):
                batch = data
            elif collection_key:
                batch = data.get(collection_key, [])
            else:
                batch = data.get("content", [])

            items.extend(batch)

            if isinstance(data, dict):
                total_pages = data.get("totalPages", 1)
                current_page = data.get("number", int(params["page"]))
                if current_page + 1 >= total_pages:
                    break
            else:
                break

            params["page"] = str(int(params["page"]) + 1)

        return items[:max_items]

    # -- Public data fetchers ------------------------------------------------

    async def fetch_facilities(
        self,
        *,
        max_items: int = 1000,
    ) -> list[dict]:
        """Fetch facilities from the OpenLMIS reference data service."""
        return await self._get_paged(
            "/api/facilities",
            collection_key="content",
            max_items=max_items,
        )

    async def fetch_facility_types(self) -> list[dict]:
        """Fetch facility type reference data."""
        data = await self._get_json("/api/facilityTypes")
        if isinstance(data, list):
            return data
        return data.get("content", [])

    async def fetch_stock_cards(
        self,
        *,
        facility_id: str | None = None,
        program_id: str | None = None,
        max_items: int = 2000,
    ) -> list[dict]:
        """Fetch stock cards (current inventory state) from the stock management service."""
        params: dict[str, str] = {}
        if facility_id:
            params["facilityId"] = facility_id
        if program_id:
            params["programId"] = program_id

        return await self._get_paged(
            "/api/stockCards",
            collection_key="content",
            params=params,
            max_items=max_items,
        )

    async def fetch_stock_card_summaries(
        self,
        *,
        facility_id: str | None = None,
        program_id: str | None = None,
        max_items: int = 2000,
    ) -> list[dict]:
        """Fetch stock card summaries (stock-on-hand per orderable)."""
        params: dict[str, str] = {}
        if facility_id:
            params["facilityId"] = facility_id
        if program_id:
            params["programId"] = program_id

        return await self._get_paged(
            "/api/stockCardSummaries",
            collection_key="content",
            params=params,
            max_items=max_items,
        )

    async def fetch_requisitions(
        self,
        *,
        facility_id: str | None = None,
        program_id: str | None = None,
        status: str | None = None,
        max_items: int = 1000,
    ) -> list[dict]:
        """Fetch requisitions (consumption and ordering data)."""
        params: dict[str, str] = {}
        if facility_id:
            params["facilityId"] = facility_id
        if program_id:
            params["programId"] = program_id
        if status:
            params["status"] = status

        return await self._get_paged(
            "/api/requisitions/search",
            collection_key="content",
            params=params,
            max_items=max_items,
        )

    async def fetch_orderables(
        self,
        *,
        max_items: int = 2000,
    ) -> list[dict]:
        """Fetch orderables (products/vaccines master data)."""
        return await self._get_paged(
            "/api/orderables",
            collection_key="content",
            max_items=max_items,
        )

    async def fetch_programs(self) -> list[dict]:
        """Fetch programs (e.g., EPI, malaria)."""
        data = await self._get_json("/api/programs")
        if isinstance(data, list):
            return data
        return data.get("content", [])

    async def test_connection(self) -> dict:
        """Verify connectivity by checking the API root or facilities endpoint."""
        data = await self._get_json("/api/facilities", params={"size": "1"})
        if isinstance(data, dict):
            return {
                "status": "ok",
                "totalFacilities": data.get("totalElements", 0),
            }
        return {"status": "ok"}
