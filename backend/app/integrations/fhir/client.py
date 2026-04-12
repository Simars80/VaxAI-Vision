"""Generic FHIR R4 API client with SMART on FHIR OAuth2 support.

Implements the ExternalDataSource adapter pattern. Fetches Location (facilities),
SupplyDelivery/SupplyRequest (inventory), Immunization (coverage), and Device
(cold chain equipment) resources from any FHIR R4-compliant server.
"""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlencode, urljoin

import httpx

logger = logging.getLogger(__name__)

_DEFAULT_PAGE_SIZE = 50
_DEFAULT_TIMEOUT = 60.0


class FHIRClientError(Exception):
    """Raised when the FHIR server returns an unexpected response."""


class FHIRClient:
    """Async FHIR R4 API client.

    Supports SMART on FHIR OAuth2 (client credentials) and static Bearer tokens.

    Usage::

        async with FHIRClient(
            base_url="https://fhir.example.org/fhir",
            client_id="my-app",
            client_secret="secret",
            token_url="https://fhir.example.org/auth/token",
        ) as client:
            locations = await client.fetch_locations()
    """

    def __init__(
        self,
        base_url: str,
        *,
        client_id: str | None = None,
        client_secret: str | None = None,
        token_url: str | None = None,
        access_token: str | None = None,
        scopes: str = "system/*.read",
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._client_id = client_id
        self._client_secret = client_secret
        self._token_url = token_url
        self._access_token = access_token
        self._scopes = scopes
        self._timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> FHIRClient:
        self._client = self._build_client()
        if not self._access_token and self._client_id and self._client_secret and self._token_url:
            await self._authenticate()
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    def _build_client(self) -> httpx.AsyncClient:
        headers: dict[str, str] = {
            "Accept": "application/fhir+json",
            "Content-Type": "application/fhir+json",
        }
        if self._access_token:
            headers["Authorization"] = f"Bearer {self._access_token}"

        return httpx.AsyncClient(
            base_url=self.base_url,
            headers=headers,
            timeout=self._timeout,
            follow_redirects=True,
        )

    async def _authenticate(self) -> None:
        """Obtain an OAuth2 access token via SMART on FHIR client credentials flow."""
        client = self._client_or_raise()

        data = {
            "grant_type": "client_credentials",
            "scope": self._scopes,
        }

        try:
            resp = await client.post(
                self._token_url,
                data=data,
                auth=httpx.BasicAuth(self._client_id, self._client_secret),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            token_data = resp.json()
            self._access_token = token_data["access_token"]
            client.headers["Authorization"] = f"Bearer {self._access_token}"
        except httpx.HTTPStatusError as exc:
            raise FHIRClientError(
                f"SMART on FHIR authentication failed [{exc.response.status_code}]: "
                f"{exc.response.text[:512]}"
            ) from exc
        except httpx.RequestError as exc:
            raise FHIRClientError(
                f"Network error during SMART on FHIR authentication: {exc}"
            ) from exc

    def _client_or_raise(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = self._build_client()
        return self._client

    async def _get_json(
        self, path: str, params: dict[str, str] | None = None
    ) -> dict:
        client = self._client_or_raise()
        try:
            resp = await client.get(path, params=params or {})
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise FHIRClientError(
                f"FHIR GET {path} failed [{exc.response.status_code}]: "
                f"{exc.response.text[:512]}"
            ) from exc
        except httpx.RequestError as exc:
            raise FHIRClientError(
                f"Network error fetching {path}: {exc}"
            ) from exc
        return resp.json()

    async def _search_resource(
        self,
        resource_type: str,
        params: dict[str, str] | None = None,
        max_items: int = 1000,
    ) -> list[dict]:
        """Search a FHIR resource type and follow Bundle pagination links."""
        params = {**(params or {}), "_count": str(_DEFAULT_PAGE_SIZE)}
        items: list[dict] = []
        url = f"/{resource_type}"

        while url and len(items) < max_items:
            data = await self._get_json(url, params)
            params = None

            for entry in data.get("entry", []):
                resource = entry.get("resource")
                if resource:
                    items.append(resource)

            next_url = None
            for link in data.get("link", []):
                if link.get("relation") == "next":
                    next_url = link.get("url")
                    break

            if next_url and next_url.startswith(self.base_url):
                url = next_url[len(self.base_url):]
            elif next_url:
                url = next_url
            else:
                url = None

        return items[:max_items]

    # -- Public data fetchers ------------------------------------------------

    async def fetch_locations(
        self,
        *,
        max_items: int = 1000,
    ) -> list[dict]:
        """Fetch Location resources (facilities, wards, etc.)."""
        return await self._search_resource("Location", max_items=max_items)

    async def fetch_supply_deliveries(
        self,
        *,
        max_items: int = 2000,
    ) -> list[dict]:
        """Fetch SupplyDelivery resources (vaccine shipments/receipts)."""
        return await self._search_resource("SupplyDelivery", max_items=max_items)

    async def fetch_supply_requests(
        self,
        *,
        max_items: int = 2000,
    ) -> list[dict]:
        """Fetch SupplyRequest resources (vaccine orders/requisitions)."""
        return await self._search_resource("SupplyRequest", max_items=max_items)

    async def fetch_immunizations(
        self,
        *,
        vaccine_code: str | None = None,
        max_items: int = 2000,
    ) -> list[dict]:
        """Fetch Immunization resources (administered doses)."""
        params: dict[str, str] = {}
        if vaccine_code:
            params["vaccine-code"] = vaccine_code
        return await self._search_resource("Immunization", params=params, max_items=max_items)

    async def fetch_devices(
        self,
        *,
        device_type: str | None = None,
        max_items: int = 1000,
    ) -> list[dict]:
        """Fetch Device resources (cold chain equipment)."""
        params: dict[str, str] = {}
        if device_type:
            params["type"] = device_type
        return await self._search_resource("Device", params=params, max_items=max_items)

    async def fetch_metadata(self) -> dict:
        """Fetch the server's CapabilityStatement (metadata endpoint)."""
        return await self._get_json("/metadata")

    async def test_connection(self) -> dict:
        """Verify connectivity by fetching the CapabilityStatement."""
        meta = await self.fetch_metadata()
        return {
            "status": "ok",
            "fhir_version": meta.get("fhirVersion", "unknown"),
            "software": (meta.get("software") or {}).get("name", "unknown"),
        }
