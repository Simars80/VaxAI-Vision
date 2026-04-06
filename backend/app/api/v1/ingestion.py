"""Data ingestion API endpoints — CSV/Excel upload and FHIR R4 connector."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.ingestion import (
    IngestionAuditLog,
    IngestionJob,
    IngestionSource,
    IngestionStatus,
)
from app.models.user import User, UserRole
from app.schemas.ingestion import (
    AuditLogEntry,
    CSVColumnMapping,
    FHIRConnectorRequest,
    IngestionJobResponse,
)
from app.workers.ingestion_tasks import ingest_csv, ingest_fhir

router = APIRouter(prefix="/ingestion", tags=["ingestion"])

# ── Helpers ────────────────────────────────────────────────────────────────────

_ALLOWED_ROLES = {UserRole.admin, UserRole.analyst}
_MAX_CSV_BYTES = 50 * 1024 * 1024  # 50 MB


def _require_upload_role(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role not in _ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and analysts can trigger ingestion jobs.",
        )
    return current_user


# ── CSV Upload ─────────────────────────────────────────────────────────────────


@router.post(
    "/upload/csv",
    response_model=IngestionJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload a CSV/Excel file for supply chain data ingestion",
)
async def upload_csv(
    file: UploadFile,
    item_code_col: str = Query(default="item_code"),
    item_name_col: str = Query(default="item_name"),
    category_col: str = Query(default="category"),
    unit_col: str = Query(default="unit_of_measure"),
    tx_type_col: str = Query(default="transaction_type"),
    quantity_col: str = Query(default="quantity"),
    facility_id_col: str = Query(default="facility_id"),
    facility_name_col: str = Query(default="facility_name"),
    tx_date_col: str = Query(default="transaction_date"),
    lot_col: str = Query(default="lot_number"),
    expiry_col: str = Query(default="expiry_date"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_upload_role),
) -> IngestionJobResponse:
    """Accept a CSV or Excel multipart upload and queue an async ingestion job.

    Returns immediately with the created job record; poll `/ingestion/jobs/{job_id}`
    for status updates.
    """
    # Validate content type
    allowed_types = {
        "text/csv",
        "application/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
    if (
        file.content_type
        and file.content_type.split(";")[0].strip() not in allowed_types
    ):
        if not (file.filename or "").lower().endswith((".csv", ".xlsx", ".xls")):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported file type: {file.content_type}. Upload CSV or Excel.",
            )

    raw_bytes = await file.read()
    if len(raw_bytes) > _MAX_CSV_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 50 MB limit.",
        )

    # Decode — try UTF-8, fall back to latin-1
    try:
        csv_content = raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        csv_content = raw_bytes.decode("latin-1")

    column_mapping = CSVColumnMapping(
        item_code=item_code_col,
        item_name=item_name_col,
        category=category_col,
        unit_of_measure=unit_col,
        transaction_type=tx_type_col,
        quantity=quantity_col,
        facility_id=facility_id_col,
        facility_name=facility_name_col,
        transaction_date=tx_date_col,
        lot_number=lot_col,
        expiry_date=expiry_col,
    )

    job = IngestionJob(
        source=IngestionSource.csv,
        status=IngestionStatus.pending,
        file_name=file.filename,
        triggered_by_user_id=current_user.id,
    )
    db.add(job)
    await db.flush()

    # Dispatch Celery task
    celery_result = ingest_csv.delay(
        str(job.id),
        csv_content,
        column_mapping.model_dump(),
    )
    job.celery_task_id = celery_result.id
    await db.flush()

    return IngestionJobResponse.model_validate(job)


# ── FHIR Connector ─────────────────────────────────────────────────────────────


@router.post(
    "/fhir/pull",
    response_model=IngestionJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger a FHIR R4 pull job (read-only EHR ingestion)",
)
async def trigger_fhir_pull(
    request: FHIRConnectorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_upload_role),
) -> IngestionJobResponse:
    """Queue an async job to pull Patient census and SupplyDelivery resources
    from a FHIR R4 server.  No data is written back to the EHR.
    """
    job = IngestionJob(
        source=IngestionSource.fhir_r4,
        status=IngestionStatus.pending,
        fhir_base_url=str(request.fhir_base_url),
        triggered_by_user_id=current_user.id,
    )
    db.add(job)
    await db.flush()

    # Strip bearer token from the serialised payload before queueing
    payload = request.model_dump(mode="json")
    payload.pop("bearer_token", None)  # Don't persist token in task payload

    celery_result = ingest_fhir.delay(
        str(job.id),
        {**payload, "bearer_token": request.bearer_token},
    )
    job.celery_task_id = celery_result.id
    await db.flush()

    return IngestionJobResponse.model_validate(job)


# ── Job Status ─────────────────────────────────────────────────────────────────


@router.get(
    "/jobs",
    response_model=list[IngestionJobResponse],
    summary="List ingestion jobs (most recent first)",
)
async def list_jobs(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
) -> list[IngestionJobResponse]:
    result = await db.execute(
        select(IngestionJob)
        .order_by(IngestionJob.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return [IngestionJobResponse.model_validate(j) for j in result.scalars().all()]


@router.get(
    "/jobs/{job_id}",
    response_model=IngestionJobResponse,
    summary="Get ingestion job status",
)
async def get_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
) -> IngestionJobResponse:
    job = await db.get(IngestionJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Ingestion job not found.")
    return IngestionJobResponse.model_validate(job)


@router.get(
    "/jobs/{job_id}/audit",
    response_model=list[AuditLogEntry],
    summary="Get row-level audit log for an ingestion job",
)
async def get_audit_log(
    job_id: uuid.UUID,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
) -> list[AuditLogEntry]:
    result = await db.execute(
        select(IngestionAuditLog)
        .where(IngestionAuditLog.job_id == job_id)
        .order_by(IngestionAuditLog.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    return [AuditLogEntry.model_validate(e) for e in result.scalars().all()]
