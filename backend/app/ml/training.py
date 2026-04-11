"""MLflow-tracked training pipeline for VaxAI supply-demand forecaster.

Workflow:
  1. Load and feature-engineer training data from the DB
  2. Time-based train/test split (walk-forward validation)
  3. Fit VaxAIForecaster
  4. Evaluate on held-out test set
  5. Log params, metrics, and model artifact to MLflow
  6. Persist forecaster to local filesystem / S3 artifact store
"""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path
from typing import Any

import pandas as pd

from app.ml.features import (
    ImputationStrategy,
    build_dhis2_time_series,
    build_time_series,
    load_dhis2_coverage,
    load_transactions,
)
from app.ml.forecaster import ForecastConfig, VaxAIForecaster

logger = logging.getLogger(__name__)

_MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
_MLFLOW_EXPERIMENT = os.getenv("MLFLOW_EXPERIMENT_NAME", "vaxai-supply-demand-forecast")
_TEST_FRACTION = 0.2  # last 20% of data used as test set


# ── Walk-forward backtesting ───────────────────────────────────────────────────


def walk_forward_backtest(
    df: pd.DataFrame,
    config: ForecastConfig,
    n_splits: int = 3,
) -> list[dict[str, float]]:
    """Evaluate the forecaster using walk-forward cross-validation.

    Returns a list of metric dicts, one per fold.
    """
    if len(df) < 16:
        logger.warning(
            "Not enough data for walk-forward CV (%d rows), skipping", len(df)
        )
        return []

    results = []
    total = len(df)
    test_size = max(config.horizon, total // (n_splits + 1))

    for i in range(n_splits):
        cutoff_idx = total - test_size * (n_splits - i)
        if cutoff_idx < 8:
            continue
        train = df.iloc[:cutoff_idx].copy()
        test = df.iloc[cutoff_idx : cutoff_idx + test_size].copy()

        try:
            forecaster = VaxAIForecaster(config)
            forecaster.fit(train)
            metrics = forecaster.evaluate(test)
            metrics["fold"] = i
            results.append(metrics)
            logger.info(
                "Fold %d — MAE=%.2f RMSE=%.2f MAPE=%.1f%%",
                i,
                metrics["mae"],
                metrics["rmse"],
                metrics["mape"],
            )
        except Exception as exc:
            logger.warning("Fold %d failed: %s", i, exc)

    return results


# ── Training pipeline ─────────────────────────────────────────────────────────


async def train_model(
    supply_item_id: str,
    facility_id: str | None = None,
    config: ForecastConfig | None = None,
    model_run_id: str | None = None,
) -> dict[str, Any]:
    """End-to-end training pipeline for a single (item, facility) combination.

    Returns a dict with the MLflow run_id, final metrics, and model path.
    """
    config = config or ForecastConfig()

    # Route to DHIS2 pipeline if configured
    if config.data_source == "dhis2":
        return await train_model_dhis2(
            vaccine_type=supply_item_id,
            facility_id=facility_id,
            config=config,
            model_run_id=model_run_id,
        )

    run_label = f"item={supply_item_id[:8]}" + (
        f" fac={facility_id[:8]}" if facility_id else ""
    )

    # ── 1. Load data from DB ───────────────────────────────────────────────────
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        raw_df = await load_transactions(
            session,
            supply_item_id=supply_item_id,
            facility_id=facility_id,
        )

    if raw_df.empty:
        return {"error": "No transactions found for the given item/facility"}

    ts_df = build_time_series(
        raw_df, supply_item_id=supply_item_id, facility_id=facility_id, freq=config.freq
    )
    if ts_df.empty or len(ts_df) < 8:
        return {"error": f"Insufficient time-series data ({len(ts_df)} rows)"}

    return _fit_evaluate_and_log(
        ts_df=ts_df,
        config=config,
        run_label=run_label,
        item_key=supply_item_id,
        facility_id=facility_id,
    )


async def train_model_dhis2(
    vaccine_type: str,
    facility_id: str | None = None,
    country: str | None = None,
    config: ForecastConfig | None = None,
    model_run_id: str | None = None,
) -> dict[str, Any]:
    """End-to-end training pipeline for DHIS2 immunization coverage data.

    Uses doses_administered per antigen per period as the forecast target.
    """
    config = config or ForecastConfig(data_source="dhis2", freq="MS")
    imputation = ImputationStrategy(config.dhis2_imputation)
    run_label = f"dhis2-{vaccine_type}" + (
        f" fac={facility_id[:8]}" if facility_id else ""
    )

    # ── 1. Load DHIS2 coverage data ───────────────────────────────────────────
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        raw_df = await load_dhis2_coverage(
            session,
            vaccine_type=vaccine_type,
            facility_id=facility_id,
            country=country,
        )

    if raw_df.empty:
        return {"error": f"No DHIS2 coverage data for vaccine_type={vaccine_type}"}

    # ── 2. Build time series with quality checks ──────────────────────────────
    ts_df, quality_report = build_dhis2_time_series(
        raw_df,
        vaccine_type=vaccine_type,
        facility_id=facility_id,
        freq=config.freq,
        imputation=imputation,
    )

    if ts_df.empty or len(ts_df) < 8:
        return {
            "error": f"Insufficient DHIS2 time-series data ({len(ts_df)} rows)",
            "data_quality": {
                "completeness": quality_report.completeness_score,
                "missing_periods": quality_report.missing_periods[:10],
                "warnings": quality_report.warnings,
            },
        }

    result = _fit_evaluate_and_log(
        ts_df=ts_df,
        config=config,
        run_label=run_label,
        item_key=vaccine_type,
        facility_id=facility_id,
    )

    # Attach quality metadata to the result
    result["data_source"] = "dhis2"
    result["data_quality"] = {
        "completeness": quality_report.completeness_score,
        "missing_periods_count": len(quality_report.missing_periods),
        "facilities_with_gaps": len(quality_report.facilities_with_gaps),
        "warnings": quality_report.warnings,
    }
    return result


def _fit_evaluate_and_log(
    ts_df: pd.DataFrame,
    config: ForecastConfig,
    run_label: str,
    item_key: str,
    facility_id: str | None,
) -> dict[str, Any]:
    """Shared train/evaluate/log logic for both supply and DHIS2 pipelines."""

    # ── Train / test split ────────────────────────────────────────────────────
    split_idx = max(8, int(len(ts_df) * (1 - _TEST_FRACTION)))
    train_df = ts_df.iloc[:split_idx]
    test_df = ts_df.iloc[split_idx:]

    # ── Walk-forward backtesting ──────────────────────────────────────────────
    cv_results = walk_forward_backtest(ts_df, config)
    avg_metrics: dict[str, float] = {}
    if cv_results:
        for key in ("mae", "rmse", "mape", "coverage"):
            vals = [r[key] for r in cv_results if key in r and not pd.isna(r[key])]
            avg_metrics[f"cv_{key}"] = (
                float(sum(vals) / len(vals)) if vals else float("nan")
            )

    # ── Final model fit ───────────────────────────────────────────────────────
    forecaster = VaxAIForecaster(config)
    forecaster.fit(train_df)
    final_metrics = forecaster.evaluate(test_df) if not test_df.empty else {}
    all_metrics = {**final_metrics, **avg_metrics}

    # ── MLflow logging ────────────────────────────────────────────────────────
    mlflow_run_id: str | None = None
    try:
        import mlflow

        mlflow.set_tracking_uri(_MLFLOW_TRACKING_URI)
        mlflow.set_experiment(_MLFLOW_EXPERIMENT)

        with mlflow.start_run(run_name=f"vaxai-forecast-{run_label}") as run:
            mlflow_run_id = run.info.run_id

            mlflow.log_params(
                {
                    "item_key": item_key,
                    "facility_id": facility_id or "all",
                    "data_source": config.data_source,
                    "freq": config.freq,
                    "horizon": config.horizon,
                    "prophet_weight": config.prophet_weight,
                    "lgbm_n_estimators": config.lgbm_n_estimators,
                    "train_rows": len(train_df),
                    "test_rows": len(test_df),
                }
            )

            for k, v in all_metrics.items():
                if not pd.isna(v):
                    mlflow.log_metric(k, v)

            with tempfile.TemporaryDirectory() as tmpdir:
                model_dir = Path(tmpdir) / "model"
                forecaster.save(model_dir)
                mlflow.log_artifact(
                    str(model_dir / "forecaster.pkl"), artifact_path="model"
                )

            logger.info("MLflow run %s logged for %s", mlflow_run_id, run_label)

    except Exception as exc:
        logger.warning("MLflow logging failed (non-fatal): %s", exc)

    # ── Persist model locally ─────────────────────────────────────────────────
    local_path = (
        Path("/tmp/vaxai_models") / item_key[:8] / (facility_id or "global")
    )
    forecaster.save(local_path)

    return {
        "item_key": item_key,
        "facility_id": facility_id,
        "mlflow_run_id": mlflow_run_id,
        "model_path": str(local_path),
        "metrics": all_metrics,
        "train_rows": len(train_df),
        "test_rows": len(test_df),
    }
