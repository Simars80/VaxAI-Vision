"""VaxAI supply-demand forecasting model.

Ensemble approach:
  - Prophet  — captures seasonality, holidays, trend changepoints
  - LightGBM — captures non-linear lag/rolling features

Final prediction = weighted average of both models (configurable alpha).
"""

from __future__ import annotations

import logging
import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

_DATE_COL = "ds"
_TARGET_COL = "y"


# ── Model configuration ────────────────────────────────────────────────────────


@dataclass
class ForecastConfig:
    """Hyper-parameters for the ensemble forecaster."""

    # Forecast horizon (number of periods ahead)
    horizon: int = 12
    # Time-series frequency for Prophet
    freq: str = "W"

    # Prophet settings
    prophet_seasonality_mode: str = "multiplicative"
    prophet_changepoint_prior_scale: float = 0.05
    prophet_yearly_seasonality: bool = True
    prophet_weekly_seasonality: bool = False

    # LightGBM settings
    lgbm_n_estimators: int = 300
    lgbm_learning_rate: float = 0.05
    lgbm_num_leaves: int = 31
    lgbm_min_child_samples: int = 5

    # Ensemble weight for Prophet (LightGBM weight = 1 - prophet_weight)
    prophet_weight: float = 0.4


# ── Forecaster ─────────────────────────────────────────────────────────────────


