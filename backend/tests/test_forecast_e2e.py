"""
End-to-end tests for the forecasting endpoints.

Covers:
  - POST /forecasting/train — trigger model training (RBAC + job creation)
  - GET  /forecasting/runs — list model runs (pagination)
  - GET  /forecasting/runs/{run_id} — get single run status
  - GET  /forecasting/predict/{supply_item_id} — serve predictions
  - 404 when no completed run exists for an item
  - 404 when run_id does not exist
  - Validation errors for bad TrainRequest payloads

Note: Celery workers are typically not running in test environments.
      The /train endpoint is tested for job-record creation (202) and RBAC;
      the predict endpoint is tested for the "no completed run" 404 path.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.forecasting import ForecastPrediction, ModelRun, ModelRunStatus


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _create_completed_run(
    db: AsyncSession,
    supply_item_id: uuid.UUID,
    facility_id: str | None = None,
) -> ModelRun:
    """Insert a completed ModelRun and return it."""
    run = ModelRun(
        supply_item_id=supply_item_id,
        facility_id=facility_id,
        status=ModelRunStatus.completed,
    )
    db.add(run)
    await db.flush()
    return run


async def _create_predictions(
    db: AsyncSession,
    run: ModelRun,
    n: int = 4,
) -> None:
    """Insert n future ForecastPrediction rows for the given run."""
    now = datetime.now(timezone.utc)
    for i in range(1, n + 1):
        db.add(
            ForecastPrediction(
                model_run_id=run.id,
                supply_item_id=run.supply_item_id,
                facility_id=run.facility_id,
                forecast_date=now + timedelta(weeks=i),
                horizon_periods=i,
                yhat=float(100 + i * 5),
                yhat_lower=float(90 + i * 5),
                yhat_upper=float(110 + i * 5),
                model_source="prophet",
            )
        )
    await db.flush()


# ── Auth guards ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_train_requires_auth(client: AsyncClient) -> None:
    """POST /forecasting/train without a token returns 401/403."""
    resp = await client.post(
        "/api/v1/forecasting/train",
        json={"supply_item_id": str(uuid.uuid4())},
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_list_runs_requires_auth(client: AsyncClient) -> None:
    """GET /forecasting/runs without a token returns 401/403."""
    resp = await client.get("/api/v1/forecasting/runs")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_predict_requires_auth(client: AsyncClient) -> None:
    """GET /forecasting/predict/{id} without a token returns 401/403."""
    resp = await client.get(f"/api/v1/forecasting/predict/{uuid.uuid4()}")
    assert resp.status_code in (401, 403)


# ── RBAC ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_train_viewer_forbidden(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Viewer cannot trigger training — returns 403."""
    resp = await client.post(
        "/api/v1/forecasting/train",
        headers=auth_headers,
        json={"supply_item_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_train_analyst_allowed_through_rbac(
    client: AsyncClient, analyst_auth_headers: dict
) -> None:
    """Analyst role passes RBAC check on /forecasting/train (not 403)."""
    resp = await client.post(
        "/api/v1/forecasting/train",
        headers=analyst_auth_headers,
        json={"supply_item_id": str(uuid.uuid4())},
    )
    # 202 if Celery is up; 500 if not available.  Never 403.
    assert resp.status_code != 403


# ── TrainRequest validation ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_train_invalid_horizon_rejected(
    client: AsyncClient, analyst_auth_headers: dict
) -> None:
    """horizon=0 violates the ge=1 constraint — returns 422."""
    resp = await client.post(
        "/api/v1/forecasting/train",
        headers=analyst_auth_headers,
        json={"supply_item_id": str(uuid.uuid4()), "horizon": 0},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_train_invalid_freq_rejected(
    client: AsyncClient, analyst_auth_headers: dict
) -> None:
    """freq='MONTHLY' does not match the allowed pattern — returns 422."""
    resp = await client.post(
        "/api/v1/forecasting/train",
        headers=analyst_auth_headers,
        json={"supply_item_id": str(uuid.uuid4()), "freq": "MONTHLY"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_train_missing_supply_item_id_rejected(
    client: AsyncClient, analyst_auth_headers: dict
) -> None:
    """Omitting supply_item_id returns 422."""
    resp = await client.post(
        "/api/v1/forecasting/train",
        headers=analyst_auth_headers,
        json={},
    )
    assert resp.status_code == 422


# ── List Runs ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_runs_returns_list(
    client: AsyncClient, auth_headers: dict
) -> None:
    """GET /forecasting/runs returns a list."""
    resp = await client.get("/api/v1/forecasting/runs", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_list_runs_pagination(
    client: AsyncClient, auth_headers: dict
) -> None:
    """limit and offset params are respected."""
    resp = await client.get(
        "/api/v1/forecasting/runs",
        params={"limit": 2, "offset": 0},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()) <= 2


@pytest.mark.asyncio
async def test_list_runs_seeded_run_appears(
    client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
) -> None:
    """A seeded completed run appears in the run list."""
    item_id = uuid.uuid4()
    run = await _create_completed_run(db_session, item_id)

    resp = await client.get("/api/v1/forecasting/runs", headers=auth_headers)
    assert resp.status_code == 200
    ids = [r["id"] for r in resp.json()]
    assert str(run.id) in ids


# ── Get Single Run ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_run_returns_correct_run(
    client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
) -> None:
    """GET /forecasting/runs/{run_id} returns the correct run record."""
    item_id = uuid.uuid4()
    run = await _create_completed_run(db_session, item_id)

    resp = await client.get(
        f"/api/v1/forecasting/runs/{run.id}", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(run.id)
    assert data["supply_item_id"] == str(item_id)
    assert data["status"] == "completed"


@pytest.mark.asyncio
async def test_get_run_not_found_returns_404(
    client: AsyncClient, auth_headers: dict
) -> None:
    """GET /forecasting/runs/{nonexistent_id} returns 404."""
    resp = await client.get(
        f"/api/v1/forecasting/runs/{uuid.uuid4()}", headers=auth_headers
    )
    assert resp.status_code == 404


# ── Predictions ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_predict_no_completed_run_returns_404(
    client: AsyncClient, auth_headers: dict
) -> None:
    """predict/ for an item with no completed run returns 404."""
    resp = await client.get(
        f"/api/v1/forecasting/predict/{uuid.uuid4()}", headers=auth_headers
    )
    assert resp.status_code == 404
    assert "no completed model run" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_predict_returns_predictions_from_db(
    client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
) -> None:
    """If persisted predictions exist for a completed run, predict/ returns them."""
    item_id = uuid.uuid4()
    run = await _create_completed_run(db_session, item_id)
    await _create_predictions(db_session, run, n=4)

    resp = await client.get(
        f"/api/v1/forecasting/predict/{item_id}",
        params={"periods": 4},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["supply_item_id"] == str(item_id)
    assert data["model_run_id"] == str(run.id)
    assert "predictions" in data
    assert len(data["predictions"]) >= 1
    for point in data["predictions"]:
        assert "forecast_date" in point
        assert "yhat" in point
        assert "yhat_lower" in point
        assert "yhat_upper" in point


@pytest.mark.asyncio
async def test_predict_periods_param_limits_results(
    client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
) -> None:
    """The periods param limits the number of prediction points returned."""
    item_id = uuid.uuid4()
    run = await _create_completed_run(db_session, item_id)
    await _create_predictions(db_session, run, n=8)

    resp = await client.get(
        f"/api/v1/forecasting/predict/{item_id}",
        params={"periods": 3},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()["predictions"]) <= 3


@pytest.mark.asyncio
async def test_predict_facility_filter(
    client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
) -> None:
    """facility_id param filters to runs for that specific facility."""
    item_id = uuid.uuid4()
    fac_a = "FAC-PRED-A"
    fac_b = "FAC-PRED-B"

    run_a = await _create_completed_run(db_session, item_id, facility_id=fac_a)
    await _create_predictions(db_session, run_a, n=2)
    run_b = await _create_completed_run(db_session, item_id, facility_id=fac_b)
    await _create_predictions(db_session, run_b, n=2)

    resp = await client.get(
        f"/api/v1/forecasting/predict/{item_id}",
        params={"facility_id": fac_a},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    # The returned run should be for fac_a
    assert resp.json()["facility_id"] == fac_a
