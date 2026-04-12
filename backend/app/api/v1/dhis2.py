"""DHIS2 integration API endpoints.

POST /api/v1/integrations/dhis2/sync      â trigger a full or incremental sync
GET  /api/v1/integrations/dhis2/sync/status â latest sync status for a config
POST /api/v1/integrations/dhis2/configs    â create a DHIS2 connection config
GET  /api/v1/integrations/dhis2/configs    â list all configs
POST /api/v1/integrations/dhis2/test       â test a DHIS2 connection
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.integrations.dhis2.client import DHIS2Client, DHIS2ClientError
from app.integrations.dhis2.mapper import DHIS2Mapper, MappingConfig
from app.models.coverage import CoverageFacility
from app.models.dhis2_sync import DHIS2SyncConfig, DHIS2SyncLog, SyncStatus
from app.models.supply import SupplyTransaction
from app.schemas.dhis2 import (
    DHIS2ConfigCreate,
    DHIS2ConfigResponse,
    DHIS2SyncRequest,
    DHIS2SyncStatusResponse,
    DHIS2TestConnectionResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations/dhis2", tags=["dhis2"])


# -- Configs -----------------------------------------------------------------


@router.post("/configs", response_model=DHIS2ConfigResponse, status_code=201)
async def create_config(
    body: DHIS2ConfigCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new DHIS2 instance configuration."""
    config = DHIS2SyncConfig(
        name=body.name,
        base_url=body.base_url,
        auth_username=body.auth_username,
        auth_password_encrypted=body.auth_password,  # TODO: encrypt in production
        auth_pat_encrypted=body.auth_pat,  # TODO: encrypt in production
        country_code=body.country_code,
        mapping_config=body.mapping_config,
    )
    db.add(config)
    await db.flush()
    await db.refresh(config)
    return config


@router.get("/configs", response_model=list[DHIS2ConfigResponse])
async def list_configs(db: AsyncSession = Depends(get_db)):
    """List all DHIS2 connection configurations."""
    result = await db.execute(
        select(DHIS2SyncConfig).order_by(DHIS2SyncConfig.created_at.desc())
    )
    return result.scalars().all()


# -- Test connection ---------------------------------------------------------


@router.post("/test", response_model=DHIS2TestConnectionResponse)
async def test_connection(body: DHIS2ConfigCreate):
    """Test connectivity to a DHIS2 instance without saving."""
    try:
        async with DHIS2Client(
            base_url=body.base_url,
            username=body.auth_username,
            password=body.auth_password,
            personal_access_token=body.auth_pat,
        ) as client:
            info = await client.test_connection()
        return DHIS2TestConnectionResponse(success=True, server_info=info)
    except DHIS2ClientError as exc:
        return DHIS2TestConnectionResponse(success=False, error=str(exc))


# -- Sync --------------------------------------------------------------------


@router.post("/sync", response_model=DHIS2SyncStatusResponse, status_code=202)
async def trigger_sync(
    body: DHIS2SyncRequest,
    db: AsyncSession = Depends(get_db),
):
    """Trigger a full or incremental DHIS2 data sync."""
    config = await db.get(DHIS2SyncConfig, body.config_id)
    if config is None:
        raise HTTPException(status_code=404, detail="DHIS2 config not found")

    # Create sync log entry
    sync_log = DHIS2SyncLog(
        config_id=config.id,
        status=SyncStatus.running,
        sync_type=body.sync_type,
    )
    db.add(sync_log)
    await db.flush()
    await db.refresh(sync_log)

    # Run sync inline (for MVP; move to Celery worker for production)
    try:
        stats = await _run_sync(config, sync_log, db)
        sync_log.status = SyncStatus.completed
        sync_log.completed_at = datetime.now(timezone.utc)
        sync_log.records_fetched = stats["fetched"]
        sync_log.records_created = stats["created"]
        sync_log.records_updated = stats["updated"]
        sync_log.records_failed = stats["failed"]
    except Exception as exc:
        logger.exception("DHIS2 sync failed for config %s", config.id)
        sync_log.status = SyncStatus.failed
        sync_log.error_message = str(exc)[:2000]
        sync_log.completed_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(sync_log)
    return _log_to_response(sync_log)


@router.get("/sync/status", response_model=list[DHIS2SyncStatusResponse])
async def sync_status(
    config_id: uuid.UUID | None = None,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """Get the latest sync log entries, optionally filtered by config."""
    q = select(DHIS2SyncLog).order_by(DHIS2SyncLog.started_at.desc()).limit(limit)
    if config_id:
        q = q.where(DHIS2SyncLog.config_id == config_id)
    result = await db.execute(q)
    return [_log_to_response(row) for row in result.scalars().all()]


# -- Sync orchestration (inline for MVP) ------------------------------------


async def _run_sync(
    config: DHIS2SyncConfig, log: DHIS2SyncLog, db: AsyncSession
) -> dict[str, int]:
    """Execute a sync run: fetch from DHIS2 â map â upsert into VaxAI DB."""
    stats = {"fetched": 0, "created": 0, "updated": 0, "failed": 0}

    mapping = (
        MappingConfig(config.mapping_config)
        if config.mapping_config
        else MappingConfig.default()
    )
    mapper = DHIS2Mapper(mapping)

    async with DHIS2Client(
        base_url=config.base_url,
        username=config.auth_username,
        password=config.auth_password_encrypted,  # TODO: decrypt in production
        personal_access_token=config.auth_pat_encrypted,
    ) as client:
        # 1. Sync organisation units â facilities
        org_units = await client.fetch_organisation_units(
            level=mapping.org_unit_level_facility
        )
        stats["fetched"] += len(org_units)
        facilities = mapper.map_organisation_units(org_units)
        for fac in facilities:
            if fac["lat"] is not None and fac["lng"] is not None:
                try:
                    await _upsert_coverage_facility(db, fac, mapping.country_code)
                    stats["created"] += 1
                except Exception:
                    logger.warning(
                        "Failed to upsert facility %s", fac["dhis2_id"], exc_info=True
                    )
                    stats["failed"] += 1

        # 2. Sync data value sets (if data set configured)
        if mapping.immunization_data_set or mapping.stock_data_set:
            data_set = mapping.immunization_data_set or mapping.stock_data_set
            try:
                data_values = await client.fetch_data_value_sets(data_set=data_set)
                stats["fetched"] += len(data_values)
                mapped = mapper.map_data_values(data_values)

                for inv in mapped["inventory"]:
                    try:
                        await _insert_supply_transaction(db, inv)
                        stats["created"] += 1
                    except Exception:
                        stats["failed"] += 1

            except DHIS2ClientError:
                logger.warning("Could not fetch data value sets", exc_info=True)

    return stats


async def _upsert_coverage_facility(
    db: AsyncSession, fac: dict, country_code: str
) -> None:
    """Insert or update a coverage facility from DHIS2 org unit data."""
    facility_id = fac["dhis2_id"][:32]
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
                region=fac.get("parent_name") or "Unknown",
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
    """Insert a supply transaction from DHIS2 data values."""
    db.add(
        SupplyTransaction(
            supply_item_id=uuid.uuid4(),  # TODO: resolve from vaccine_type lookup
            transaction_type=inv["transaction_type"],
            quantity=inv["quantity"],
            facility_id=inv.get("org_unit_id"),
            transaction_date=None,
            extra={"source": "dhis2", "period": inv.get("period")},
        )
    )


def _log_to_response(log: DHIS2SyncLog) -> DHIS2SyncStatusResponse:
    return DHIS2SyncStatusResponse(
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
