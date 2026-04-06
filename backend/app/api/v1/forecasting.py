"""Forecasting REST API — model training triggers and prediction serving."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_analyst_or_above
from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.forecasting import ForecastPrediction, ModelRun, ModelRunStatus
from app.models.user import User

router = APIRouter(prefix="/forecasting", tags=["forecasting"])

# ── Schemas ────────────────────────────────────────────────────────────────────


class TrainRequest(BaseModel):
    supply_item_id: uuid.UUID
    facility_id: str | None = None
    horizon: int = Field(default=12, ge=1, le=52)
    freq: str = Field(default="W", pattern="^(D|W|MS)$")
    prophet_weight: float = Field(default=0.4, ge=0.0, le=1.0)


class ModelRunResponse(BaseModel):
    id: uuid.UUID
    supply_item_id: uuid.UUID
    facility_id: str | None
    status: ModelRunStatus
    mlflow_run_id: str | None
    metrics: dict | None
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class PredictionPoint(BaseModel):
    forecast_date: datetime
    yhat: float
    yhat_lower: float
    yhat_upper: float
    model_source: str | None


class ForecastResponse(BaseModel):
    supply_item_id: uuid.UUID
    facility_id: str | None
    model_run_id: uuid.UUID
    predictions: list[PredictionPoint]


# ── Training endpoint ──────────────────────────────────────────────────────────


@router.post(
    "/train",
    response_model=ModelRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger a model training run for a supply item",
)
async def trigger_training(
    request: TrainRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
) -> ModelRunResponse:
    """Queue an async model training job and return the ModelRun record.
    Poll `/forecasting/runs/{run_id}` for status.
    """
    run = ModelRun(
        supply_item_id=request.supply_item_id,
        facility_id=request.facility_id,
        status=ModelRunStatus.queued,
        triggered_by_user_id=current_user.id,
    )
    db.add(run)
    await db.flush()

    config_overrides = {
        "horizon": request.horizon,
        "freq": request.freq,
        "prophet_weight": request.prophet_weight,
    }

    from app.workers.forecast_tasks import train_forecast_model

    task = train_forecast_model.apply_async(
        args=[str(run.id), str(request.supply_item_id), request.facility_id],
        kwargs={"config_overrides": config_overrides},
        queue="ml_training",
    )
    run.celery_task_id = task.id
    await db.flush()

    return ModelRunResponse.model_validate(run)


# ── Model run status ───────────────────────────────────────────────────────────


@router.get(
    "/runs",
    response_model=list[ModelRunResponse],
    summary="List model training runs",
)
async def list_runs(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
) -> list[ModelRunResponse]:
    result = await db.execute(
        select(ModelRun)
        .order_by(ModelRun.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return [ModelRunResponse.model_validate(r) for r in result.scalars()]


@router.get(
    "/runs/{run_id}",
    response_model=ModelRunResponse,
    summary="Get model training run status",
)
async def get_run(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
) -> ModelRunResponse:
    run = await db.get(ModelRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Model run not found")
    return ModelRunResponse.model_validate(run)


# ── Forecast serving endpoint ──────────────────────────────────────────────────


@router.get(
    "/predict/{supply_item_id}",
    response_model=ForecastResponse,
    summary="Serve a demand forecast for a supply item",
)
async def predict(
    supply_item_id: uuid.UUID,
    facility_id: str | None = Query(default=None),
    periods: int = Query(default=12, ge=1, le=52),
    _: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ForecastResponse:
    """Return forecast predictions from the latest completed model run.

    Falls back to generating an on-demand prediction if a persisted
    forecast is not available for the requested horizon.
    """
    # Find latest completed model run for this item/facility
    q = (
        select(ModelRun)
        .where(
            ModelRun.supply_item_id == supply_item_id,
            ModelRun.status == ModelRunStatus.completed,
        )
        .order_by(ModelRun.created_at.desc())
        .limit(1)
    )
    if facility_id:
        q = q.where(ModelRun.facility_id == facility_id)

    result = await db.execute(q)
    run = result.scalars().first()

    if run is None:
        raise HTTPException(
            status_code=404,
            detail="No completed model run found for this supply item. Trigger training first.",
        )

    # Try to load and serve persisted predictions first
    preds_result = await db.execute(
        select(ForecastPrediction)
        .where(
            ForecastPrediction.model_run_id == run.id,
            ForecastPrediction.forecast_date >= datetime.now(timezone.utc),
        )
        .order_by(ForecastPrediction.forecast_date.asc())
        .limit(periods)
    )
    persisted = preds_result.scalars().all()

    if persisted:
        predictions = [
            PredictionPoint(
                forecast_date=p.forecast_date,
                yhat=p.yhat,
                yhat_lower=p.yhat_lower,
                yhat_upper=p.yhat_upper,
                model_source=p.model_source,
            )
            for p in persisted
        ]
        return ForecastResponse(
            supply_item_id=supply_item_id,
            facility_id=facility_id,
            model_run_id=run.id,
            predictions=predictions,
        )

    # On-demand prediction from saved model file
    model_path = run.model_path
    if not model_path or not Path(model_path).exists():
        raise HTTPException(
            status_code=503,
            detail="Model artifact not available locally. Re-trigger training.",
        )

    try:
        from app.ml.forecaster import VaxAIForecaster

        forecaster = VaxAIForecaster.load(Path(model_path))
        pred_df = forecaster.predict(periods=periods)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction error: {exc}") from exc

    predictions = [
        PredictionPoint(
            forecast_date=row["ds"],
            yhat=max(0.0, float(row["yhat"])),
            yhat_lower=max(0.0, float(row["yhat_lower"])),
            yhat_upper=max(0.0, float(row["yhat_upper"])),
            model_source=row.get("source"),
        )
        for _, row in pred_df.iterrows()
    ]
    return ForecastResponse(
        supply_item_id=supply_item_id,
        facility_id=facility_id,
        model_run_id=run.id,
        predictions=predictions,
    )
