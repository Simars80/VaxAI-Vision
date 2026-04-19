"""Pilot data validation API endpoints.

Routes
------
POST   /api/v1/validation/validate               Validate a CSV/Excel batch upload
GET    /api/v1/validation/quality/{facility_id}  Per-facility data quality score
GET    /api/v1/validation/quality/summary        Aggregate quality across all facilities
POST   /api/v1/validation/rules                  Register a custom validation rule (admin)
"""

from __future__ import annotations

import io
import json
import logging
from datetime import date, datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User, UserRole
from app.validation.pipeline import ValidationPipeline, ValidationReport
from app.validation.quality import DataQualityScore, QualityScorer, QualityTrendTracker

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/validation", tags=["validation"])

# ── Constants ──────────────────────────────────────────────────────────────────

_MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
_ALLOWED_RECORD_TYPES = {"inventory", "cold_chain", "coverage"}

# Module-level trend tracker (in-memory; can be replaced with Redis / DB later)
_trend_tracker = QualityTrendTracker()


# ── Auth helpers ───────────────────────────────────────────────────────────────


def _require_analyst(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role not in {UserRole.admin, UserRole.analyst}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and analysts can access validation endpoints.",
        )
    return current_user


def _require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manage custom validation rules.",
        )
    return current_user


# ── Pydantic response schemas ─────────────────────────────────────────────────


class ValidationIssueOut(BaseModel):
    row: int | None
    field: str | None
    message: str
    severity: str


class ValidationReportOut(BaseModel):
    record_type: str
    total_records: int
    valid_count: int
    warning_count: int
    error_count: int
    errors: list[ValidationIssueOut]
    summary: dict


class QualityDimensionsOut(BaseModel):
    completeness: float
    accuracy: float
    timeliness: float
    consistency: float
    overall: float
    grade: str


class FacilityQualityOut(BaseModel):
    facility_id: str
    period: str
    computed_at: datetime
    record_type: str
    total_records: int
    valid_records: int
    warning_records: int
    error_records: int
    dimensions: QualityDimensionsOut
    issues_by_field: dict[str, int]


class QualitySummaryOut(BaseModel):
    period: str
    facility_count: int
    average_overall_score: float
    facility_scores: list[FacilityQualityOut]


class CustomRuleIn(BaseModel):
    rule_name: str = Field(min_length=1, max_length=64)
    record_type: Literal["inventory", "cold_chain", "coverage"]
    description: str = Field(min_length=1, max_length=512)
    # JSON-encoded rule spec — interpreted at rule evaluation time
    rule_spec: dict[str, Any] = Field(
        description="Machine-readable rule definition (field, operator, value, severity)"
    )


class CustomRuleOut(BaseModel):
    rule_name: str
    record_type: str
    description: str
    rule_spec: dict[str, Any]
    created_by: str
    created_at: datetime


# ── POST /validation/validate ─────────────────────────────────────────────────


@router.post(
    "/validate",
    response_model=ValidationReportOut,
    summary="Validate a CSV or Excel batch upload",
)
async def validate_upload(
    file: UploadFile = File(...),
    record_type: str = Query(
        default="inventory",
        description="Type of records in the file: inventory | cold_chain | coverage",
    ),
    facility_id: str | None = Query(
        default=None,
        description="Facility ID to associate with quality scoring (optional)",
    ),
    period: str | None = Query(
        default=None,
        description="Reporting period for quality scoring, e.g. '2026-04' (optional)",
    ),
    sheet_name: str | None = Query(
        default=None,
        description="Excel sheet name (leave blank for first sheet)",
    ),
    _: User = Depends(_require_analyst),
) -> ValidationReportOut:
    """Accept a CSV or Excel multipart upload, run the validation pipeline,
    and return a detailed report.

    If ``facility_id`` and ``period`` are provided, a DataQualityScore is also
    computed and stored in the in-memory trend tracker for later retrieval.
    """
    if record_type not in _ALLOWED_RECORD_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"record_type must be one of: {sorted(_ALLOWED_RECORD_TYPES)}",
        )

    raw_bytes = await file.read()
    if len(raw_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 50 MB limit.",
        )

    pipeline = ValidationPipeline(record_type=record_type)

    filename = (file.filename or "").lower()
    try:
        if filename.endswith((".xlsx", ".xls")):
            report = pipeline.validate_excel(raw_bytes, sheet_name=sheet_name)
        else:
            # Decode — try UTF-8, fall back to latin-1
            try:
                csv_text = raw_bytes.decode("utf-8")
            except UnicodeDecodeError:
                csv_text = raw_bytes.decode("latin-1")
            report = pipeline.validate_csv(csv_text)
    except Exception as exc:
        logger.exception("Validation pipeline error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to parse file: {exc}",
        )

    # Optionally compute and store quality score
    if facility_id and period:
        try:
            scorer = QualityScorer()
            score = scorer.score_report(
                report=report,
                facility_id=facility_id,
                period=period,
                raw_records=report.valid_records,
            )
            _trend_tracker.add(score)
        except Exception as exc:
            logger.warning("Quality scoring failed: %s", exc)

    return _report_to_out(report)


# ── GET /validation/quality/summary ───────────────────────────────────────────


