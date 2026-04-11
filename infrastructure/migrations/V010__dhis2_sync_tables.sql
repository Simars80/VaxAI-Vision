-- DHIS2 integration: sync configuration and audit log tables

CREATE TYPE dhis2_sync_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE dhis2_sync_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    base_url        VARCHAR(1024) NOT NULL,
    auth_username   VARCHAR(255),
    auth_password_encrypted TEXT,
    auth_pat_encrypted      TEXT,
    country_code    VARCHAR(2) NOT NULL DEFAULT 'XX',
    mapping_config  JSONB,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dhis2_sync_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id       UUID NOT NULL REFERENCES dhis2_sync_config(id),
    status          dhis2_sync_status NOT NULL DEFAULT 'pending',
    sync_type       VARCHAR(32) NOT NULL DEFAULT 'full',
    records_fetched INTEGER NOT NULL DEFAULT 0,
    records_created INTEGER NOT NULL DEFAULT 0,
    records_updated INTEGER NOT NULL DEFAULT 0,
    records_failed  INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT,
    details         JSONB,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_dhis2_sync_log_config_id ON dhis2_sync_log(config_id);
CREATE INDEX idx_dhis2_sync_log_started_at ON dhis2_sync_log(started_at DESC);
