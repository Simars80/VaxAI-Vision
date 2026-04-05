"""Feature engineering for the VaxAI supply-demand forecasting model.

Transforms raw SupplyTransaction records (pulled from the DB) into a
time-series feature matrix suitable for Prophet and LightGBM.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import TYPE_CHECKING

import pandas as pd

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

_DATE_COL = "ds"         # Prophet convention
_TARGET_COL = "y"        # Prophet convention
_ISSUE_TYPES = {"issue", "dispense", "distribution"}

# ── Data loading ───────────────────────────────────────────────────────────────


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
        return pd.DataFrame(columns=["supply_item_id", "facility_id", "txn_date", "total_qty"])
    return pd.DataFrame(rows, columns=["supply_item_id", "facility_id", "txn_date", "total_qty"])


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


def _add_calendar_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["week_of_year"] = df[_DATE_COL].dt.isocalendar().week.astype(int)
    df["month"] = df[_DATE_COL].dt.month
    df["quarter"] = df[_DATE_COL].dt.quarter
    df["year"] = df[_DATE_COL].dt.year
    # Seasonal sine/cosine encoding (annual cycle)
    day_of_year = df[_DATE_COL].dt.dayofyear
    df["sin_annual"] = (2 * 3.14159 * day_of_year / 365).apply(lambda x: __import__("math").sin(x))
    df["cos_annual"] = (2 * 3.14159 * day_of_year / 365).apply(lambda x: __import__("math").cos(x))
    return df


def _add_lag_features(df: pd.DataFrame, target_col: str, lags: list[int] | None = None) -> pd.DataFrame:
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