@router.get(
    "/quality/summary",
    response_model=QualitySummaryOut,
    summary="Aggregate quality scores across all tracked facilities",
)
async def quality_summary(
    period: str | None = Query(
        default=None,
        description="Filter to a specific period string, e.g. '2026-04'. "
        "If omitted, returns the latest score per facility.",
    ),
    _: User = Depends(get_current_active_user),
) -> QualitySummaryOut:
    """Return aggregate quality scores for all facilities in the trend tracker."""
    facility_ids = _trend_tracker.all_facility_ids()
    if not facility_ids:
        return QualitySummaryOut(
            period=period or "latest",
            facility_count=0,
            average_overall_score=0.0,
            facility_scores=[],
        )

    scores: list[DataQualityScore] = []
    for fid in facility_ids:
        if period:
            # Find score for the specified period
            history = _trend_tracker._history.get(fid, [])
            match = next((s for s in history if s.period == period), None)
            if match:
                scores.append(match)
        else:
            latest = _trend_tracker.latest(fid)
            if latest:
                scores.append(latest)

    avg = sum(s.dimensions.overall for s in scores) / len(scores) if scores else 0.0
    return QualitySummaryOut(
        period=period or "latest",
        facility_count=len(scores),
        average_overall_score=round(avg, 4),
        facility_scores=[_score_to_out(s) for s in scores],
    )


# ── GET /validation/quality/{facility_id} ────────────────────────────────────


@router.get(
    "/quality/{facility_id}",
    response_model=FacilityQualityOut,
    summary="Get data quality score for a specific facility",
)
async def facility_quality(
    facility_id: str,
    period: str | None = Query(
        default=None,
        description="Period string (e.g. '2026-04'). If omitted, returns latest.",
    ),
    _: User = Depends(get_current_active_user),
) -> FacilityQualityOut:
    """Return the most recent (or period-specific) quality score for a facility."""
    if period:
        history = _trend_tracker._history.get(facility_id, [])
        score = next((s for s in history if s.period == period), None)
    else:
        score = _trend_tracker.latest(facility_id)

    if not score:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No quality score found for facility '{facility_id}'"
            + (f" in period '{period}'" if period else ""),
        )

    return _score_to_out(score)


# ── POST /validation/rules ────────────────────────────────────────────────────


@router.post(
    "/rules",
    response_model=CustomRuleOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a custom validation rule (admin only)",
)
async def create_custom_rule(
    rule: CustomRuleIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_admin),
) -> CustomRuleOut:
    """Persist a custom validation rule spec to the database.

    Custom rules extend the built-in business rule set without requiring
    code changes.  They are stored as JSONB and loaded by the pipeline at
    runtime.

    The ``rule_spec`` must contain at minimum:
      ``{"field": str, "operator": "eq|ne|gt|lt|gte|lte|in|not_in|regex",
         "value": any, "severity": "ERROR|WARNING|INFO"}``
    """
    # Validate rule_spec structure
    required_spec_keys = {"field", "operator", "value", "severity"}
    missing = required_spec_keys - set(rule.rule_spec.keys())
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"rule_spec missing required keys: {sorted(missing)}",
        )

    valid_operators = {"eq", "ne", "gt", "lt", "gte", "lte", "in", "not_in", "regex"}
    if rule.rule_spec.get("operator") not in valid_operators:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"operator must be one of: {sorted(valid_operators)}",
        )

    valid_severities = {"ERROR", "WARNING", "INFO"}
    if rule.rule_spec.get("severity") not in valid_severities:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"severity must be one of: {sorted(valid_severities)}",
        )

    # Upsert into a simple JSONB-backed table
    # We use raw SQL to avoid needing a new SQLAlchemy model for this endpoint.
    now = datetime.utcnow()
    await db.execute(
        text(
            """
            INSERT INTO validation_custom_rules
                (rule_name, record_type, description, rule_spec, created_by, created_at)
            VALUES
                (:rule_name, :record_type, :description, :rule_spec::jsonb, :created_by, :created_at)
            ON CONFLICT (rule_name) DO UPDATE SET
                record_type  = EXCLUDED.record_type,
                description  = EXCLUDED.description,
                rule_spec    = EXCLUDED.rule_spec,
                created_by   = EXCLUDED.created_by,
                created_at   = EXCLUDED.created_at
            """
        ),
        {
            "rule_name": rule.rule_name,
            "record_type": rule.record_type,
            "description": rule.description,
            "rule_spec": json.dumps(rule.rule_spec),
            "created_by": str(current_user.id),
            "created_at": now,
        },
    )
    await db.commit()

    return CustomRuleOut(
        rule_name=rule.rule_name,
        record_type=rule.record_type,
        description=rule.description,
        rule_spec=rule.rule_spec,
        created_by=str(current_user.id),
        created_at=now,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────


def _report_to_out(report: ValidationReport) -> ValidationReportOut:
    issues_out = [
        ValidationIssueOut(
            row=issue.get("row"),
            field=issue.get("field"),
            message=issue.get("message", ""),
            severity=issue.get("severity", "ERROR"),
        )
        for issue in report.errors
    ]
    return ValidationReportOut(
        record_type=report.record_type,
        total_records=report.total_records,
        valid_count=report.valid_count,
        warning_count=report.warning_count,
        error_count=report.error_count,
        errors=issues_out,
        summary=report.summary(),
    )


def _score_to_out(score: DataQualityScore) -> FacilityQualityOut:
    dims = score.dimensions
    return FacilityQualityOut(
        facility_id=score.facility_id,
        period=score.period,
        computed_at=score.computed_at,
        record_type=score.record_type,
        total_records=score.total_records,
        valid_records=score.valid_records,
        warning_records=score.warning_records,
        error_records=score.error_records,
        dimensions=QualityDimensionsOut(
            completeness=dims.completeness,
            accuracy=dims.accuracy,
            timeliness=dims.timeliness,
            consistency=dims.consistency,
            overall=dims.overall,
            grade=dims.grade(),
        ),
        issues_by_field=score.issues_by_field,
    )
