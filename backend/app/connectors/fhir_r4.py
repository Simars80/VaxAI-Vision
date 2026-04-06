"""FHIR R4 read-only connector for VaxAI Vision.

Fetches Patient and SupplyDelivery resources from a SMART-on-FHIR / plain FHIR R4
server.  Only read operations are performed — this connector never writes back to
the EHR.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_DEFAULT_PAGE_SIZE = 50
_DEFAULT_TIMEOUT = 30.0  # seconds


class FHIRConnectorError(Exception):
    """Raised when the FHIR server returns an unexpected response."""


class FHIRr4Connector:
    """Async FHIR R4 read-only client.

    Usage::

        async with FHIRr4Connector(base_url="https://ehr.example.com/fhir/R4") as conn:
            patients = await conn.fetch_patients()
    """

    def __init__(self, base_url: str, bearer_token: str | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self._bearer_token = bearer_token
        self._client: httpx.AsyncClient | None = None

    # ── Context manager ────────────────────────────────────────────────────────

    async def __aenter__(self) -> "FHIRr4Connector":
        self._client = self._build_client()
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    def _build_client(self) -> httpx.AsyncClient:
        headers = {
            "Accept": "application/fhir+json",
            "Content-Type": "application/fhir+json",
        }
        if self._bearer_token:
            headers["Authorization"] = f"Bearer {self._bearer_token}"
        return httpx.AsyncClient(
            base_url=self.base_url,
            headers=headers,
            timeout=_DEFAULT_TIMEOUT,
            follow_redirects=True,
        )

    def _client_or_raise(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = self._build_client()
        return self._client

    # ── Internal helpers ───────────────────────────────────────────────────────

    async def _get_bundle(
        self,
        resource_type: str,
        params: dict[str, str],
        max_resources: int,
    ) -> list[dict]:
        """Fetch all pages of a FHIR search bundle up to max_resources entries."""
        client = self._client_or_raise()
        resources: list[dict] = []
        url = f"/{resource_type}"

        params = {**params, "_count": str(_DEFAULT_PAGE_SIZE)}

        while url and len(resources) < max_resources:
            try:
                resp = await client.get(url, params=params if "?" not in url else {})
                resp.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise FHIRConnectorError(
                    f"FHIR {resource_type} search failed [{exc.response.status_code}]: "
                    f"{exc.response.text[:256]}"
                ) from exc
            except httpx.RequestError as exc:
                raise FHIRConnectorError(
                    f"Network error fetching {resource_type}: {exc}"
                ) from exc

            bundle = resp.json()
            if bundle.get("resourceType") != "Bundle":
                raise FHIRConnectorError(
                    f"Expected Bundle, got {bundle.get('resourceType')!r}"
                )

            for entry in bundle.get("entry", []):
                if resource := entry.get("resource"):
                    resources.append(resource)
                    if len(resources) >= max_resources:
                        break

            # Follow FHIR pagination link rel="next"
            url = None
            for link in bundle.get("link", []):
                if link.get("relation") == "next":
                    next_url = link.get("url", "")
                    # Strip base URL prefix so httpx uses relative path
                    if next_url.startswith(self.base_url):
                        url = next_url[len(self.base_url) :]
                    else:
                        url = next_url
                    params = {}  # params are already in the next URL
                    break

        return resources

    # ── Patient fetch ──────────────────────────────────────────────────────────

    async def fetch_patients(
        self,
        updated_after: datetime | None = None,
        max_resources: int = 500,
    ) -> list[dict]:
        """Return a normalised list of patient records."""
        params: dict[str, str] = {}
        if updated_after:
            params["_lastUpdated"] = f"gt{updated_after.isoformat()}"

        raw_patients = await self._get_bundle("Patient", params, max_resources)
        return [self._normalise_patient(p) for p in raw_patients]

    @staticmethod
    def _normalise_patient(resource: dict) -> dict:
        """Map a FHIR Patient resource to our internal schema."""
        # Extract age from birthDate if present
        age_years: int | None = None
        if birth_date := resource.get("birthDate"):
            try:
                birth_year = int(birth_date[:4])
                age_years = datetime.utcnow().year - birth_year
            except (ValueError, TypeError):
                pass

        # Country from address
        country_code: str | None = None
        for addr in resource.get("address", []):
            if country := addr.get("country"):
                country_code = country[:2].upper()
                break

        # Managing organisation → facility_id
        facility_id: str | None = None
        if mo := resource.get("managingOrganization"):
            facility_id = mo.get("reference", "").split("/")[-1] or None

        return {
            "id": resource.get("id", ""),
            "gender": resource.get("gender"),
            "age_years": age_years,
            "country_code": country_code,
            "facility_id": facility_id,
            "census_date": None,
            "extra": {
                "meta": resource.get("meta"),
                "identifier": resource.get("identifier"),
            },
        }

    # ── SupplyDelivery fetch ───────────────────────────────────────────────────

    async def fetch_supply_deliveries(
        self,
        updated_after: datetime | None = None,
        max_resources: int = 500,
    ) -> list[dict]:
        """Return a normalised list of supply delivery records."""
        params: dict[str, str] = {}
        if updated_after:
            params["_lastUpdated"] = f"gt{updated_after.isoformat()}"

        raw = await self._get_bundle("SupplyDelivery", params, max_resources)
        return [self._normalise_supply_delivery(r) for r in raw]

    @staticmethod
    def _normalise_supply_delivery(resource: dict) -> dict:
        """Map a FHIR SupplyDelivery resource to our internal schema."""
        supplied = resource.get("suppliedItem", {})

        # Item code from CodeableConcept
        item_code: str | None = None
        item_name: str | None = None
        item_ref = supplied.get("itemCodeableConcept") or supplied.get(
            "itemReference", {}
        )
        if isinstance(item_ref, dict):
            for coding in item_ref.get("coding", []):
                item_code = coding.get("code")
                item_name = coding.get("display")
                break
            if not item_name:
                item_name = item_ref.get("text")
            if not item_code and (ref := item_ref.get("reference")):
                item_code = ref.split("/")[-1]

        # Quantity
        qty_obj = supplied.get("quantity", {})
        quantity = qty_obj.get("value", 0)
        uom = qty_obj.get("unit") or qty_obj.get("code")

        # Destination → facility
        facility_id: str | None = None
        facility_name: str | None = None
        if dest := resource.get("destination"):
            ref = dest.get("reference", "")
            facility_id = ref.split("/")[-1] or None
            facility_name = dest.get("display")

        # Transaction date
        tx_date: datetime | None = None
        if occ := resource.get("occurrenceDateTime") or resource.get(
            "occurrencePeriod", {}
        ).get("start"):
            try:
                tx_date = datetime.fromisoformat(occ.replace("Z", "+00:00"))
            except ValueError:
                pass

        return {
            "fhir_id": resource.get("id", ""),
            "item_code": item_code,
            "item_name": item_name,
            "quantity": quantity,
            "unit_of_measure": uom,
            "facility_id": facility_id,
            "facility_name": facility_name,
            "transaction_date": tx_date,
            "lot_number": None,
            "extra": {"meta": resource.get("meta")},
        }
