"""Feature engineering for the VaxAI supply-demand forecasting model.

Transforms raw SupplyTransaction records and DHIS2 coverage data (pulled from
the DB) into a time-series feature matrix suitable for Prophet and LightGBM.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import TYPE_CHECKING

import numpy as np
import pandas as pd

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────��────────────────

_DATE_COL = "ds"  # Prophet convention
_TARGET_COL = "y"  # Prophet convention
_ISSUE_TYPES = {"issue", "dispense", "distribution"}


# ── Imputation strategies ─────────────────────────────────────────────────────


class ImputationStrategy(str, Enum):
    FORWARD_FILL = "forward_fill"
    INTERPOLATE = "interpolate"
    FLAG_AND_SKIP = "flag_and_skip"
    ZERO_FILL = "zero_fill"


# ── Data quality report ────────────────────────────────────────────────���─────


@dataclass
class DataQualityReport:
    """Summary of data quality issues detected in a time series."""

    total_expected_periods: int = 0
    total_present_periods: int = 0
    missing_periods: list[str] = field(default_factory=list)
    completeness_score: float = 1.0
    facilities_with_gaps: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def is_usable(self) -> bool:
        return self.completeness_score >= 0.5


# ── Data loading (supply transactions) ────────────────────────────────────────


async def load_transactions(
    session: "AsyncSession",
    supply_item_id: str | None = None,
    facility_id: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> pd.DataFrame:
    """Load SupplyTransaction rows and return a raw DataFrame.

    Uses text-based SQL so this module stays decoupled from SQLAlchemy ORM
    imports at training time (allows running outside a web process).
    """
    from sqlalchemy import text

    filters = ["transaction_type = ANY(:types)"]
    params: dict = {"types": list(_ISSUE_TYPES)}

    if supply_item_id:
        filters.append("supply_item_id = :item_id")
        params["item_id"] = supply_item_id
    if facility_id:
        filters.append("facility_id = :fac_id")
        params["fac_id"] = facility_id
    if start_date:
        filters.append("transaction_date >= :start")
        params["start"] = start_date
    if end_date:
        filters.append("transaction_date <= :end")
        params["end"] = end_date

    where = " AND ".join(filters)
    sql = text(
        f"""
        SELECT
            st.supply_item_id::text,
            st.facility_id,
            DATE_TRUNC('day', st.transaction_date)::date AS txn_date,
            SUM(st.quantity)                              AS total_qty
        FROM supply_transactions st
        WHERE {where}
        GROUP BY st.supply_item_id, st.facility_id, txn_date
        ORDER BY txn_date
        """
    )
    result = await session.execute(sql, params)
    rows = result.fetchall()
    if not rows:
        return pd.DataFrame(
            columns=["supply_item_id", "facility_id", "txn_date", "total_qty"]
        )
    return pd.DataFrame(
        rows, columns=["supply_item_id", "facility_id", "txn_date", "total_qty"]
    )


# ── Data loading (DHIS2 coverage) ──────────────────────────���─────────────────


async def load_dhis2_coverage(
    session: "AsyncSession",
    vaccine_type: str | None = None,
    facility_id: str | None = None,
    country: str | None = None,
    start_period: str | None = None,
    end_period: str | None = None,
) -> pd.DataFrame:
    """Load DHIS2 immunization coverage data from coverage_facilities.

    Returns a DataFrame with columns:
    [vaccine_type, facility_id, period, doses_administered,
     target_population, coverage_rate]
    """
    from sqlalchemy import text

    filters: list[str] = []
    params: dict = {}

    if vaccine_type:
        filters.append("vaccine_type = :vtype")
        params["vtype"] = vaccine_type
    if facility_id:
        filters.append("id = :fac_id")
        params["fac_id"] = facility_id
    if country:
        filters.append("country = :country")
        params["country"] = country
    if start_period:
        filters.append("period >= :start_p")
        params["start_p"] = start_period
    if end_period:
        filters.append("period <= :end_p")
        params["end_p"] = end_period

    where = "WHERE " + " AND ".join(filters) if filters else ""
    sql = text(
        f"""
        SELECT
            vaccine_type,
            id          AS facility_id,
            name        AS facility_name,
            period,
            SUM(doses_administered)  AS doses_administered,
            SUM(target_population)   AS target_population,
            AVG(coverage_rate)       AS coverage_rate
        FROM coverage_facilities
        {where}
        GROUP BY vaccine_type, id, name, period
        ORDER BY period
        """
    )
    result = await session.execute(sql, params)
    rows = result.fetchall()
    cols = [
        "vaccine_type",
        "facility_id",
        "facility_name",
        "period",
        "doses_administered",
        "target_population",
        "coverage_rate",
    ]
    if not rows:
        return pd.DataFrame(columns=cols)
    return pd.DataFrame(rows, columns=cols)


def _parse_dhis2_period(period_str: str) -> pd.Timestamp:
    """Parse DHIS2 period strings to timestamps.

    Handles formats: '2024-01' (monthly), '2024-W05' (weekly),
    '2024Q1' (quarterly), '2024' (annual).
    """
    s = period_str.strip()
    if "-W" in s:
        # ISO week: '2024-W05'
        return pd.to_datetime(s + "-1", format="%Y-W%W-%w")
    if "Q" in s:
        # Quarterly: '2024Q1'
        return pd.Period(s, freq="Q").start_time
    if len(s) == 4 and s.isdigit():
        # Annual: '2024'
        return pd.Timestamp(f"{s}-01-01")
    # Monthly: '2024-01'
    return pd.Timestamp(f"{s}-01")


# ── Data quality checks ────────────────��─────────────────────────────────────


def check_data_quality(
    df: pd.DataFrame,
    date_col: str = "ds",
    freq: str = "MS",
    facility_col: str | None = None,
) -> DataQualityReport:
    """Detect gaps and quality issues in a time series.

    Args:
        df: DataFrame with at least a date column.
        date_col: Name of the date/timestamp column.
        freq: Expected frequency ('MS' monthly, 'W' weekly, etc.).
        facility_col: If set, check per-facility completeness.
    """
    report = DataQualityReport()

    if df.empty:
        report.completeness_score = 0.0
        report.warnings.append("Empty dataset")
        return report

    dates = pd.to_datetime(df[date_col])
    expected_range = pd.date_range(start=dates.min(), end=dates.max(), freq=freq)
    report.total_expected_periods = len(expected_range)
    report.total_present_periods = dates.nunique()

    missing = set(expected_range) - set(dates)
    report.missing_periods = sorted(d.strftime("%Y-%m-%d") for d in missing)
    report.completeness_score = (
        report.total_present_periods / report.total_expected_periods
        if report.total_expected_periods > 0
        else 0.0
    )

    if report.completeness_score < 0.7:
        report.warnings.append(
            f"Low completeness: {report.completeness_score:.0%} "
            f"({len(report.missing_periods)} missing periods)"
        )
    if report.completeness_score < 0.5:
        report.warnings.append("Dataset may be too sparse for reliable forecasting")

    if facility_col and facility_col in df.columns:
        for fac_id, grp in df.groupby(facility_col):
            fac_dates = pd.to_datetime(grp[date_col])
            fac_expected = pd.date_range(
                start=fac_dates.min(), end=fac_dates.max(), freq=freq
            )
            fac_present = fac_dates.nunique()
            if len(fac_expected) > 0 and fac_present / len(fac_expected) < 0.7:
                report.facilities_with_gaps.append(str(fac_id))

    if report.facilities_with_gaps:
        report.warnings.append(
            f"{len(report.facilities_with_gaps)} facilities have >30% missing periods"
        )

    return report


# ── Imputation ────────────────────────────────────────────────────────────────


def impute_missing_periods(
    df: pd.DataFrame,
    date_col: str = "ds",
    target_col: str = "y",
    freq: str = "MS",
    strategy: ImputationStrategy = ImputationStrategy.FORWARD_FILL,
) -> pd.DataFrame:
    """Fill gaps in a time series using the configured strategy.

    Returns a new DataFrame with continuous date index and imputed values.
    A boolean column ``_imputed`` marks rows that were filled in.
    """
    if df.empty:
        return df.copy()

    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.set_index(date_col).sort_index()

    full_idx = pd.date_range(start=df.index.min(), end=df.index.max(), freq=freq)
    df = df.reindex(full_idx)
    df.index.name = date_col

    imputed_mask = df[target_col].isna()

    if strategy == ImputationStrategy.FORWARD_FILL:
        df[target_col] = df[target_col].ffill()
        # Back-fill leading NaNs if any
        df[target_col] = df[target_col].bfill()
    elif strategy == ImputationStrategy.INTERPOLATE:
        df[target_col] = df[target_col].interpolate(method="linear")
        df[target_col] = df[target_col].bfill()
    elif strategy == ImputationStrategy.ZERO_FILL:
        df[target_col] = df[target_col].fillna(0)
    elif strategy == ImputationStrategy.FLAG_AND_SKIP:
        # Keep NaNs — downstream code should drop them
        pass

    df["_imputed"] = imputed_mask
    return df.reset_index()


# ── Feature engineering ────────────────────────────────────────────────────────


def build_time_series(
    df: pd.DataFrame,
    supply_item_id: str,
    facility_id: str | None = None,
    freq: str = "W",  # "D" daily, "W" weekly, "MS" monthly
) -> pd.DataFrame:
    """Aggregate raw transactions into a uniform time series.

    Returns a DataFrame with columns [ds, y] ready for Prophet, plus
    additional lag / rolling features for LightGBM.
    """
    mask = df["supply_item_id"] == supply_item_id
    if facility_id:
        mask &= df["facility_id"] == facility_id
    subset = df[mask].copy()

    if subset.empty:
        return pd.DataFrame(columns=[_DATE_COL, _TARGET_COL])

    subset["txn_date"] = pd.to_datetime(subset["txn_date"])
    ts = (
        subset.groupby("txn_date")["total_qty"]
        .sum()
        .resample(freq)
        .sum()
        .fillna(0)
        .reset_index()
        .rename(columns={"txn_date": _DATE_COL, "total_qty": _TARGET_COL})
    )

    ts = _add_calendar_features(ts)
    ts = _add_lag_features(ts, target_col=_TARGET_COL)
    ts = _add_rolling_features(ts, target_col=_TARGET_COL)
    return ts


def build_dhis2_time_series(
    df: pd.DataFrame,
    vaccine_type: str,
    facility_id: str | None = None,
    freq: str = "MS",
    imputation: ImputationStrategy = ImputationStrategy.FORWARD_FILL,
) -> tuple[pd.DataFrame, DataQualityReport]:
    """Build a forecast-ready time series from DHIS2 coverage data.

    Args:
        df: Raw DataFrame from ``load_dhis2_coverage``.
        vaccine_type: Antigen to forecast (e.g. 'BCG', 'OPV3').
        facility_id: Optional facility filter.
        freq: Resampling frequency ('MS' monthly start, 'W' weekly).
        imputation: Strategy for handling missing periods.

    Returns:
        (ts_df, quality_report) — the time series with features and a
        quality report summarising data gaps.
    """
    mask = df["vaccine_type"] == vaccine_type
    if facility_id:
        mask &= df["facility_id"] == facility_id
    subset = df[mask].copy()

    if subset.empty:
        empty = pd.DataFrame(columns=[_DATE_COL, _TARGET_COL])
        return empty, DataQualityReport(completeness_score=0.0)

    # Parse DHIS2 period strings to timestamps
    subset[_DATE_COL] = subset["period"].apply(_parse_dhis2_period)

    # Aggregate: total doses per period
    ts = (
        subset.groupby(_DATE_COL)["doses_administered"]
        .sum()
        .reset_index()
        .rename(columns={"doses_administered": _TARGET_COL})
        .sort_values(_DATE_COL)
    )

    # Data quality assessment before imputation
    quality = check_data_quality(ts, date_col=_DATE_COL, freq=freq)

    if not quality.is_usable:
        logger.warning(
            "DHIS2 data for %s has low completeness (%.0f%%) — "
            "forecast accuracy may be degraded",
            vaccine_type,
            quality.completeness_score * 100,
        )

    # Impute missing periods
    ts = impute_missing_periods(
        ts,
        date_col=_DATE_COL,
        target_col=_TARGET_COL,
        freq=freq,
        strategy=imputation,
    )

    # Drop imputed rows if strategy is flag-and-skip
    if imputation == ImputationStrategy.FLAG_AND_SKIP:
        ts = ts[~ts["_imputed"]].copy()

    # Drop the _imputed marker before feature engineering
    ts = ts.drop(columns=["_imputed"], errors="ignore")

    # Add coverage-specific features if target_population data is available
    if "target_population" in subset.columns:
        pop_by_date = (
            subset.groupby(_DATE_COL)["target_population"]
            .sum()
            .reset_index()
            .rename(columns={_DATE_COL: "merge_date"})
        )
        ts = ts.merge(
            pop_by_date,
            left_on=_DATE_COL,
            right_on="merge_date",
            how="left",
        ).drop(columns=["merge_date"], errors="ignore")
        if "target_population" in ts.columns:
            ts["target_population"] = ts["target_population"].ffill().bfill()
            nonzero_pop = ts["target_population"].replace(0, np.nan)
            ts["coverage_rate_computed"] = ts[_TARGET_COL] / nonzero_pop

    # Adapt lag/rolling windows for monthly data
    if freq == "MS":
        lags = [1, 2, 3, 6, 12]
        windows = [3, 6, 12]
    elif freq == "W":
        lags = [1, 2, 4, 8, 13, 26]
        windows = [4, 8, 13]
    else:
        lags = None
        windows = None

    ts = _add_calendar_features(ts)
    ts = _add_lag_features(ts, target_col=_TARGET_COL, lags=lags)
    ts = _add_rolling_features(ts, target_col=_TARGET_COL, windows=windows)
    return ts, quality


def _add_calendar_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["week_of_year"] = df[_DATE_COL].dt.isocalendar().week.astype(int)
    df["month"] = df[_DATE_COL].dt.month
    df["quarter"] = df[_DATE_COL].dt.quarter
    df["year"] = df[_DATE_COL].dt.year
    # Seasonal sine/cosine encoding (annual cycle)
    day_of_year = df[_DATE_COL].dt.dayofyear
    df["sin_annual"] = (2 * 3.14159 * day_of_year / 365).apply(
        lambda x: __import__("math").sin(x)
    )
    df["cos_annual"] = (2 * 3.14159 * day_of_year / 365).apply(
        lambda x: __import__("math").cos(x)
    )
    return df


def _add_lag_features(
    df: pd.DataFrame, target_col: str, lags: list[int] | None = None
) -> pd.DataFrame:
    if lags is None:
        lags = [1, 2, 4, 8, 13, 26]  # 1-2 weeks, 1-2 months, 3-6 months (weekly freq)
    df = df.copy()
    for lag in lags:
        df[f"lag_{lag}"] = df[target_col].shift(lag)
    return df


def _add_rolling_features(
    df: pd.DataFrame, target_col: str, windows: list[int] | None = None
) -> pd.DataFrame:
    if windows is None:
        windows = [4, 8, 13]
    df = df.copy()
    for w in windows:
        df[f"roll_mean_{w}"] = df[target_col].shift(1).rolling(w).mean()
        df[f"roll_std_{w}"] = df[target_col].shift(1).rolling(w).std()
    return df


def get_lgbm_feature_cols(df: pd.DataFrame) -> list[str]:
    """Return column names suitable as LightGBM input features (exclude ds, y)."""
    exclude = {_DATE_COL, _TARGET_COL}
    return [c for c in df.columns if c not in exclude]
