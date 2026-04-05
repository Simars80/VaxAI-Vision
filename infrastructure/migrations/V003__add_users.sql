-- VaxAI Vision — Users & RBAC
-- Migration: V003
-- Description: Application user accounts with role-based access control

-- ─── Enum ─────────────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM (
    'admin',
    'clinician',
    'analyst',
    'viewer'
);

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email            TEXT NOT NULL UNIQUE,
    full_name        TEXT NOT NULL,
    hashed_password  TEXT NOT NULL,
    role             user_role NOT NULL DEFAULT 'viewer',
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    country_code     CHAR(2) REFERENCES countries(iso2),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
