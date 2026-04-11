"""Integration tests for the DHIS2-adapted ML forecasting pipeline.

Tests run entirely in-memory using synthetic DHIS2 coverage data patterns
(no database or external services required).
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd
import pytest

from app.ml.features import (
    DataQualityReport,
    ImputationStrategy,
    build_dhis2_time_series,
    check_data_quality,
    impute_missing_periods,
)
from app.ml.forecaster import ForecastConfig, VaxAIForecaster

try:
    import lightgbm  # noqa: F401

    _HAS_LIGHTGBM = True
except (ImportError, OSError):
    _HAS_LIGHTGBM = False

_skip_no_lgbm = pytest.mark.skipif(
    not _HAS_LIGHTGBM,
    reason="lightgbm not available (missing libomp or not installed)",
)


# ── Fixtures ──────────────────────────────────────────────────────────────────


def _make_dhis2_coverage_df(
    vaccine_type: str = "BCG",
    n_months: int = 36,
    start_year: int = 2022,
    base_doses: int = 500,
    missing_indices: list[int] | None = None,
) -> pd.DataFrame:
    """Generate synthetic DHIS2 coverage data resembling real patterns."""
    rows = []
    for i in range(n_months):
        if missing_indices and i in missing_indices:
            continue
        year = start_year + i // 12
        month = (i % 12) + 1
        period = f"{year}-{month:02d}"
        # Add seasonal variation (higher in dry season months 1-3, 10-12)
        seasonal = 1.0 + 0.15 * math.cos(2 * math.pi * month / 12)
        # Add a slight upward trend
        trend = 1.0 + 0.005 * i
        noise = np.random.default_rng(42 + i).normal(0, 0.05)
        doses = int(base_doses * seasonal * trend * (1 + noise))
        target_pop = 1000
        rows.append(
            {
                "vaccine_type": vaccine_type,
                "facility_id": "fac-001",
                "facility_name": "Test Health Center",
                "period": period,
                "doses_administered": max(doses, 0),
                "target_population": target_pop,
                "coverage_rate": doses / target_pop,
            }
        )
    return pd.DataFrame(rows)


# ── Data quality checks ──────────────────────────────────────────────────────


class TestDataQualityChecks:
    def test_complete_data_scores_1(self):
        dates = pd.date_range("2022-01-01", periods=24, freq="MS")
        df = pd.DataFrame({"ds": dates, "y": range(24)})
        report = check_data_quality(df, date_col="ds", freq="MS")
        assert report.completeness_score == 1.0
        assert report.is_usable
        assert len(report.missing_periods) == 0

    def test_missing_months_detected(self):
        dates = pd.date_range("2022-01-01", periods=24, freq="MS")
        df = pd.DataFrame({"ds": dates, "y": range(24)})
        # Drop months 6, 12, 18
        df = df.drop([5, 11, 17]).reset_index(drop=True)
        report = check_data_quality(df, date_col="ds", freq="MS")
        assert len(report.missing_periods) == 3
        assert report.completeness_score < 1.0
        assert report.is_usable  # 21/24 = 87.5%

    def test_sparse_data_flagged_unusable(self):
        dates = pd.to_datetime(["2022-01-01", "2022-06-01", "2023-01-01"])
        df = pd.DataFrame({"ds": dates, "y": [10, 20, 30]})
        report = check_data_quality(df, date_col="ds", freq="MS")
        assert report.completeness_score < 0.5
        assert not report.is_usable

    def test_empty_data(self):
        df = pd.DataFrame(columns=["ds", "y"])
        report = check_data_quality(df, date_col="ds", freq="MS")
        assert report.completeness_score == 0.0
        assert not report.is_usable

    def test_facility_gaps_detected(self):
        rows = []
        for fac in ["fac-A", "fac-B"]:
            for i in range(12):
                if fac == "fac-B" and i in (3, 4, 5, 6):
                    continue  # fac-B missing 4 months
                dt = pd.Timestamp(f"2022-{i+1:02d}-01")
                rows.append({"ds": dt, "y": 100, "facility_id": fac})
        df = pd.DataFrame(rows)
        report = check_data_quality(
            df, date_col="ds", freq="MS", facility_col="facility_id"
        )
        assert "fac-B" in report.facilities_with_gaps
        assert "fac-A" not in report.facilities_with_gaps


# ── Imputation strategies ────────────────────────────────────────────────────


class TestImputation:
    def _make_gapped_ts(self) -> pd.DataFrame:
        dates = pd.date_range("2022-01-01", periods=12, freq="MS")
        df = pd.DataFrame({"ds": dates, "y": [100 + i * 10 for i in range(12)]})
        # Remove months 4, 5, 6 (April, May, June)
        return df.drop([3, 4, 5]).reset_index(drop=True)

    def test_forward_fill(self):
        df = self._make_gapped_ts()
        result = impute_missing_periods(
            df, freq="MS", strategy=ImputationStrategy.FORWARD_FILL
        )
        assert len(result) == 12  # All months present
        # April should be forward-filled from March (y=120, i.e. 100+2*10)
        apr = result[result["ds"] == pd.Timestamp("2022-04-01")]
        assert len(apr) == 1
        assert bool(apr.iloc[0]["_imputed"]) is True
        # Value comes from March (index 2 → y=120)
        assert apr.iloc[0]["y"] == 120.0

    def test_interpolate(self):
        df = self._make_gapped_ts()
        result = impute_missing_periods(
            df, freq="MS", strategy=ImputationStrategy.INTERPOLATE
        )
        assert len(result) == 12
        apr = result[result["ds"] == pd.Timestamp("2022-04-01")]
        # Interpolated between March (120) and July (160)
        assert 120 <= apr.iloc[0]["y"] <= 160

    def test_zero_fill(self):
        df = self._make_gapped_ts()
        result = impute_missing_periods(
            df, freq="MS", strategy=ImputationStrategy.ZERO_FILL
        )
        apr = result[result["ds"] == pd.Timestamp("2022-04-01")]
        assert apr.iloc[0]["y"] == 0.0

    def test_flag_and_skip(self):
        df = self._make_gapped_ts()
        result = impute_missing_periods(
            df, freq="MS", strategy=ImputationStrategy.FLAG_AND_SKIP
        )
        # Imputed rows should have NaN target
        imputed = result[result["_imputed"]]
        assert len(imputed) == 3
        assert imputed["y"].isna().all()


# ── DHIS2 time series building ────────────────────────────────────────────────


class TestBuildDhis2TimeSeries:
    def test_basic_build(self):
        raw_df = _make_dhis2_coverage_df(n_months=24)
        ts, quality = build_dhis2_time_series(
            raw_df, vaccine_type="BCG", freq="MS"
        )
        assert not ts.empty
        assert "ds" in ts.columns
        assert "y" in ts.columns
        assert quality.completeness_score == 1.0

    def test_with_missing_months(self):
        raw_df = _make_dhis2_coverage_df(
            n_months=24, missing_indices=[5, 6, 11]
        )
        ts, quality = build_dhis2_time_series(
            raw_df,
            vaccine_type="BCG",
            freq="MS",
            imputation=ImputationStrategy.FORWARD_FILL,
        )
        # Should have all months filled
        assert len(ts) == 24
        assert quality.completeness_score < 1.0
        assert len(quality.missing_periods) > 0

    def test_calendar_features_added(self):
        raw_df = _make_dhis2_coverage_df(n_months=24)
        ts, _ = build_dhis2_time_series(raw_df, vaccine_type="BCG", freq="MS")
        assert "month" in ts.columns
        assert "quarter" in ts.columns
        assert "sin_annual" in ts.columns

    def test_lag_features_monthly(self):
        raw_df = _make_dhis2_coverage_df(n_months=24)
        ts, _ = build_dhis2_time_series(raw_df, vaccine_type="BCG", freq="MS")
        # Monthly lags should include 1, 2, 3, 6, 12
        assert "lag_1" in ts.columns
        assert "lag_12" in ts.columns

    def test_coverage_rate_computed(self):
        raw_df = _make_dhis2_coverage_df(n_months=24)
        ts, _ = build_dhis2_time_series(raw_df, vaccine_type="BCG", freq="MS")
        assert "coverage_rate_computed" in ts.columns

    def test_empty_vaccine_type(self):
        raw_df = _make_dhis2_coverage_df(vaccine_type="BCG")
        ts, quality = build_dhis2_time_series(
            raw_df, vaccine_type="NONEXISTENT", freq="MS"
        )
        assert ts.empty
        assert quality.completeness_score == 0.0

    def test_flag_and_skip_drops_imputed(self):
        raw_df = _make_dhis2_coverage_df(
            n_months=24, missing_indices=[3, 4, 5]
        )
        ts, _ = build_dhis2_time_series(
            raw_df,
            vaccine_type="BCG",
            freq="MS",
            imputation=ImputationStrategy.FLAG_AND_SKIP,
        )
        # Should have fewer rows than full range
        assert len(ts) < 24


# ── End-to-end forecast on DHIS2 data ────────────────────────────────────────


class TestDhis2Forecast:
    @_skip_no_lgbm
    def test_end_to_end_forecast(self):
        """Full pipeline: synthetic DHIS2 data → features → fit → predict."""
        raw_df = _make_dhis2_coverage_df(n_months=36, base_doses=500)
        ts, quality = build_dhis2_time_series(
            raw_df, vaccine_type="BCG", freq="MS"
        )
        assert quality.is_usable

        config = ForecastConfig(
            data_source="dhis2",
            freq="MS",
            horizon=6,
            prophet_weight=0.0,  # LightGBM only (no Prophet dep in tests)
        )

        # Drop NaN rows from lag features for training
        train_ts = ts.dropna(subset=["y"]).copy()
        assert len(train_ts) >= 8

        forecaster = VaxAIForecaster(config)
        forecaster.fit(train_ts)
        assert forecaster.is_fitted

        predictions = forecaster.predict(periods=6)
        assert len(predictions) == 6
        assert all(predictions["yhat"] >= 0)
        assert "ds" in predictions.columns

    @_skip_no_lgbm
    def test_forecast_with_gaps_and_imputation(self):
        """Forecast still works when DHIS2 data has gaps (imputed)."""
        raw_df = _make_dhis2_coverage_df(
            n_months=36, missing_indices=[5, 10, 15, 20]
        )
        ts, quality = build_dhis2_time_series(
            raw_df,
            vaccine_type="BCG",
            freq="MS",
            imputation=ImputationStrategy.INTERPOLATE,
        )
        assert quality.is_usable

        config = ForecastConfig(
            data_source="dhis2",
            freq="MS",
            horizon=3,
            prophet_weight=0.0,
        )

        train_ts = ts.dropna(subset=["y"]).copy()
        forecaster = VaxAIForecaster(config)
        forecaster.fit(train_ts)
        predictions = forecaster.predict(periods=3)
        assert len(predictions) == 3
        assert all(predictions["yhat"] >= 0)

    @_skip_no_lgbm
    def test_evaluate_on_holdout(self):
        """Train/test split evaluation produces valid metrics."""
        raw_df = _make_dhis2_coverage_df(n_months=36, base_doses=500)
        ts, _ = build_dhis2_time_series(
            raw_df, vaccine_type="BCG", freq="MS"
        )
        clean = ts.dropna(subset=["y"]).copy()

        split = int(len(clean) * 0.8)
        train_df = clean.iloc[:split]
        test_df = clean.iloc[split:]

        config = ForecastConfig(
            data_source="dhis2", freq="MS", horizon=len(test_df),
            prophet_weight=0.0,
        )
        forecaster = VaxAIForecaster(config)
        forecaster.fit(train_df)
        metrics = forecaster.evaluate(test_df)

        assert "mae" in metrics
        assert "rmse" in metrics
        assert "mape" in metrics
        assert metrics["mae"] >= 0
        assert metrics["rmse"] >= 0

    def test_config_defaults_for_dhis2(self):
        """ForecastConfig supports DHIS2 data source and imputation settings."""
        config = ForecastConfig(
            data_source="dhis2",
            freq="MS",
            dhis2_imputation="interpolate",
        )
        assert config.data_source == "dhis2"
        assert config.dhis2_imputation == "interpolate"
        assert config.freq == "MS"
