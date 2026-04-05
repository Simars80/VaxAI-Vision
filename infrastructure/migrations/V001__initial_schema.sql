-- VaxAI Vision — Initial Schema
-- Migration: V001
-- Description: Core tables for vaccine supply chain intelligence platform

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS "btree_gin";   -- composite GIN indexes

-- ─── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE supply_status AS ENUM (
    'adequate',
    'low',
    'critical',
    'stockout',
    'overstocked'
);

CREATE TYPE facility_type AS ENUM (
    'national_store',
    'regional_store',
    'district_store',
    'health_facility',
    'vaccination_site'
);

CREATE TYPE alert_severity AS ENUM (
    'info',
    'warning',
    'critical'
);

-- ─── Organizations / Countries ────────────────────────────────────────────────
CREATE TABLE countries (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    iso2        CHAR(2) NOT NULL UNIQUE,
    iso3        CHAR(3) NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    region      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Administrative Areas ─────────────────────────────────────────────────────
CREATE TABLE admin_areas (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_id  UUID NOT NULL REFERENCES countries(id),
    parent_id   UUID REFERENCES admin_areas(id),
    level       SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 4),
    code        TEXT NOT NULL,
    name        TEXT NOT NULL,
    geom        TEXT,                     -- GeoJSON polygon (stored as text; upgrade to PostGIS later)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (country_id, code)
);

-- ─── Health Facilities ────────────────────────────────────────────────────────
CREATE TABLE facilities (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_area_id   UUID NOT NULL REFERENCES admin_areas(id),
    external_id     TEXT,
    name            TEXT NOT NULL,
    type            facility_type NOT NULL,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    catchment_pop   INTEGER,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_facilities_admin_area ON facilities(admin_area_id);
CREATE INDEX idx_facilities_type       ON facilities(type);

-- ─── Vaccines / Products ──────────────────────────────────────────────────────
CREATE TABLE vaccines (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gtin            TEXT UNIQUE,            -- Global Trade Item Number
    name            TEXT NOT NULL,
    short_name      TEXT,
    manufacturer    TEXT,
    doses_per_vial  SMALLINT NOT NULL DEFAULT 1,
    cold_chain_temp SMALLINT,               -- minimum storage temp °C
    shelf_life_days SMALLINT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Inventory Snapshots ──────────────────────────────────────────────────────
CREATE TABLE inventory_snapshots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id     UUID NOT NULL REFERENCES facilities(id),
    vaccine_id      UUID NOT NULL REFERENCES vaccines(id),
    snapshot_date   DATE NOT NULL,
    quantity_doses  INTEGER NOT NULL DEFAULT 0,
    quantity_vials  INTEGER,
    batch_numbers   TEXT[],
    expiry_dates    DATE[],
    status          supply_status NOT NULL DEFAULT 'adequate',
    source          TEXT,                   -- e.g. 'lmis_sync', 'manual_entry'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inv_facility_date  ON inventory_snapshots(facility_id, snapshot_date DESC);
CREATE INDEX idx_inv_vaccine        ON inventory_snapshots(vaccine_id);
CREATE INDEX idx_inv_status         ON inventory_snapshots(status);
CREATE INDEX idx_inv_snapshot_date  ON inventory_snapshots(snapshot_date DESC);

-- ─── Demand Forecasts ─────────────────────────────────────────────────────────
CREATE TABLE demand_forecasts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id     UUID NOT NULL REFERENCES facilities(id),
    vaccine_id      UUID NOT NULL REFERENCES vaccines(id),
    forecast_date   DATE NOT NULL,
    horizon_days    SMALLINT NOT NULL DEFAULT 30,
    predicted_doses INTEGER NOT NULL,
    lower_bound     INTEGER,
    upper_bound     INTEGER,
    model_version   TEXT,
    confidence      NUMERIC(4,3),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forecast_facility_date ON demand_forecasts(facility_id, forecast_date DESC);
CREATE INDEX idx_forecast_vaccine       ON demand_forecasts(vaccine_id);

-- ─── Supply Chain Alerts ──────────────────────────────────────────────────────
CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id     UUID REFERENCES facilities(id),
    vaccine_id      UUID REFERENCES vaccines(id),
    severity        alert_severity NOT NULL,
    alert_type      TEXT NOT NULL,          -- e.g. 'stockout_risk', 'expiry_risk'
    title           TEXT NOT NULL,
    body            TEXT,
    metadata        JSONB,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_facility   ON alerts(facility_id);
CREATE INDEX idx_alerts_severity   ON alerts(severity);
CREATE INDEX idx_alerts_unresolved ON alerts(created_at DESC) WHERE resolved_at IS NULL;

-- ─── AI / Model Run Logs ──────────────────────────────────────────────────────
CREATE TABLE model_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name      TEXT NOT NULL,
    model_version   TEXT NOT NULL,
    run_type        TEXT NOT NULL,          -- 'forecast', 'anomaly', 'optimization'
    status          TEXT NOT NULL DEFAULT 'started',
    input_ref       TEXT,                   -- S3 path to input data
    output_ref      TEXT,                   -- S3 path to model outputs
    metrics         JSONB,
    error_message   TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_model_runs_type_status ON model_runs(run_type, status);

-- ─── Sessions (app-level, backed by Redis) ───────────────────────────────────
-- Note: active sessions are stored in Redis. This table retains audit history.
CREATE TABLE session_audit (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,
    session_token   TEXT,                   -- hashed
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expired_at      TIMESTAMPTZ
);

CREATE INDEX idx_session_user     ON session_audit(user_id);
CREATE INDEX idx_session_created  ON session_audit(created_at DESC);

-- ─── Updated-at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_countries_updated_at
    BEFORE UPDATE ON countries
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_facilities_updated_at
    BEFORE UPDATE ON facilities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
