-- VaxAI Vision — Forecasting model runs and predictions
-- Migration: V005

CREATE TYPE model_run_status AS ENUM ('queued', 'running', 'completed', 'failed');

CREATE TABLE forecast_model_runs (
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    supply_item_id          UUID            NOT NULL,
    facility_id             VARCHAR(255),
    status                  model_run_status NOT NULL DEFAULT 'queued',
    mlflow_run_id           VARCHAR(255),
    model_path              TEXT,
    metrics                 JSONB,
    error_message           TEXT,
    celery_task_id          VARCHAR(255),
    triggered_by_user_id    UUID,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ
);

CREATE INDEX idx_fmr_item_status  ON forecast_model_runs(supply_item_id, status);
CREATE INDEX idx_fmr_created      ON forecast_model_runs(created_at DESC);

CREATE TABLE forecast_predictions (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_run_id    UUID            NOT NULL,
    supply_item_id  UUID            NOT NULL,
    facility_id     VARCHAR(255),
    forecast_date   TIMESTAMPTZ     NOT NULL,
    horizon_periods INTEGER         NOT NULL,
    yhat            DOUBLE PRECISION NOT NULL,
    yhat_lower      DOUBLE PRECISION NOT NULL,
    yhat_upper      DOUBLE PRECISION NOT NULL,
    model_source    VARCHAR(32),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fp_run_id    ON forecast_predictions(model_run_id);
CREATE INDEX idx_fp_item_date ON forecast_predictions(supply_item_id, forecast_date DESC);
