"""mSupply Central Server API client.

Implements the ExternalDataSource adapter pattern. Fetches stores (facilities),
stock lines (inventory), requisitions (usage data), and items from any
mSupply Central Server instance.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_DEFAULT_PAGE_SIZE = 50
_DEFAULT_TIMEOUT = 60.0


class MSupplyClientError(Exception):
    """Raised when the mSupply API returns an unexpected response."""


class MSupplyClient:
    """Async mSupply Central Server API client.

    Supports username/password authentication against the mSupply REST API.

    Usage::

        async with MSupplyClient(base_url="https://msupply.example.org",
                                  username="admin", password="secret") as client:
            stores = await client.fetch_stores()
    """

    def __init__(
        self,
        base_url: str,
        *,
        username: str | None = None,
        password: str | None = None,
        api_token: str | None = None,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._username = username
        self._password = password
        self._api_token = api_token
        self._timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> MSupplyClient:
        self._client = self._build_client()
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    def _build_client(self) -> httpx.AsyncClient:
        headers: dict[str, str] = {"Accept": "application/json"}
        auth = None

        if self._api_token:
            headers["Authorization"] = f"Bearer {self._api_token}"
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

    async def _get_json(
        self, path: str, params: dict[str, str] | None = None
    ) -> dict | list:
        client = self._client_or_raise()
        try:
            resp = await client.get(path, params=params or {})
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise MSupplyClientError(
                f"mSupply GET {path} failed [{exc.response.status_code}]: "
                f"{exc.response.text[:512]}"
            ) from exc
        except httpx.RequestError as exc:
            raise MSupplyClientError(
                f"Network error fetching {path}: {exc}"
            ) from exc
        return resp.json()

    async def _get_paged(
        self,
        path: str,
        collection_key: str | None = None,
        params: dict[str, str] | None = None,
        max_items: int = 1000,
    ) -> list[dict]:
        params = {**(params or {}), "limit": str(_DEFAULT_PAGE_SIZE), "offset": "0"}
        items: list[dict] = []

        while len(items) < max_items:
            data = await self._get_json(path, params)

            if isinstance(data, list):
                batch = data
            elif collection_key:
                batch = data.get(collection_key, [])
            else:
                batch = data.get("data", data.get("rows", []))

            items.extend(batch)

            if len(batch) < _DEFAULT_PAGE_SIZE:
                break
            params["offset"] = str(int(params["offset"]) + _DEFAULT_PAGE_SIZE)

        return items[:max_items]

    # -- Public data fetchers ------------------------------------------------

    async def fetch_stores(
        self,
        *,
        max_items: int = 1000,
    ) -> list[dict]:
        """Fetch stores (facilities/warehouses) from mSupply."""
        return await self._get_paged(
            "/api/v4/stores",
            collection_key="stores",
            max_items=max_items,
        )

    async def fetch_stock_lines(
        self,
        *,
        store_id: str | None = None,
        item_id: str | None = None,
        max_items: int = 2000,
    ) -> list[dict]:
        """Fetch stock lines (current inventory levels)."""
        params: dict[str, str] = {}
        if store_id:
            params["store_id"] = store_id
        if item_id:
            params["item_id"] = item_id

        return await self._get_paged(
            "/api/v4/stock_lines",
            collection_key="stock_lines",
            params=params,
            max_items=max_items,
        )

    async def fetch_items(
        self,
        *,
        is_vaccine: bool | None = None,
        max_items: int = 2000,
    ) -> list[dict]:
        """Fetch item master data (vaccines, supplies, etc.)."""
        params: dict[str, str] = {}
        if is_vaccine is not None:
            params["is_vaccine"] = str(is_vaccine).lower()

        return await self._get_paged(
            "/api/v4/items",
            collection_key="items",
            params=params,
            max_items=max_items,
        )

    async def fetch_requisitions(
        self,
        *,
        store_id: str | None = None,
        status: str | None = None,
        max_items: int = 1000,
    ) -> list[dict]:
        """Fetch requisitions (consumption/ordering data)."""
        params: dict[str, str] = {}
        if store_id:
            params["store_id"] = store_id
        if status:
            params["status"] = status

        return await self._get_paged(
            "/api/v4/requisitions",
            collection_key="requisitions",
            params=params,
            max_items=max_items,
        )

    async def fetch_requisition_lines(
        self,
        requisition_id: str,
        *,
        max_items: int = 2000,
    ) -> list[dict]:
        """Fetch line items for a specific requisition."""
        return await self._get_paged(
            f"/api/v4/requisitions/{requisition_id}/lines",
            collection_key="lines",
            max_items=max_items,
        )

    async def test_connection(self) -> dict:
        """Verify connectivity by hitting /api/v4/server_info or root."""
        data = await self._get_json("/api/v4/server_info")
        return data if isinstance(data, dict) else {"status": "ok"}
