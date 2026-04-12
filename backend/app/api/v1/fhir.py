"""FHIR R4 integration API endpoints.

POST /api/v1/integrations/fhir/sync       -- trigger a full or incremental sync
GET  /api/v1/integrations/fhir/sync/status -- latest sync status for a config
POST /api/v1/integrations/fhir/configs     -- create a FHIR connection config
GET  /api/v1/integrations/fhir/configs     -- list all configs
POST /api/v1/integrations/fhir/test        -- test a FHIR connection
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.integrations.fhir.client import FHIRClient, FHIRClientError
from app.integrations.fhir.mapper import FHIRMapper, FHIRMappingConfig
from app.models.cold_chain import ColdChainFacility
from app.models.coverage import CoverageFacility
from app.models.fhir_sync import FHIRSyncConfig, FHIRSyncLog, FHIRSyncStatus
from app.models.supply import SupplyTransaction
from app.schemas.fhir import (
    FHIRConfigCreate,
    FHIRConfigResponse,
    FHIRSyncRequest,
    FHIRSyncStatusResponse,
    FHIRTestConnectionResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations/fhir", tags=["fhir"])


# -- Configs -----------------------------------------------------------------


@router.post("/configs", response_model=FHIRConfigResponse, status_code=201)
async def create_config(
    body: FHIRConfigCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new FHIR server configuration."""
    config = FHIRSyncConfig(
        name=body.name,
        base_url=body.base_url,
        client_id=body.client_id,
        client_secret_encrypted=body.client_secret,  # TODO: encrypt in production
        token_url=body.token_url,
        scopes=body.scopes,
        access_token_encrypted=body.access_token,  # TODO: encrypt in production
        country_code=body.country_code,
        mapping_config=body.mapping_config,
    )
    db.add(config)
    await db.flush()
    await db.refresh(config)
    return config


@router.get("/configs", response_model=list[FHIRConfigResponse])
async def list_configs(db: AsyncSession = Depends(get_db)):
    """List all FHIR server configurations."""
    result = await db.execute(
        select(FHIRSyncConfig).order_by(FHIRSyncConfig.created_at.desc())
    )
    return result.scalars().all()


# -- Test connection ---------------------------------------------------------


@router.post("/test", response_model=FHIRTestConnectionResponse)
async def test_connection(body: FHIRConfigCreate):
    """Test connectivity to a FHIR server without saving."""
    try:
        async with FHIRClient(
            base_url=body.base_url,
            client_id=body.client_id,
            client_secret=body.client_secret,
            token_url=body.token_url,
            scopes=body.scopes,
            access_token=body.access_token,
        ) as client:
            info = await client.test_connection()
        return FHIRTestConnectionResponse(success=True, server_info=info)
    except FHIRClientError as exc:
        return FHIRTestConnectionResponse(success=False, error=str(exc))


# -- Sync --------------------------------------------------------------------


@router.post("/sync", response_model=FHIRSyncStatusResponse, status_code=202)
async def trigger_sync(
    body: FHIRSyncRequest,
    db: AsyncSession = Depends(get_db),
):
    """Trigger a full or incremental FHIR data sync."""
    config = await db.get(FHIRSyncConfig, body.config_id)
    if config is None:
        raise HTTPException(status_code=404, detail="FHIR config not found")

    sync_log = FHIRSyncLog(
        config_id=config.id,
        status=FHIRSyncStatus.running,
        sync_type=body.sync_type,
    )
    db.add(sync_log)
    await db.flush()
    await db.refresh(sync_log)

    try:
        stats = await _run_sync(config, sync_log, db)
        sync_log.status = FHIRSyncStatus.completed
        sync_log.completed_at = datetime.now(timezone.utc)
        sync_log.records_fetched = stats["fetched"]
        sync_log.records_created = stats["created"]
        sync_log.records_updated = stats["updated"]
        sync_log.records_failed = stats["failed"]
    except Exception as exc:
        logger.exception("FHIR sync failed for config %s", config.id)
        sync_log.status = FHIRSyncStatus.failed
        sync_log.error_message = str(exc)[:2000]
        sync_log.completed_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(sync_log)
    return _log_to_response(sync_log)


