"""OpenLMIS integration API endpoints.

POST /api/v1/integrations/openlmis/sync       — trigger a full or incremental sync
GET  /api/v1/integrations/openlmis/sync/status — latest sync status for a config
POST /api/v1/integrations/openlmis/configs     — create an OpenLMIS connection config
GET  /api/v1/integrations/openlmis/configs     — list all configs
POST /api/v1/integrations/openlmis/test        — test an OpenLMIS connection
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.integrations.openlmis.client import OpenLMISClient, OpenLMISClientError
from app.integrations.openlmis.mapper import OpenLMISMapper, OpenLMISMappingConfig
from app.models.coverage import CoverageFacility
from app.models.openlmis_sync import OpenLMISSyncConfig, OpenLMISSyncLog, OpenLMISSyncStatus
from app.models.supply import SupplyTransaction
from app.schemas.openlmis import (
    OpenLMISConfigCreate,
    OpenLMISConfigResponse,
    OpenLMISSyncRequest,
    OpenLMISSyncStatusResponse,
    OpenLMISTestConnectionResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations/openlmis", tags=["openlmis"])


# -- Configs -----------------------------------------------------------------


@router.post("/configs", response_model=OpenLMISConfigResponse, status_code=201)
async def create_config(
    body: OpenLMISConfigCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new OpenLMIS instance configuration."""
    config = OpenLMISSyncConfig(
        name=body.name,
        base_url=body.base_url,
        client_id=body.client_id,
        client_secret_encrypted=body.client_secret,
        auth_username=body.auth_username,
        auth_password_encrypted=body.auth_password,
        country_code=body.country_code,
        mapping_config=body.mapping_config,
    )
    db.add(config)
    await db.flush()
    await db.refresh(config)
    return config


@router.get("/configs", response_model=list[OpenLMISConfigResponse])
async def list_configs(db: AsyncSession = Depends(get_db)):
    """List all OpenLMIS connection configurations."""
    result = await db.execute(
        select(OpenLMISSyncConfig).order_by(OpenLMISSyncConfig.created_at.desc())
    )
    return result.scalars().all()


# -- Test connection ---------------------------------------------------------


@router.post("/test", response_model=OpenLMISTestConnectionResponse)
async def test_connection(body: OpenLMISConfigCreate):
    """Test connectivity to an OpenLMIS instance without saving."""
    try:
        async with OpenLMISClient(
            base_url=body.base_url,
            client_id=body.client_id,
            client_secret=body.client_secret,
            username=body.auth_username,
            password=body.auth_password,
        ) as client:
            info = await client.test_connection()
        return OpenLMISTestConnectionResponse(success=True, server_info=info)
    except OpenLMISClientError as exc:
        return OpenLMISTestConnectionResponse(success=False, error=str(exc))


# -- Sync --------------------------------------------------------------------


@router.post("/sync", response_model=OpenLMISSyncStatusResponse, status_code=202)
async def trigger_sync(
    body: OpenLMISSyncRequest,
    db: AsyncSession = Depends(get_db),
):
    """Trigger a full or incremental OpenLMIS data sync."""
    config = await db.get(OpenLMISSyncConfig, body.config_id)
    if config is None:
        raise HTTPException(status_code=404, detail="OpenLMIS config not found")

    sync_log = OpenLMISSyncLog(
        config_id=config.id,
        status=OpenLMISSyncStatus.running,
        sync_type=body.sync_type,
    )
    db.add(sync_log)
    await db.flush()
    await db.refresh(sync_log)

    try:
        stats = await _run_sync(config, sync_log, db)
        sync_log.status = OpenLMISSyncStatus.completed
        sync_log.completed_at = datetime.now(timezone.utc)
        sync_log.records_fetched = stats["fetched"]
        sync_log.records_created = stats["created"]
        sync_log.records_updated = stats["updated"]
        sync_log.records_failed = stats["failed"]
    except Exception as exc:
        logger.exception("OpenLMIS sync failed for config %s", config.id)
        sync_log.status = OpenLMISSyncStatus.failed
        sync_log.error_message = str(exc)[:2000]
        sync_log.completed_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(sync_log)
    return _log_to_response(sync_log)


