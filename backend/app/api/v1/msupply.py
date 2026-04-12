"""mSupply integration API endpoints.

POST /api/v1/integrations/msupply/sync       â trigger a full or incremental sync
GET  /api/v1/integrations/msupply/sync/status â latest sync status for a config
POST /api/v1/integrations/msupply/configs     â create an mSupply connection config
GET  /api/v1/integrations/msupply/configs     â list all configs
POST /api/v1/integrations/msupply/test        â test an mSupply connection
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.integrations.msupply.client import MSupplyClient, MSupplyClientError
from app.integrations.msupply.mapper import MSupplyMapper, MSupplyMappingConfig
from app.models.coverage import CoverageFacility
from app.models.msupply_sync import MSupplySyncConfig, MSupplySyncLog, MSupplySyncStatus
from app.models.supply import SupplyTransaction
from app.schemas.msupply import (
    MSupplyConfigCreate,
    MSupplyConfigResponse,
    MSupplySyncRequest,
    MSupplySyncStatusResponse,
    MSupplyTestConnectionResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations/msupply", tags=["msupply"])


# -- Configs -----------------------------------------------------------------


@router.post("/configs", response_model=MSupplyConfigResponse, status_code=201)
async def create_config(
    body: MSupplyConfigCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new mSupply instance configuration."""
    config = MSupplySyncConfig(
        name=body.name,
        base_url=body.base_url,
        auth_username=body.auth_username,
        auth_password_encrypted=body.auth_password,
        auth_token_encrypted=body.auth_token,
        country_code=body.country_code,
        mapping_config=body.mapping_config,
    )
    db.add(config)
    await db.flush()
    await db.refresh(config)
    return config


@router.get("/configs", response_model=list[MSupplyConfigResponse])
async def list_configs(db: AsyncSession = Depends(get_db)):
    """List all mSupply connection configurations."""
    result = await db.execute(
        select(MSupplySyncConfig).order_by(MSupplySyncConfig.created_at.desc())
    )
    return result.scalars().all()


# -- Test connection ---------------------------------------------------------


@router.post("/test", response_model=MSupplyTestConnectionResponse)
async def test_connection(body: MSupplyConfigCreate):
    """Test connectivity to an mSupply instance without saving."""
    try:
        async with MSupplyClient(
            base_url=body.base_url,
            username=body.auth_username,
            password=body.auth_password,
            api_token=body.auth_token,
        ) as client:
            info = await client.test_connection()
        return MSupplyTestConnectionResponse(success=True, server_info=info)
    except MSupplyClientError as exc:
        return MSupplyTestConnectionResponse(success=False, error=str(exc))


# -- Sync --------------------------------------------------------------------


@router.post("/sync", response_model=MSupplySyncStatusResponse, status_code=202)
async def trigger_sync(
    body: MSupplySyncRequest,
    db: AsyncSession = Depends(get_db),
):
    """Trigger a full or incremental mSupply data sync."""
    config = await db.get(MSupplySyncConfig, body.config_id)
    if config is None:
        raise HTTPException(status_code=404, detail="mSupply config not found")

    sync_log = MSupplySyncLog(
        config_id=config.id,
        status=MSupplySyncStatus.running,
        sync_type=body.sync_type,
    )
    db.add(sync_log)
    await db.flush()
    await db.refresh(sync_log)

    try:
        stats = await _run_sync(config, sync_log, db)
        sync_log.status = MSupplySyncStatus.completed
        sync_log.completed_at = datetime.now(timezone.utc)
        sync_log.records_fetched = stats["fetched"]
        sync_log.records_created = stats["created"]
        sync_log.records_updated = stats["updated"]
        sync_log.records_failed = stats["failed"]
    except Exception as exc:
        logger.exception("mSupply sync failed for config %s", config.id)
        sync_log.status = MSupplySyncStatus.failed
        sync_log.error_message = str(exc)[:2000]
        sync_log.completed_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(sync_log)
    return _log_to_response(sync_log)


@router.get("/sync/status", response_model=list[MSupplySyncStatusResponse])
async def sync_status(
    config_id: uuid.UUID | None = None,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """Get the latest sync log entries, optionally filtered by config."""
    q = select(MSupplySyncLog).order_by(MSupplySyncLog.started_at.desc()).limit(limit)
    if config_id:
        q = q.where(MSupplySyncLog.config_id == config_id)
    result = await db.execute(q)
    return [_log_to_response(row) for row in result.scalars().all()]


# -- Sync orchestration (inline for MVP) ------------------------------------


async def _run_sync(
    config: MSupplySyncConfig, log: MSupplySyncLog, db: AsyncSession
) -> dict[str, int]:
    """Execute a sync run: fetch from mSupply â map â upsert into VaxAI DB."""
    stats = {"fetched": 0, "created": 0, "updated": 0, "failed": 0}

    mapping = (
        MSupplyMappingConfig(config.mapping_config)
        if config.mapping_config
        else MSupplyMappingConfig.default()
    )
    mapper = MSupplyMapper(mapping)

    async with MSupplyClient(
        base_url=config.base_url,
        username=config.auth_username,
        password=config.auth_password_encrypted,
        api_token=config.auth_token_encrypted,
    ) as client:
        # 1. Sync stores â facilities
        stores = await client.fetch_stores()
        stats["fetched"] += len(stores)
        facilities = mapper.map_stores(stores)
        for fac in facilities:
            if fac["lat"] is not None and fac["lng"] is not None:
                try:
                    await _upsert_coverage_facility(db, fac, mapping.country_code)
                    stats["created"] += 1
                except Exception:
                    logger.warning(
                        "Failed to upsert facility %s", fac["msupply_id"], exc_info=True
                    )
                    stats["failed"] += 1

        # 2. Sync stock lines â inventory
        stock_lines = await client.fetch_stock_lines()
        stats["fetched"] += len(stock_lines)
        mapped = mapper.map_stock_lines(stock_lines)

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
    facility_id = fac["msupply_id"][:32]
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
                region="Unknown",
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
            facility_id=inv.get("store_id"),
            transaction_date=None,
            extra={
                "source": "msupply",
                "batch": inv.get("batch"),
                "expiry_date": inv.get("expiry_date"),
            },
        )
    )


def _log_to_response(log: MSupplySyncLog) -> MSupplySyncStatusResponse:
    return MSupplySyncStatusResponse(
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
