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

from app.ml.features import build_time_series, load_transactions
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

    # ── 2. Train / test split ──────────────────────────────────────────────────
    split_idx = max(8, int(len(ts_df) * (1 - _TEST_FRACTION)))
    train_df = ts_df.iloc[:split_idx]
    test_df = ts_df.iloc[split_idx:]

    # ── 3. Walk-forward backtesting ────────────────────────────────────────────
    cv_results = walk_forward_backtest(ts_df, config)
    avg_metrics: dict[str, float] = {}
    if cv_results:
        for key in ("mae", "rmse", "mape", "coverage"):
            vals = [r[key] for r in cv_results if key in r and not pd.isna(r[key])]
            avg_metrics[f"cv_{key}"] = (
                float(sum(vals) / len(vals)) if vals else float("nan")
            )

    # ── 4. Final model fit on full training data ───────────────────────────────
    forecaster = VaxAIForecaster(config)
    forecaster.fit(train_df)
    final_metrics = forecaster.evaluate(test_df) if not test_df.empty else {}
    all_metrics = {**final_metrics, **avg_metrics}

    # ── 5. MLflow logging ──────────────────────────────────────────────────────
    mlflow_run_id: str | None = None
    try:
        import mlflow

        mlflow.set_tracking_uri(_MLFLOW_TRACKING_URI)
        mlflow.set_experiment(_MLFLOW_EXPERIMENT)

        with mlflow.start_run(run_name=f"vaxai-forecast-{run_label}") as run:
            mlflow_run_id = run.info.run_id

            # Log hyper-parameters
            mlflow.log_params(
                {
                    "supply_item_id": supply_item_id,
                    "facility_id": facility_id or "all",
                    "freq": config.freq,
                    "horizon": config.horizon,
                    "prophet_weight": config.prophet_weight,
                    "lgbm_n_estimators": config.lgbm_n_estimators,
                    "train_rows": len(train_df),
                    "test_rows": len(test_df),
                }
            )

            # Log metrics
            for k, v in all_metrics.items():
                if not pd.isna(v):
                    mlflow.log_metric(k, v)

            # Save and log model artifact
            with tempfile.TemporaryDirectory() as tmpdir:
                model_dir = Path(tmpdir) / "model"
                forecaster.save(model_dir)
                mlflow.log_artifact(
                    str(model_dir / "forecaster.pkl"), artifact_path="model"
                )

            logger.info("MLflow run %s logged for %s", mlflow_run_id, run_label)

    except Exception as exc:
        logger.warning("MLflow logging failed (non-fatal): %s", exc)

    # ── 6. Persist model locally for serving ──────────────────────────────────
    local_path = (
        Path("/tmp/vaxai_models") / supply_item_id[:8] / (facility_id or "global")
    )
    forecaster.save(local_path)

    return {
        "supply_item_id": supply_item_id,
        "facility_id": facility_id,
        "mlflow_run_id": mlflow_run_id,
        "model_path": str(local_path),
        "metrics": all_metrics,
        "train_rows": len(train_df),
        "test_rows": len(test_df),
    }
