-- VaxAI Vision — Cold Chain Monitoring Tables
-- Migration: V009
-- Description: Creates cold_chain_facilities, cold_chain_readings, and
--              cold_chain_alerts tables and seeds the 6 pilot facilities
--              previously hardcoded in cold_chain.py

CREATE TYPE reading_status AS ENUM ('normal', 'warning', 'breach');
CREATE TYPE alert_type     AS ENUM ('high', 'low');
CREATE TYPE alert_severity AS ENUM ('warning', 'critical');

-- ── cold_chain_facilities ──────────────────────────────────────────────────────

CREATE TABLE cold_chain_facilities (
    id          TEXT             PRIMARY KEY,
    name        TEXT             NOT NULL,
    country     TEXT             NOT NULL,
    min_temp_c  DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    max_temp_c  DOUBLE PRECISION NOT NULL DEFAULT 8.0,
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- ── cold_chain_readings ────────────────────────────────────────────────────────

CREATE TABLE cold_chain_readings (
    id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id  TEXT             NOT NULL REFERENCES cold_chain_facilities(id),
    sensor_id    TEXT             NOT NULL,
    timestamp    TIMESTAMPTZ      NOT NULL,
    temp_celsius DOUBLE PRECISION NOT NULL,
    status       reading_status   NOT NULL DEFAULT 'normal',
    created_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cold_chain_readings_facility_id ON cold_chain_readings(facility_id);
CREATE INDEX idx_cold_chain_readings_sensor_id   ON cold_chain_readings(sensor_id);
CREATE INDEX idx_cold_chain_readings_timestamp   ON cold_chain_readings(timestamp DESC);

-- ── cold_chain_alerts ──────────────────────────────────────────────────────────

CREATE TABLE cold_chain_alerts (
    id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id        TEXT           NOT NULL REFERENCES cold_chain_facilities(id),
    sensor_id          TEXT           NOT NULL,
    alert_type         alert_type     NOT NULL,
    peak_temp_celsius  DOUBLE PRECISION NOT NULL,
    threshold_celsius  DOUBLE PRECISION NOT NULL,
    start_time         TIMESTAMPTZ    NOT NULL,
    end_time           TIMESTAMPTZ,
    resolved           BOOLEAN        NOT NULL DEFAULT FALSE,
    severity           alert_severity NOT NULL DEFAULT 'warning',
    created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cold_chain_alerts_facility_id ON cold_chain_alerts(facility_id);
CREATE INDEX idx_cold_chain_alerts_start_time  ON cold_chain_alerts(start_time DESC);
CREATE INDEX idx_cold_chain_alerts_resolved    ON cold_chain_alerts(resolved);

-- ── Seed: 6 pilot facilities ───────────────────────────────────────────────────

INSERT INTO cold_chain_facilities (id, name, country, min_temp_c, max_temp_c)
VALUES
    ('NG-KAN', 'Kano Central Store',    'Nigeria', 2.0, 8.0),
    ('NG-LAG', 'Lagos Logistics Hub',   'Nigeria', 2.0, 8.0),
    ('NG-ABJ', 'Abuja NPHCDA Depot',   'Nigeria', 2.0, 8.0),
    ('KE-NBI', 'Nairobi KEMSA Store',  'Kenya',   2.0, 8.0),
    ('KE-MBA', 'Mombasa Cold Room',    'Kenya',   2.0, 8.0),
    ('KE-KSM', 'Kisumu Regional Hub',  'Kenya',   2.0, 8.0);

-- ── Updated-at trigger ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_cold_chain_facilities_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cold_chain_facilities_updated_at
    BEFORE UPDATE ON cold_chain_facilities
    FOR EACH ROW EXECUTE FUNCTION set_cold_chain_facilities_updated_at();