@router.get("/sync/status", response_model=list[OpenLMISSyncStatusResponse])
async def sync_status(
    config_id: uuid.UUID | None = None,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """Get the latest sync log entries, optionally filtered by config."""
    q = select(OpenLMISSyncLog).order_by(OpenLMISSyncLog.started_at.desc()).limit(limit)
    if config_id:
        q = q.where(OpenLMISSyncLog.config_id == config_id)
    result = await db.execute(q)
    return [_log_to_response(row) for row in result.scalars().all()]


# -- Sync orchestration (inline for MVP) ------------------------------------


async def _run_sync(
    config: OpenLMISSyncConfig, log: OpenLMISSyncLog, db: AsyncSession
) -> dict[str, int]:
    """Execute a sync run: fetch from OpenLMIS → map → upsert into VaxAI DB."""
    stats = {"fetched": 0, "created": 0, "updated": 0, "failed": 0}

    mapping = (
        OpenLMISMappingConfig(config.mapping_config)
        if config.mapping_config
        else OpenLMISMappingConfig.default()
    )
    mapper = OpenLMISMapper(mapping)

    async with OpenLMISClient(
        base_url=config.base_url,
        client_id=config.client_id,
        client_secret=config.client_secret_encrypted,
        username=config.auth_username,
        password=config.auth_password_encrypted,
    ) as client:
        # 1. Sync facilities
        facilities_raw = await client.fetch_facilities()
        stats["fetched"] += len(facilities_raw)
        facilities = mapper.map_facilities(facilities_raw)
        for fac in facilities:
            if fac["lat"] is not None and fac["lng"] is not None:
                try:
                    await _upsert_coverage_facility(db, fac, mapping.country_code)
                    stats["created"] += 1
                except Exception:
                    logger.warning(
                        "Failed to upsert facility %s", fac["openlmis_id"], exc_info=True
                    )
                    stats["failed"] += 1

        # 2. Sync stock card summaries → inventory
        summaries = await client.fetch_stock_card_summaries(
            program_id=mapping.epi_program_id
        )
        stats["fetched"] += len(summaries)
        mapped = mapper.map_stock_card_summaries(summaries)

        for inv in mapped["inventory"]:
            try:
                await _insert_supply_transaction(db, inv)
                stats["created"] += 1
            except Exception:
                stats["failed"] += 1

    return stats


async def _upsert_coverage_facility(
    db: AsyncSession, fac: dict, country_code: str
) -> None:
    facility_id = fac["openlmis_id"][:32]
    existing = await db.get(CoverageFacility, facility_id)
    if existing:
        existing.name = fac["name"]
        existing.lat = fac["lat"]
        existing.lng = fac["lng"]
    else:
        db.add(
            CoverageFacility(
                id=facility_id,
                name=fac["name"],
                country=country_code,
                region=fac.get("geographic_zone") or "Unknown",
                lat=fac["lat"],
                lng=fac["lng"],
                coverage_rate=0.0,
                stock_status="adequate",
                vaccine_type="all",
                period="2024",
                doses_administered=0,
                target_population=0,
            )
        )


async def _insert_supply_transaction(db: AsyncSession, inv: dict) -> None:
    db.add(
        SupplyTransaction(
            supply_item_id=uuid.uuid4(),
            transaction_type=inv["transaction_type"],
            quantity=inv["quantity"],
            facility_id=inv.get("facility_id"),
            transaction_date=None,
            extra={
                "source": "openlmis",
                "orderable_id": inv.get("openlmis_orderable_id"),
            },
        )
    )


def _log_to_response(log: OpenLMISSyncLog) -> OpenLMISSyncStatusResponse:
    return OpenLMISSyncStatusResponse(
        id=log.id,
        config_id=log.config_id,
        status=log.status.value,
        sync_type=log.sync_type,
        records_fetched=log.records_fetched,
        records_created=log.records_created,
        records_updated=log.records_updated,
        records_failed=log.records_failed,
        error_message=log.error_message,
        started_at=log.started_at,
        completed_at=log.completed_at,
    )