@router.get("/sync/status", response_model=list[FHIRSyncStatusResponse])
async def sync_status(
    config_id: uuid.UUID | None = None,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """Get the latest sync log entries, optionally filtered by config."""
    q = select(FHIRSyncLog).order_by(FHIRSyncLog.started_at.desc()).limit(limit)
    if config_id:
        q = q.where(FHIRSyncLog.config_id == config_id)
    result = await db.execute(q)
    return [_log_to_response(row) for row in result.scalars().all()]


# -- Sync orchestration (inline for MVP) ------------------------------------


async def _run_sync(
    config: FHIRSyncConfig, log: FHIRSyncLog, db: AsyncSession
) -> dict[str, int]:
    """Execute a sync run: fetch from FHIR server -> map -> upsert into VaxAI DB."""
    stats = {"fetched": 0, "created": 0, "updated": 0, "failed": 0}

    mapping = (
        FHIRMappingConfig(config.mapping_config)
        if config.mapping_config
        else FHIRMappingConfig.default()
    )
    mapper = FHIRMapper(mapping)

    async with FHIRClient(
        base_url=config.base_url,
        client_id=config.client_id,
        client_secret=config.client_secret_encrypted,  # TODO: decrypt in production
        token_url=config.token_url,
        scopes=config.scopes,
        access_token=config.access_token_encrypted,
    ) as client:
        # 1. Sync Location -> facilities
        locations = await client.fetch_locations()
        stats["fetched"] += len(locations)
        facilities = mapper.map_locations(locations)
        for fac in facilities:
            if fac["lat"] is not None and fac["lng"] is not None:
                try:
                    await _upsert_coverage_facility(db, fac, mapping.country_code)
                    stats["created"] += 1
                except Exception:
                    logger.warning(
                        "Failed to upsert facility %s", fac["fhir_id"], exc_info=True
                    )
                    stats["failed"] += 1

        # 2. Sync Immunization -> coverage
        immunizations = await client.fetch_immunizations()
        stats["fetched"] += len(immunizations)
        imm_mapped = mapper.map_immunizations(immunizations)
        stats["created"] += len(imm_mapped["coverage"])

        # 3. Sync SupplyDelivery -> inventory
        deliveries = await client.fetch_supply_deliveries()
        stats["fetched"] += len(deliveries)
        delivery_records = mapper.map_supply_deliveries(deliveries)
        for inv in delivery_records:
            try:
                await _insert_supply_transaction(db, inv)
                stats["created"] += 1
            except Exception:
                stats["failed"] += 1

        # 4. Sync Device -> cold chain equipment
        devices = await client.fetch_devices()
        stats["fetched"] += len(devices)
        device_records = mapper.map_devices(devices)
        for dev in device_records:
            try:
                await _upsert_cold_chain_facility(db, dev, mapping.country_code)
                stats["created"] += 1
            except Exception:
                logger.warning(
                    "Failed to upsert device %s", dev["fhir_id"], exc_info=True
                )
                stats["failed"] += 1

    return stats


async def _upsert_coverage_facility(
    db: AsyncSession, fac: dict, country_code: str
) -> None:
    facility_id = fac["fhir_id"][:32]
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
                region=fac.get("part_of_name") or "Unknown",
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
            facility_id=inv.get("facility_ref"),
            transaction_date=None,
            extra={
                "source": "fhir",
                "fhir_id": inv.get("fhir_id"),
                "item_code": inv.get("item_code"),
            },
        )
    )


async def _upsert_cold_chain_facility(
    db: AsyncSession, dev: dict, country_code: str
) -> None:
    device_id = dev["fhir_id"][:32]
    existing = await db.get(ColdChainFacility, device_id)
    if existing:
        existing.name = dev["device_name"] or dev["device_type"] or existing.name
    else:
        db.add(
            ColdChainFacility(
                id=device_id,
                name=dev["device_name"] or dev["device_type"] or "Unknown Device",
                country=country_code,
            )
        )


def _log_to_response(log: FHIRSyncLog) -> FHIRSyncStatusResponse:
    return FHIRSyncStatusResponse(
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
