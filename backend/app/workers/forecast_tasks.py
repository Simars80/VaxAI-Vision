"""Celery tasks for model training and batch forecasting."""

from __future__ import annotations

import logging

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="app.workers.forecast_tasks.train_forecast_model",
    max_retries=2,
    default_retry_delay=120,
    queue="ml_training",
)
def train_forecast_model(
    self,
    model_run_id: str,
    supply_item_id: str,
    facility_id: str | None = None,
    config_overrides: dict | None = None,
) -> dict:
    """Train and register a forecasting model for the given item/facility."""
    return _run_sync(
        _async_train(model_run_id, supply_item_id, facility_id, config_overrides)
    )


async def _async_train(
    model_run_id: str,
    supply_item_id: str,
    facility_id: str | None,
    config_overrides: dict | None,
) -> dict:
    from app.database import AsyncSessionLocal
    from app.ml.forecaster import ForecastConfig
    from app.ml.training import train_model
    from app.models.forecasting import ModelRun, ModelRunStatus

    config = ForecastConfig(**(config_overrides or {}))

    async with AsyncSessionLocal() as session:
        run_obj = await session.get(ModelRun, model_run_id)
        if run_obj:
            run_obj.status = ModelRunStatus.running
            await session.commit()

    try:
        result = await train_model(
            supply_item_id=supply_item_id,
            facility_id=facility_id,
            config=config,
            model_run_id=model_run_id,
        )

        async with AsyncSessionLocal() as session:
            run_obj = await session.get(ModelRun, model_run_id)
            if run_obj:
                run_obj.status = ModelRunStatus.completed
                run_obj.mlflow_run_id = result.get("mlflow_run_id")
                run_obj.model_path = result.get("model_path")
                run_obj.metrics = result.get("metrics")
                from datetime import datetime, timezone

                run_obj.completed_at = datetime.now(timezone.utc)
                await session.commit()

        return result

    except Exception as exc:
        logger.error(
            "Model training failed for item=%s: %s", supply_item_id, exc, exc_info=True
        )
        async with AsyncSessionLocal() as session:
            run_obj = await session.get(ModelRun, model_run_id)
            if run_obj:
                run_obj.status = ModelRunStatus.failed
                run_obj.error_message = str(exc)[:2000]
                from datetime import datetime, timezone

                run_obj.completed_at = datetime.now(timezone.utc)
                await session.commit()
        raise


def _run_sync(coro):
    import asyncio

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(asyncio.run, coro).result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)
