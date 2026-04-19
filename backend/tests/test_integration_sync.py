"""
Integration sync tests — DHIS2, OpenLMIS, and mSupply.

Covers for each integration:
  - POST /integrations/{system}/configs — create a connection config (201)
  - GET  /integrations/{system}/configs — list configs
  - POST /integrations/{system}/test    — test connection (mocked external call)
  - POST /integrations/{system}/sync    — trigger sync (404 for bad config id)
  - GET  /integrations/{system}/sync/status — sync log retrieval

All external HTTP calls to DHIS2 / OpenLMIS / mSupply servers are patched so
the tests are fully self-contained without network access.
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


# ── DHIS2 ─────────────────────────────────────────────────────────────────────


class TestDHIS2Config:
    @pytest.mark.asyncio
    async def test_create_dhis2_config(self, client: AsyncClient) -> None:
        """POST /integrations/dhis2/configs creates and returns a config (201)."""
        resp = await client.post(
            "/api/v1/integrations/dhis2/configs",
            json={
                "name": "Test DHIS2 Instance",
                "base_url": "https://dhis2.example.org",
                "auth_username": "admin",
                "auth_password": "district",
                "country_code": "KE",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["name"] == "Test DHIS2 Instance"
        assert data["base_url"] == "https://dhis2.example.org"
        assert data["country_code"] == "KE"

    @pytest.mark.asyncio
    async def test_list_dhis2_configs(self, client: AsyncClient) -> None:
        """GET /integrations/dhis2/configs returns a list of configs."""
        # Create one first
        await client.post(
            "/api/v1/integrations/dhis2/configs",
            json={
                "name": "List Test DHIS2",
                "base_url": "https://list.dhis2.org",
                "auth_username": "admin",
                "auth_password": "district",
                "country_code": "UG",
            },
        )
        resp = await client.get("/api/v1/integrations/dhis2/configs")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1

    @pytest.mark.asyncio
    async def test_dhis2_config_fields_present(self, client: AsyncClient) -> None:
        """Created DHIS2 config has required response fields."""
        resp = await client.post(
            "/api/v1/integrations/dhis2/configs",
            json={
                "name": "Field Check DHIS2",
                "base_url": "https://fields.dhis2.org",
                "auth_username": "admin",
                "auth_password": "district",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        for key in ("id", "name", "base_url", "created_at"):
            assert key in data, f"Missing field: {key}"


class TestDHIS2Connection:
    @pytest.mark.asyncio
    async def test_dhis2_test_connection_success(self, client: AsyncClient) -> None:
        """POST /integrations/dhis2/test returns success when the DHIS2 server responds."""
        mock_info = {"version": "2.40.4", "revision": "abc123"}
        with patch(
            "app.integrations.dhis2.client.DHIS2Client.test_connection",
            new_callable=AsyncMock,
            return_value=mock_info,
        ):
            resp = await client.post(
                "/api/v1/integrations/dhis2/test",
                json={
                    "name": "Conn Test",
                    "base_url": "https://test.dhis2.org",
                    "auth_username": "admin",
                    "auth_password": "district",
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "server_info" in data

    @pytest.mark.asyncio
    async def test_dhis2_test_connection_failure(self, client: AsyncClient) -> None:
        """POST /integrations/dhis2/test returns success=false when the server is unreachable."""
        from app.integrations.dhis2.client import DHIS2ClientError

        with patch(
            "app.integrations.dhis2.client.DHIS2Client.test_connection",
            new_callable=AsyncMock,
            side_effect=DHIS2ClientError("Connection refused"),
        ):
            resp = await client.post(
                "/api/v1/integrations/dhis2/test",
                json={
                    "name": "Fail Test",
                    "base_url": "https://offline.dhis2.org",
                    "auth_username": "admin",
                    "auth_password": "district",
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "error" in data


class TestDHIS2Sync:
    @pytest.mark.asyncio
    async def test_dhis2_sync_unknown_config_returns_404(
        self, client: AsyncClient
    ) -> None:
        """Triggering a sync for a non-existent config returns 404."""
        resp = await client.post(
            "/api/v1/integrations/dhis2/sync",
            json={"config_id": str(uuid.uuid4()), "sync_type": "full"},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_dhis2_sync_creates_log_entry(self, client: AsyncClient) -> None:
        """Triggering a sync for a real config creates a sync log entry."""
        # Create config first
        config_resp = await client.post(
            "/api/v1/integrations/dhis2/configs",
            json={
                "name": "Sync Log Test DHIS2",
                "base_url": "https://synclog.dhis2.org",
                "auth_username": "admin",
                "auth_password": "district",
                "country_code": "TZ",
            },
        )
        assert config_resp.status_code == 201
        config_id = config_resp.json()["id"]

        with patch(
            "app.api.v1.dhis2._run_sync",
            new_callable=AsyncMock,
            return_value={"fetched": 0, "created": 0, "updated": 0, "failed": 0},
        ):
            sync_resp = await client.post(
                "/api/v1/integrations/dhis2/sync",
                json={"config_id": config_id, "sync_type": "full"},
            )
        assert sync_resp.status_code == 202
        data = sync_resp.json()
        assert "id" in data
        assert data["config_id"] == config_id
        assert data["status"] in ("completed", "failed", "running")

    @pytest.mark.asyncio
    async def test_dhis2_sync_status_list(self, client: AsyncClient) -> None:
        """GET /integrations/dhis2/sync/status returns a list."""
        resp = await client.get("/api/v1/integrations/dhis2/sync/status")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_dhis2_sync_error_handling(self, client: AsyncClient) -> None:
        """A sync that errors internally results in status=failed, not a 500."""
        config_resp = await client.post(
            "/api/v1/integrations/dhis2/configs",
            json={
                "name": "Error Test DHIS2",
                "base_url": "https://error.dhis2.org",
                "auth_username": "admin",
                "auth_password": "district",
            },
        )
        assert config_resp.status_code == 201
        config_id = config_resp.json()["id"]

        with patch(
            "app.api.v1.dhis2._run_sync",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Simulated sync failure"),
        ):
            sync_resp = await client.post(
                "/api/v1/integrations/dhis2/sync",
                json={"config_id": config_id, "sync_type": "full"},
            )
        assert sync_resp.status_code == 202
        data = sync_resp.json()
        assert data["status"] == "failed"
        assert data["error_message"] is not None


# ── OpenLMIS ──────────────────────────────────────────────────────────────────


class TestOpenLMISConfig:
    @pytest.mark.asyncio
    async def test_create_openlmis_config(self, client: AsyncClient) -> None:
        """POST /integrations/openlmis/configs creates a config (201)."""
        resp = await client.post(
            "/api/v1/integrations/openlmis/configs",
            json={
                "name": "Test OpenLMIS",
                "base_url": "https://openlmis.example.org",
                "client_id": "vaxai-client",
                "client_secret": "secret123",
                "auth_username": "admin",
                "auth_password": "password",
                "country_code": "NG",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["name"] == "Test OpenLMIS"

    @pytest.mark.asyncio
    async def test_list_openlmis_configs(self, client: AsyncClient) -> None:
        """GET /integrations/openlmis/configs returns a list."""
        resp = await client.get("/api/v1/integrations/openlmis/configs")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestOpenLMISConnection:
    @pytest.mark.asyncio
    async def test_openlmis_test_connection_success(self, client: AsyncClient) -> None:
        """POST /integrations/openlmis/test returns success when server responds."""
        with patch(
            "app.integrations.openlmis.client.OpenLMISClient.test_connection",
            new_callable=AsyncMock,
            return_value={"version": "1.2.0", "name": "OpenLMIS"},
        ):
            resp = await client.post(
                "/api/v1/integrations/openlmis/test",
                json={
                    "name": "OLMIS Test",
                    "base_url": "https://olmis.example.org",
                    "client_id": "client",
                    "client_secret": "secret",
                    "auth_username": "admin",
                    "auth_password": "password",
                },
            )
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    @pytest.mark.asyncio
    async def test_openlmis_test_connection_failure(
        self, client: AsyncClient
    ) -> None:
        """POST /integrations/openlmis/test returns success=false on connection error."""
        from app.integrations.openlmis.client import OpenLMISClientError

        with patch(
            "app.integrations.openlmis.client.OpenLMISClient.test_connection",
            new_callable=AsyncMock,
            side_effect=OpenLMISClientError("Timeout"),
        ):
            resp = await client.post(
                "/api/v1/integrations/openlmis/test",
                json={
                    "name": "Fail OLMIS",
                    "base_url": "https://down.olmis.org",
                    "client_id": "c",
                    "client_secret": "s",
                    "auth_username": "u",
                    "auth_password": "p",
                },
            )
        assert resp.status_code == 200
        assert resp.json()["success"] is False


class TestOpenLMISSync:
    @pytest.mark.asyncio
    async def test_openlmis_sync_unknown_config_returns_404(
        self, client: AsyncClient
    ) -> None:
        """Triggering OpenLMIS sync for a non-existent config returns 404."""
        resp = await client.post(
            "/api/v1/integrations/openlmis/sync",
            json={"config_id": str(uuid.uuid4()), "sync_type": "full"},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_openlmis_sync_creates_log(self, client: AsyncClient) -> None:
        """Triggering sync for a valid config returns 202 with a log entry."""
        config_resp = await client.post(
            "/api/v1/integrations/openlmis/configs",
            json={
                "name": "Sync OpenLMIS Log",
                "base_url": "https://sync.olmis.org",
                "client_id": "c",
                "client_secret": "s",
                "auth_username": "admin",
                "auth_password": "password",
                "country_code": "GH",
            },
        )
        assert config_resp.status_code == 201
        config_id = config_resp.json()["id"]

        with patch(
            "app.api.v1.openlmis._run_sync",
            new_callable=AsyncMock,
            return_value={"fetched": 0, "created": 0, "updated": 0, "failed": 0},
        ):
            sync_resp = await client.post(
                "/api/v1/integrations/openlmis/sync",
                json={"config_id": config_id, "sync_type": "incremental"},
            )
        assert sync_resp.status_code == 202
        data = sync_resp.json()
        assert "id" in data
        assert data["config_id"] == config_id

    @pytest.mark.asyncio
    async def test_openlmis_sync_status_list(self, client: AsyncClient) -> None:
        """GET /integrations/openlmis/sync/status returns a list."""
        resp = await client.get("/api/v1/integrations/openlmis/sync/status")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_openlmis_sync_error_recorded_as_failed(
        self, client: AsyncClient
    ) -> None:
        """A sync that throws internally results in status=failed."""
        config_resp = await client.post(
            "/api/v1/integrations/openlmis/configs",
            json={
                "name": "Error OLMIS",
                "base_url": "https://err.olmis.org",
                "client_id": "c",
                "client_secret": "s",
                "auth_username": "admin",
                "auth_password": "password",
            },
        )
        config_id = config_resp.json()["id"]

        with patch(
            "app.api.v1.openlmis._run_sync",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Simulated failure"),
        ):
            sync_resp = await client.post(
                "/api/v1/integrations/openlmis/sync",
                json={"config_id": config_id, "sync_type": "full"},
            )
        assert sync_resp.status_code == 202
        assert sync_resp.json()["status"] == "failed"


# ── mSupply ───────────────────────────────────────────────────────────────────


class TestMSupplyConfig:
    @pytest.mark.asyncio
    async def test_create_msupply_config(self, client: AsyncClient) -> None:
        """POST /integrations/msupply/configs creates a config (201)."""
        resp = await client.post(
            "/api/v1/integrations/msupply/configs",
            json={
                "name": "Test mSupply",
                "base_url": "https://msupply.example.org",
                "auth_username": "admin",
                "auth_password": "password",
                "country_code": "ZM",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["name"] == "Test mSupply"

    @pytest.mark.asyncio
    async def test_list_msupply_configs(self, client: AsyncClient) -> None:
        """GET /integrations/msupply/configs returns a list."""
        resp = await client.get("/api/v1/integrations/msupply/configs")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestMSupplyConnection:
    @pytest.mark.asyncio
    async def test_msupply_test_connection_success(self, client: AsyncClient) -> None:
        """POST /integrations/msupply/test returns success=true on good connection."""
        with patch(
            "app.integrations.msupply.client.MSupplyClient.test_connection",
            new_callable=AsyncMock,
            return_value={"version": "7.0", "name": "mSupply"},
        ):
            resp = await client.post(
                "/api/v1/integrations/msupply/test",
                json={
                    "name": "mS Test",
                    "base_url": "https://msupply.example.org",
                    "auth_username": "admin",
                    "auth_password": "password",
                },
            )
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    @pytest.mark.asyncio
    async def test_msupply_test_connection_failure(self, client: AsyncClient) -> None:
        """POST /integrations/msupply/test returns success=false on error."""
        from app.integrations.msupply.client import MSupplyClientError

        with patch(
            "app.integrations.msupply.client.MSupplyClient.test_connection",
            new_callable=AsyncMock,
            side_effect=MSupplyClientError("Auth failed"),
        ):
            resp = await client.post(
                "/api/v1/integrations/msupply/test",
                json={
                    "name": "Fail mS",
                    "base_url": "https://down.msupply.org",
                    "auth_username": "admin",
                    "auth_password": "wrong",
                },
            )
        assert resp.status_code == 200
        assert resp.json()["success"] is False


class TestMSupplySync:
    @pytest.mark.asyncio
    async def test_msupply_sync_unknown_config_returns_404(
        self, client: AsyncClient
    ) -> None:
        """Triggering mSupply sync for a non-existent config returns 404."""
        resp = await client.post(
            "/api/v1/integrations/msupply/sync",
            json={"config_id": str(uuid.uuid4()), "sync_type": "full"},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_msupply_sync_creates_log(self, client: AsyncClient) -> None:
        """Triggering sync for a valid config returns 202."""
        config_resp = await client.post(
            "/api/v1/integrations/msupply/configs",
            json={
                "name": "mSupply Sync Log",
                "base_url": "https://sync.msupply.org",
                "auth_username": "admin",
                "auth_password": "password",
                "country_code": "MW",
            },
        )
        assert config_resp.status_code == 201
        config_id = config_resp.json()["id"]

        with patch(
            "app.api.v1.msupply._run_sync",
            new_callable=AsyncMock,
            return_value={"fetched": 5, "created": 5, "updated": 0, "failed": 0},
        ):
            sync_resp = await client.post(
                "/api/v1/integrations/msupply/sync",
                json={"config_id": config_id, "sync_type": "full"},
            )
        assert sync_resp.status_code == 202
        data = sync_resp.json()
        assert data["config_id"] == config_id
        assert data["status"] == "completed"
        assert data["records_fetched"] == 5

    @pytest.mark.asyncio
    async def test_msupply_sync_status_list(self, client: AsyncClient) -> None:
        """GET /integrations/msupply/sync/status returns a list."""
        resp = await client.get("/api/v1/integrations/msupply/sync/status")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_msupply_sync_error_recorded_as_failed(
        self, client: AsyncClient
    ) -> None:
        """A sync that throws internally results in status=failed."""
        config_resp = await client.post(
            "/api/v1/integrations/msupply/configs",
            json={
                "name": "Error mSupply",
                "base_url": "https://err.msupply.org",
                "auth_username": "admin",
                "auth_password": "password",
            },
        )
        config_id = config_resp.json()["id"]

        with patch(
            "app.api.v1.msupply._run_sync",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Network error"),
        ):
            sync_resp = await client.post(
                "/api/v1/integrations/msupply/sync",
                json={"config_id": config_id, "sync_type": "full"},
            )
        assert sync_resp.status_code == 202
        assert sync_resp.json()["status"] == "failed"
        assert sync_resp.json()["error_message"] is not None
