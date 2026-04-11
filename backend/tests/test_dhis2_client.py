"""Unit tests for the DHIS2 API client."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.integrations.dhis2.client import DHIS2Client, DHIS2ClientError


@pytest.fixture
def mock_response():
    """Factory for httpx.Response objects."""

    def _make(status_code: int = 200, json_data: dict | None = None):
        resp = httpx.Response(
            status_code=status_code,
            content=json.dumps(json_data or {}).encode(),
            headers={"content-type": "application/json"},
            request=httpx.Request("GET", "https://test.dhis2.org/api/test"),
        )
        return resp

    return _make


class TestDHIS2ClientInit:
    def test_basic_auth_config(self):
        client = DHIS2Client(
            base_url="https://play.dhis2.org/40",
            username="admin",
            password="district",
        )
        assert client.base_url == "https://play.dhis2.org/40"

    def test_pat_auth_config(self):
        client = DHIS2Client(
            base_url="https://play.dhis2.org/40/",
            personal_access_token="d2pat_abc123",
        )
        assert client.base_url == "https://play.dhis2.org/40"

    def test_trailing_slash_stripped(self):
        client = DHIS2Client(base_url="https://example.org/dhis2/")
        assert client.base_url == "https://example.org/dhis2"


class TestDHIS2ClientFetchers:
    @pytest.mark.asyncio
    async def test_fetch_organisation_units_parses_paged_response(self, mock_response):
        page_data = {
            "pager": {"page": 1, "pageCount": 1, "total": 2},
            "organisationUnits": [
                {"id": "OU1", "displayName": "Facility A", "level": 4},
                {"id": "OU2", "displayName": "Facility B", "level": 4},
            ],
        }

        async def mock_get(url, params=None):
            return mock_response(200, page_data)

        client = DHIS2Client(base_url="https://test.dhis2.org", username="u", password="p")
        mock_http = AsyncMock()
        mock_http.get = mock_get
        mock_http.aclose = AsyncMock()
        client._client = mock_http

        units = await client.fetch_organisation_units(level=4)
        assert len(units) == 2
        assert units[0]["id"] == "OU1"
        assert units[1]["displayName"] == "Facility B"

    @pytest.mark.asyncio
    async def test_fetch_data_elements_returns_list(self, mock_response):
        page_data = {
            "pager": {"page": 1, "pageCount": 1},
            "dataElements": [
                {"id": "DE1", "displayName": "BCG doses given", "valueType": "INTEGER"},
            ],
        }

        async def mock_get(url, params=None):
            return mock_response(200, page_data)

        client = DHIS2Client(base_url="https://test.dhis2.org", username="u", password="p")
        mock_http = AsyncMock()
        mock_http.get = mock_get
        mock_http.aclose = AsyncMock()
        client._client = mock_http

        elements = await client.fetch_data_elements()
        assert len(elements) == 1
        assert elements[0]["displayName"] == "BCG doses given"

    @pytest.mark.asyncio
    async def test_fetch_data_value_sets_returns_values(self, mock_response):
        resp_data = {
            "dataValues": [
                {"dataElement": "DE1", "period": "202401", "orgUnit": "OU1", "value": "150"},
                {"dataElement": "DE2", "period": "202401", "orgUnit": "OU1", "value": "200"},
            ]
        }

        async def mock_get(url, params=None):
            return mock_response(200, resp_data)

        client = DHIS2Client(base_url="https://test.dhis2.org", username="u", password="p")
        mock_http = AsyncMock()
        mock_http.get = mock_get
        mock_http.aclose = AsyncMock()
        client._client = mock_http

        values = await client.fetch_data_value_sets(org_unit="OU1", period="202401")
        assert len(values) == 2
        assert values[0]["value"] == "150"

    @pytest.mark.asyncio
    async def test_http_error_raises_dhis2_client_error(self, mock_response):
        async def mock_get(url, params=None):
            resp = mock_response(403, {"message": "Forbidden"})
            raise httpx.HTTPStatusError(
                "Forbidden", request=resp.request, response=resp
            )

        client = DHIS2Client(base_url="https://test.dhis2.org", username="u", password="p")
        mock_http = AsyncMock()
        mock_http.get = mock_get
        mock_http.aclose = AsyncMock()
        client._client = mock_http

        with pytest.raises(DHIS2ClientError, match="403"):
            await client.test_connection()

    @pytest.mark.asyncio
    async def test_test_connection_returns_system_info(self, mock_response):
        info = {"version": "2.40.4", "revision": "abc123"}

        async def mock_get(url, params=None):
            return mock_response(200, info)

        client = DHIS2Client(base_url="https://test.dhis2.org", username="u", password="p")
        mock_http = AsyncMock()
        mock_http.get = mock_get
        mock_http.aclose = AsyncMock()
        client._client = mock_http

        result = await client.test_connection()
        assert result["version"] == "2.40.4"
