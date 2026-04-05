"""Celery tasks for the data ingestion pipeline."""
from __future__ import annotations

import csv
import io
import logging
import uuid
from datetime import datetime, timezone

from celery import shared_task
from sqlalchemy import select

from app.connectors.fhir_r4 import FHIRConnectorError, FHIRr4Connector
from app.database import AsyncSessionLocal
from app.models.ingestion import IngestionAuditLog, IngestionJob, IngestionStatus
from app.models.supply import PatientCensus, SupplyItem, SupplyTransaction
from app.schemas.ingestion import CSVColumnMapping, FHIRConnectorRequest

logger = logging.getLogger(__name__)

# ── Helpers ───────────────────────────────────────────────────────────────────


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(value.strip(), fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _safe_float(value: str | None) -> float | None:
    try:
        return float(value) if value else None
    except (ValueError, TypeError):
        return None


def _run_sync(coro):
    """Run an async coroutine from a sync Celery task."""
    import asyncio

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


# ── CSV Ingestion Task ─────────────────────────────────────────────────────────


@shared_task(
    bind=True,
    name="app.workers.ingestion_tasks.ingest_csv",
    max_retries=3,
    default_retry_delay=30,
)
def ingest_csv(
    self,
    job_id: str,
    csv_content: str,
    column_mapping: dict,
) -> dict:
    """Parse a CSV payload and persist normalized SupplyTransaction rows."""
    return _run_sync(_async_ingest_csv(job_id, csv_content, column_mapping))


async def _async_ingest_csv(job_id: str, csv_content: str, column_mapping: dict) -> dict:
    mapping = CSVColumnMapping(**column_mapping)
    job_uuid = uuid.UUID(job_id)

    rows_total = rows_ok = rows_err = 0
    audit_entries: list[IngestionAuditLog] = []

    async with AsyncSessionLocal() as session:
        # Mark job as processing
        job = await session.get(IngestionJob, job_uuid)
        if not job:
            return {"error": "Job not found"}
        job.status = IngestionStatus.processing

        reader = csv.DictReader(io.StringIO(csv_content))
        for idx, raw_row in enumerate(reader):
            rows_total += 1
            try:
                item_code = raw_row.get(mapping.item_code, "").strip()
                item_name = raw_row.get(mapping.item_name, "").strip()
                if not item_name:
                    raise ValueError("item_name is required")

                # Upsert SupplyItem
                existing = await session.execute(
                    select(SupplyItem).where(SupplyItem.external_code == item_code)
                )
                supply_item = existing.scalars().first()
                if supply_item is None:
                    supply_item = SupplyItem(
                        external_code=item_code or None,
                        name=item_name,
                        unit_of_measure=raw_row.get(mapping.unit_of_measure, "").strip() or None,
                        source_job_id=job_uuid,
                    )
                    session.add(supply_item)
                    await session.flush()
                    item_action = "inserted"
                else:
                    item_action = "updated"

                # Create transaction
                qty_str = raw_row.get(mapping.quantity, "").strip()
                qty = _safe_float(qty_str)
                if qty is None:
                    raise ValueError(f"Invalid quantity: {qty_str!r}")

                txn = SupplyTransaction(
                    supply_item_id=supply_item.id,
                    transaction_type=raw_row.get(mapping.transaction_type, "").strip() or "receipt",
                    quantity=qty,
                    unit_of_measure=raw_row.get(mapping.unit_of_measure, "").strip() or None,
                    facility_id=raw_row.get(mapping.facility_id, "").strip() or None,
                    facility_name=raw_row.get(mapping.facility_name, "").strip() or None,
                    transaction_date=_parse_date(raw_row.get(mapping.transaction_date)),
                    lot_number=raw_row.get(mapping.lot_number, "").strip() or None,
                    expiry_date=_parse_date(raw_row.get(mapping.expiry_date)),
                    source_job_id=job_uuid,
                )
                session.add(txn)
                rows_ok += 1
                audit_entries.append(
                    IngestionAuditLog(
                        job_id=job_uuid,
                        row_index=idx,
                        action=item_action,
                        entity_type="supply_transaction",
                        entity_id=str(supply_item.id),
                        detail={"item_name": item_name, "quantity": qty},
                    )
                )
            except Exception as exc:
                rows_err += 1
                logger.warning("CSV row %d failed: %s", idx, exc)
                audit_entries.append(
                    IngestionAuditLog(
                        job_id=job_uuid,
                        row_index=idx,
                        action="error",
                        detail={"error": str(exc), "raw": dict(raw_row)},
                    )
                )

        # Persist audit logs
        session.add_all(audit_entries)

        # Finalise job
        job.rows_total = rows_total
        job.rows_succeeded = rows_ok
        job.rows_failed = rows_err
        job.status = IngestionStatus.completed if rows_err == 0 else IngestionStatus.partial
        job.completed_at = datetime.now(timezone.utc)
        await session.commit()

    logger.info("CSV ingestion job %s done: %d/%d rows ok", job_id, rows_ok, rows_total)
    return {"job_id": job_id, "rows_total": rows_total, "rows_ok": rows_ok, "rows_err": rows_err}


# ── FHIR R4 Ingestion Task ────────────────────────────────────────────────────


@shared_task(
    bind=True,
    name="app.workers.ingestion_tasks.ingest_fhir",
    max_retries=3,
    default_retry_delay=60,
)
def ingest_fhir(self, job_id: str, request_data: dict) -> dict:
    """Pull patient census and supply data from a FHIR R4 server."""
    return _run_sync(_async_ingest_fhir(job_id, request_data))


async def _async_ingest_fhir(job_id: str, request_data: dict) -> dict:
    req = FHIRConnectorRequest(**request_data)
    job_uuid = uuid.UUID(job_id)

    rows_ok = rows_err = 0
    audit_entries: list[IngestionAuditLog] = []

    async with AsyncSessionLocal() as session:
        job = await session.get(IngestionJob, job_uuid)
        if not job:
            return {"error": "Job not found"}
        job.status = IngestionStatus.processing

        connector = FHIRr4Connector(
            base_url=req.fhir_base_url,
            bearer_token=req.bearer_token,
        )

        try:
            if req.fetch_patients:
                patients = await connector.fetch_patients(
                    updated_after=req.updated_after,
                    max_resources=req.max_resources,
                )
                for patient in patients:
                    try:
                        census = PatientCensus(
                            fhir_patient_id=patient["id"],
                            facility_id=patient.get("facility_id"),
                            age_years=patient.get("age_years"),
                            gender=patient.get("gender"),
                            country_code=patient.get("country_code"),
                            census_date=patient.get("census_date"),
                            source_job_id=job_uuid,
                            extra=patient.get("extra"),
                        )
                        session.add(census)
                        rows_ok += 1
                        audit_entries.append(
                            IngestionAuditLog(
                                job_id=job_uuid,
                                action="inserted",
                                entity_type="patient_census",
                                entity_id=patient["id"],
                            )
                        )
                    except Exception as exc:
                        rows_err += 1
                        audit_entries.append(
                            IngestionAuditLog(
                                job_id=job_uuid,
                                action="error",
                                entity_type="patient_census",
                                detail={"error": str(exc), "fhir_id": patient.get("id")},
                            )
                        )

            if req.fetch_supply_deliveries:
                deliveries = await connector.fetch_supply_deliveries(
                    updated_after=req.updated_after,
                    max_resources=req.max_resources,
                )
                for delivery in deliveries:
                    try:
                        # Upsert SupplyItem from FHIR code
                        item_code = delivery.get("item_code", "")
                        existing = await session.execute(
                            select(SupplyItem).where(SupplyItem.external_code == item_code)
                        )
                        supply_item = existing.scalars().first()
                        if supply_item is None:
                            supply_item = SupplyItem(
                                external_code=item_code or None,
                                name=delivery.get("item_name", item_code or "Unknown"),
                                source_job_id=job_uuid,
                            )
                            session.add(supply_item)
                            await session.flush()

                        txn = SupplyTransaction(
                            supply_item_id=supply_item.id,
                            transaction_type="receipt",
                            quantity=delivery.get("quantity", 0),
                            facility_id=delivery.get("facility_id"),
                            facility_name=delivery.get("facility_name"),
                            transaction_date=delivery.get("transaction_date"),
                            lot_number=delivery.get("lot_number"),
                            source_job_id=job_uuid,
                            fhir_resource_id=delivery.get("fhir_id"),
                        )
                        session.add(txn)
                        rows_ok += 1
                        audit_entries.append(
                            IngestionAuditLog(
                                job_id=job_uuid,
                                action="inserted",
                                entity_type="supply_transaction",
                                entity_id=delivery.get("fhir_id"),
                            )
                        )
                    except Exception as exc:
                        rows_err += 1
                        audit_entries.append(
                            IngestionAuditLog(
                                job_id=job_uuid,
                                action="error",
                                entity_type="supply_delivery",
                                detail={"error": str(exc), "fhir_id": delivery.get("fhir_id")},
                            )
                        )

        except FHIRConnectorError as exc:
            job.status = IngestionStatus.failed
            job.error_summary = str(exc)
            job.completed_at = datetime.now(timezone.utc)
            await session.commit()
            return {"job_id": job_id, "error": str(exc)}

        session.add_all(audit_entries)
        job.rows_total = rows_ok + rows_err
        job.rows_succeeded = rows_ok
        job.rows_failed = rows_err
        job.status = IngestionStatus.completed if rows_err == 0 else IngestionStatus.partial
        job.completed_at = datetime.now(timezone.utc)
        await session.commit()

    logger.info("FHIR ingestion job %s done: %d resources ok", job_id, rows_ok)
    return {
        "job_id": job_id,
        "rows_total": rows_ok + rows_err,
        "rows_ok": rows_ok,
        "rows_err": rows_err,
    }