class VaxAIForecaster:
    """Ensemble supply-demand forecaster (Prophet + LightGBM).

    Usage::

        forecaster = VaxAIForecaster(config)
        forecaster.fit(train_df)
        predictions = forecaster.predict(periods=12)
        metrics = forecaster.evaluate(test_df)
    """

    def __init__(self, config: ForecastConfig | None = None) -> None:
        self.config = config or ForecastConfig()
        self._prophet_model: Any = None
        self._lgbm_model: Any = None
        self._feature_cols: list[str] = []
        self._train_df: pd.DataFrame | None = None
        self.is_fitted = False

    # ── Fit ───────────────────────────────────────────────────────────────────

    def fit(self, df: pd.DataFrame) -> "VaxAIForecaster":
        """Fit both Prophet and LightGBM models on the provided time series.

        Args:
            df: DataFrame with columns [ds, y] plus lag/rolling features.
                Produced by `app.ml.features.build_time_series`.
        """
        if df.empty or len(df) < 8:
            raise ValueError("Need at least 8 observations to train the forecaster.")

        self._train_df = df.copy()
        self._fit_prophet(df)
        self._fit_lgbm(df)
        self.is_fitted = True
        logger.info(
            "VaxAIForecaster fitted on %d rows (freq=%s, horizon=%d)",
            len(df),
            self.config.freq,
            self.config.horizon,
        )
        return self

    def _fit_prophet(self, df: pd.DataFrame) -> None:
        try:
            from prophet import Prophet
        except ImportError:
            logger.warning("prophet not installed — Prophet component disabled")
            return

        cfg = self.config
        m = Prophet(
            seasonality_mode=cfg.prophet_seasonality_mode,
            changepoint_prior_scale=cfg.prophet_changepoint_prior_scale,
            yearly_seasonality=cfg.prophet_yearly_seasonality,
            weekly_seasonality=cfg.prophet_weekly_seasonality,
        )
        prophet_df = df[[_DATE_COL, _TARGET_COL]].dropna()
        m.fit(prophet_df)
        self._prophet_model = m

    def _fit_lgbm(self, df: pd.DataFrame) -> None:
        try:
            import lightgbm as lgb
        except ImportError:
            logger.warning("lightgbm not installed — LightGBM component disabled")
            return

        from app.ml.features import get_lgbm_feature_cols

        feature_cols = get_lgbm_feature_cols(df)
        train_clean = df[feature_cols + [_TARGET_COL]].dropna()
        if train_clean.empty:
            logger.warning("No clean rows after dropping NaN for LightGBM training")
            return

        X = train_clean[feature_cols]
        y = train_clean[_TARGET_COL]
        self._feature_cols = feature_cols

        cfg = self.config
        model = lgb.LGBMRegressor(
            n_estimators=cfg.lgbm_n_estimators,
            learning_rate=cfg.lgbm_learning_rate,
            num_leaves=cfg.lgbm_num_leaves,
            min_child_samples=cfg.lgbm_min_child_samples,
            n_jobs=-1,
            random_state=42,
        )
        model.fit(X, y)
        self._lgbm_model = model

    # ── Predict ───────────────────────────────────────────────────────────────

    def predict(self, periods: int | None = None) -> pd.DataFrame:
        """Generate a forecast DataFrame.

        Returns columns: [ds, yhat, yhat_lower, yhat_upper, source]
        where `source` is 'prophet', 'lgbm', or 'ensemble'.
        """
        if not self.is_fitted:
            raise RuntimeError("Forecaster must be fitted before predicting.")

        periods = periods or self.config.horizon
        prophet_df = lgbm_df = None

        if self._prophet_model:
            prophet_df = self._predict_prophet(periods)

        if self._lgbm_model:
            lgbm_df = self._predict_lgbm(periods)

        if prophet_df is not None and lgbm_df is not None:
            return self._blend(prophet_df, lgbm_df)
        if prophet_df is not None:
            return prophet_df.assign(source="prophet")
        if lgbm_df is not None:
            return lgbm_df.assign(source="lgbm")
        raise RuntimeError("No model available for prediction.")

    def _predict_prophet(self, periods: int) -> pd.DataFrame:
        future = self._prophet_model.make_future_dataframe(
            periods=periods, freq=self.config.freq
        )
        forecast = self._prophet_model.predict(future)
        return (
            forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]]
            .tail(periods)
            .reset_index(drop=True)
        )

    def _predict_lgbm(self, periods: int) -> pd.DataFrame:
        """Recursive multi-step LightGBM forecast."""
        from app.ml.features import (
            _add_calendar_features,
            _add_lag_features,
            _add_rolling_features,
        )

        assert self._train_df is not None
        history = self._train_df[[_DATE_COL, _TARGET_COL]].copy()
        last_date = history[_DATE_COL].max()
        future_dates = pd.date_range(
            start=last_date + pd.tseries.frequencies.to_offset(self.config.freq),
            periods=periods,
            freq=self.config.freq,
        )

        preds = []
        for fdate in future_dates:
            row_df = pd.DataFrame({_DATE_COL: [fdate], _TARGET_COL: [np.nan]})
            combined = pd.concat([history, row_df], ignore_index=True)
            combined = _add_calendar_features(combined)
            combined = _add_lag_features(combined, _TARGET_COL)
            combined = _add_rolling_features(combined, _TARGET_COL)
            last_row = combined.iloc[[-1]][self._feature_cols].fillna(0)
            pred = float(self._lgbm_model.predict(last_row)[0])
            pred = max(pred, 0.0)  # demand can't be negative
            preds.append(pred)
            # Feed prediction back into history for next step
            history = pd.concat(
                [history, pd.DataFrame({_DATE_COL: [fdate], _TARGET_COL: [pred]})],
                ignore_index=True,
            )

        return pd.DataFrame(
            {
                "ds": future_dates,
                "yhat": preds,
                "yhat_lower": [p * 0.85 for p in preds],  # ±15% uncertainty band
                "yhat_upper": [p * 1.15 for p in preds],
            }
        )

    def _blend(self, prophet_df: pd.DataFrame, lgbm_df: pd.DataFrame) -> pd.DataFrame:
        w_p = self.config.prophet_weight
        w_l = 1.0 - w_p
        result = prophet_df.copy()
        result["yhat"] = w_p * prophet_df["yhat"] + w_l * lgbm_df["yhat"]
        result["yhat_lower"] = (
            w_p * prophet_df["yhat_lower"] + w_l * lgbm_df["yhat_lower"]
        )
        result["yhat_upper"] = (
            w_p * prophet_df["yhat_upper"] + w_l * lgbm_df["yhat_upper"]
        )
        result["source"] = "ensemble"
        return result

    # ── Evaluate ──────────────────────────────────────────────────────────────

    def evaluate(self, test_df: pd.DataFrame) -> dict[str, float]:
        """Compute evaluation metrics on a held-out test DataFrame.

        Args:
            test_df: DataFrame with [ds, y] columns.

        Returns:
            Dict with MAE, RMSE, MAPE, coverage (prediction interval coverage).
        """
        periods = len(test_df)
        pred_df = self.predict(periods=periods)

        actual = test_df[_TARGET_COL].values
        predicted = pred_df["yhat"].values[: len(actual)]
        lower = pred_df["yhat_lower"].values[: len(actual)]
        upper = pred_df["yhat_upper"].values[: len(actual)]

        mae = float(np.mean(np.abs(actual - predicted)))
        rmse = float(np.sqrt(np.mean((actual - predicted) ** 2)))
        nonzero = actual != 0
        mape = (
            float(
                np.mean(
                    np.abs((actual[nonzero] - predicted[nonzero]) / actual[nonzero])
                )
                * 100
            )
            if nonzero.any()
            else float("nan")
        )
        coverage = float(np.mean((actual >= lower) & (actual <= upper)))

        return {"mae": mae, "rmse": rmse, "mape": mape, "coverage": coverage}

    # ── Serialisation ─────────────────────────────────────────────────────────

    def save(self, path: Path | str) -> None:
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)
        with open(path / "forecaster.pkl", "wb") as f:
            pickle.dump(self, f)
        logger.info("Forecaster saved to %s", path)

    @classmethod
    def load(cls, path: Path | str) -> "VaxAIForecaster":
        path = Path(path)
        with open(path / "forecaster.pkl", "rb") as f:
            return pickle.load(f)
