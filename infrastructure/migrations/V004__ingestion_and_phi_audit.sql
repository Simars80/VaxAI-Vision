-- VaxAI Vision — Ingestion pipeline + HIPAA PHI audit tables
-- Migration: V004
-- Description: Adds ingestion job queue tables, normalized supply models,
--              and the immutable PHI access audit log required by HIPAA § 164.312(b)

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE ingestion_source AS ENUM ('csv', 'excel', 'fhir_r4');
CREATE TYPE ingestion_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'partial');
CREATE TYPE supply_category  AS ENUM ('vaccine', 'cold_chain', 'consumable', 'equipment', 'other');

-- ─── Ingestion Jobs ───────────────────────────────────────────────────────────

CREATE TABLE ingestion_jobs (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    source                  ingestion_source NOT NULL,
    status                  ingestion_status NOT NULL DEFAULT 'pending',
    file_name               TEXT,
    fhir_base_url           TEXT,
    celery_task_id          VARCHAR(255),
    rows_total              INTEGER,
    rows_succeeded          INTEGER,
    rows_failed             INTEGER,
    error_summary           TEXT,
    triggered_by_user_id    UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ
);

CREATE INDEX idx_ingestion_jobs_status     ON ingestion_jobs(status);
CREATE INDEX idx_ingestion_jobs_created    ON ingestion_jobs(created_at DESC);

-- ─── Ingestion Audit Logs ─────────────────────────────────────────────────────

CREATE TABLE ingestion_audit_logs (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id          UUID        NOT NULL,
    row_index       INTEGER,
    action          VARCHAR(32) NOT NULL,   -- inserted | updated | skipped | error
    entity_type     VARCHAR(64),
    entity_id       VARCHAR(255),
    detail          JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ing_audit_job_id ON ingestion_audit_logs(job_id);

-- ─── Supply Items (master catalogue) ─────────────────────────────────────────

CREATE TABLE supply_items (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_code   VARCHAR(128),
    name            VARCHAR(512)    NOT NULL,
    description     TEXT,
    category        supply_category NOT NULL DEFAULT 'other',
    unit_of_measure VARCHAR(64),
    min_temp_celsius DOUBLE PRECISION,
    max_temp_celsius DOUBLE PRECISION,
    source_job_id   UUID,
    extra           JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_supply_items_external_code ON supply_items(external_code)
    WHERE external_code IS NOT NULL;

-- ─── Supply Transactions ──────────────────────────────────────────────────────

CREATE TABLE supply_transactions (
    id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    supply_item_id      UUID    NOT NULL,
    transaction_type    VARCHAR(32) NOT NULL, -- receipt | issue | adjustment | wastage
    quantity            DOUBLE PRECISION NOT NULL,
    unit_of_measure     VARCHAR(64),
    facility_id         VARCHAR(255),
    facility_name       VARCHAR(512),
    transaction_date    TIMESTAMPTZ,
    lot_number          VARCHAR(128),
    expiry_date         TIMESTAMPTZ,
    source_job_id       UUID,
    fhir_resource_id    VARCHAR(255),
    extra               JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_supply_txn_item       ON supply_transactions(supply_item_id);
CREATE INDEX idx_supply_txn_facility   ON supply_transactions(facility_id);
CREATE INDEX idx_supply_txn_date       ON supply_transactions(transaction_date DESC);

-- ─── Patient Census (FHIR import) ────────────────────────────────────────────

CREATE TABLE patient_census (
    id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    fhir_patient_id     VARCHAR(255) NOT NULL,
    facility_id         VARCHAR(255),
    age_years           INTEGER,
    gender              VARCHAR(16),
    country_code        CHAR(2),
    census_date         TIMESTAMPTZ,
    source_job_id       UUID,
    extra               JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patient_census_fhir_id    ON patient_census(fhir_patient_id);
CREATE INDEX idx_patient_census_facility   ON patient_census(facility_id);

-- ─── PHI Access Audit Log (HIPAA § 164.312(b)) ───────────────────────────────
-- IMMUTABLE: no UPDATE or DELETE is permitted on this table.
-- Row-level security should be configured to DENY modifications in production.

CREATE TABLE phi_access_logs (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID,
    user_email      VARCHAR(255),
    user_role       VARCHAR(64),
    resource_type   VARCHAR(64)  NOT NULL,
    resource_id     VARCHAR(255),
    action          VARCHAR(16)  NOT NULL,   -- GET | POST | PATCH | DELETE | EXPORT
    endpoint        VARCHAR(512),
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    outcome         VARCHAR(16)  NOT NULL DEFAULT 'success', -- success | denied | error
    http_status     INTEGER,
    accessed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_phi_access_user_time  ON phi_access_logs(user_id, accessed_at DESC);
CREATE INDEX ix_phi_access_resource   ON phi_access_logs(resource_type, resource_id);

-- Prevent modification of PHI audit records (immutability control)
-- In production, revoke UPDATE/DELETE from the application DB user:
--   REVOKE UPDATE, DELETE ON phi_access_logs FROM vaxai_app;
COMMENT ON TABLE phi_access_logs IS
    'HIPAA § 164.312(b) — Immutable PHI access audit log. '
    'No rows may be modified or deleted. Retention: min 6 years.';
