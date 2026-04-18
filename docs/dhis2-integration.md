# DHIS2 Integration Architecture

**Status:** Design Complete | **Author:** CTO | **Date:** 2026-04-11

---

## 1. Overview

VaxAI Vision integrates with DHIS2 to ingest real-world immunization programme data — facility hierarchies, stock levels, doses administered, coverage indicators, and cold chain equipment status. This document defines the architecture for that integration.

### Design Principles

1. **Adapter pattern** — DHIS2 is one implementation of `ExternalDataSource`. Future sources (mSupply, OpenLMIS, FHIR) plug into the same interface.
2. **Periodic pull, not real-time** — DHIS2 data is updated monthly/quarterly. A scheduled sync (daily default, configurable cron) is sufficient.
3. **Configurable data mapping** — DHIS2 data element UIDs differ per country instance. A mapping table lets each deployment configure which UIDs map to which VaxAI fields.
4. **Credentials encrypted at rest** — Basic Auth / PAT credentials stored as Fernet-encrypted JSONB, never plaintext.
5. **Incremental sync with watermarks** — Each sync run records a high-watermark timestamp. Subsequent syncs only fetch records updated after that mark.

---

## 2. Architecture Diagram

```
┌─────────────────────┐
│   DHIS2 Instance    │
│  (play.dhis2.org)   │
│                     │
│  /api/organisation  │
│  /api/dataValueSets │
│  /api/analytics     │
│  /api/dataElements  │
└────────┬────────────┘
         │  HTTPS (Basic Auth / PAT)
         │
┌────────▼────────────────────────────────────────────────┐
│  backend/app/integrations/                              │
│                                                          │
│  ┌──────────────────┐    ┌──────────────────────┐       │
│  │ ExternalDataSource│◄───│   DHIS2Connector     │       │
│  │    (ABC)          │    │  (dhis2.py)          │       │
│  └──────────────────┘    └──────────┬───────────┘       │
│         ▲                           │                    │
│         │                ┌──────────▼───────────┐       │
│  Future adapters:        │   SyncEngine          │       │
│  - mSupplyConnector      │  (sync_engine.py)     │       │
│  - OpenLMISConnector     │  - reads mapping cfg  │       │
│  - FHIRv2Connector       │  - transforms data    │       │
│                          │  - upserts to DB      │       │
│                          │  - records SyncRun    │       │
│                          └──────────┬───────────┘       │
└─────────────────────────────────────┼───────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────┐
│  PostgreSQL (existing)                                   │
│                                                          │
│  Existing tables:              New tables:               │
│  ├─ coverage_facilities        ├─ data_source_configs    │
│  ├─ supply_items               ├─ data_mapping_configs   │
│  ├─ supply_transactions        └─ sync_runs              │
│  ├─ cold_chain_facilities                                │
│  ├─ cold_chain_readings                                  │
│  └─ patient_census                                       │
└──────────────────────────────────────────────────────────┘
```

---

## 3. ExternalDataSource Interface

Located at `backend/app/integrations/base.py`.

```python
class ExternalDataSource(ABC):
    async def __aenter__(self) -> "ExternalDataSource"
    async def __aexit__(self, *exc)
    async def test_connection(self) -> bool
    def source_type(self) -> str          # "dhis2", "msupply", etc.
    def supported_domains(self) -> list[DataDomain]
    async def fetch_facilities(...)       -> list[dict]
    async def fetch_stock_data(...)       -> list[dict]
    async def fetch_immunization_data(...) -> list[dict]
    async def fetch_cold_chain_data(...)  -> list[dict]
    async def sync(...)                   -> list[SyncResult]
```

**DataDomain enum:** `facilities`, `stock`, `immunization`, `cold_chain`, `population`

Each `fetch_*` method returns normalised dicts with a predictable schema. The SyncEngine handles DB upsert logic.

---

## 4. DHIS2 API Endpoints Consumed

| Endpoint | Purpose | Maps to |
|---|---|---|
| `GET /api/organisationUnits` | Facility hierarchy + GPS coordinates | `CoverageFacility`, `ColdChainFacility` |
| `GET /api/dataValueSets` | Raw data values (stock, immunization, CCE) | `SupplyTransaction`, `CoverageFacility` |
| `GET /api/analytics` | Pre-aggregated indicators (coverage %) | `CoverageFacility.coverage_rate` |
| `GET /api/dataElements` | Metadata for mapping configuration | `DataMappingConfig` (admin/setup) |
| `GET /api/indicators` | Coverage indicators | Forecasting pipeline input |
| `GET /api/system/info` | Connection test | Health check |

### Authentication

Two auth methods supported:

1. **Basic Auth** — `username:password` sent via HTTP Basic. Used for development and demo server.
2. **Personal Access Token (PAT)** — Sent as `Authorization: ApiToken <token>`. Preferred for production.

Credentials are stored in `data_source_configs.encrypted_credentials` as Fernet-encrypted JSONB:

```json
// Stored encrypted — decrypted shape:
{"auth_type": "basic", "username": "admin", "password": "district"}
// or
{"auth_type": "pat", "token": "d2pat_abc123..."}
```

Encryption key: derived from `settings.INTEGRATION_ENCRYPTION_KEY` (env var), using `cryptography.fernet.Fernet`.

---

## 5. Data Mapping Schema

### DHIS2 → VaxAI Model Mapping

DHIS2 data element UIDs vary by country instance. The `data_mapping_configs` table provides a configurable mapping layer.

#### Facility Mapping (organisationUnits → CoverageFacility)

| DHIS2 Field | VaxAI Field | Notes |
|---|---|---|
| `id` | `id` (or `dhis2_id` in extra) | UID becomes facility ID |
| `name` | `name` | |
| `geometry.coordinates` | `lat`, `lng` | GeoJSON Point [lng, lat] |
| `parent.name` | `region` | First ancestor = region |
| `organisationUnitGroups` | Inferred `country` | From hierarchy |

#### Immunization Data (dataValueSets → CoverageFacility)

| DHIS2 Data Element (Sierra Leone demo) | VaxAI Field | Domain |
|---|---|---|
| BCG doses given | `doses_administered` (vaccine_type=BCG) | immunization |
| OPV 1 doses given | `doses_administered` (vaccine_type=OPV1) | immunization |
| Penta 1 doses given | `doses_administered` (vaccine_type=Penta1) | immunization |
| Target population < 1 year | `target_population` | population |

#### Stock Data (dataValueSets → SupplyTransaction)

| DHIS2 Data Element | VaxAI Field | Domain |
|---|---|---|
| Vaccine stock on hand | `quantity` (transaction_type=receipt) | stock |
| Vaccine doses consumed | `quantity` (transaction_type=issue) | stock |
| Wastage doses | `quantity` (transaction_type=wastage) | stock |

#### DataMappingConfig Example Row

```json
{
  "source_config_id": "uuid-of-dhis2-config",
  "domain": "immunization",
  "external_uid": "f7n9OUiPUcX",
  "external_name": "BCG doses given",
  "vaxai_model": "CoverageFacility",
  "vaxai_field": "doses_administered",
  "transform_rule": {
    "vaccine_type": "BCG",
    "value_type": "integer",
    "aggregation": "sum"
  }
}
```

---

## 6. Sync Strategy

### Sync Flow

1. **Trigger** — Celery beat schedule (cron from `data_source_configs.sync_cron`) or manual API call.
2. **Lock** — Acquire advisory lock (PostgreSQL `pg_advisory_xact_lock`) to prevent concurrent syncs for the same source.
3. **Fetch high watermark** — Query `sync_runs` for the latest `high_watermark` for this source + domain.
4. **Pull from DHIS2** — Call `DHIS2Connector.fetch_*()` with `updated_after=high_watermark`.
5. **Transform** — Apply `DataMappingConfig` rules to map DHIS2 records to VaxAI model dicts.
6. **Upsert** — Use PostgreSQL `ON CONFLICT DO UPDATE` to create or update records. Match on `(dhis2_id + domain)` composite key for facilities, `(org_unit + data_element + period)` for data values.
7. **Record SyncRun** — Write outcome to `sync_runs` with counts and new watermark.
8. **Retry on failure** — Exponential backoff: 1m → 5m → 30m. Max 3 retries. After 3 failures, mark source as `needs_attention` and alert.

### Conflict Resolution

| Scenario | Resolution |
|---|---|
| DHIS2 record newer than local | Overwrite local with DHIS2 values |
| DHIS2 record same age as local | Skip (no-op) |
| Local record has no DHIS2 counterpart | Preserve (may be from seed data or other source) |
| DHIS2 record deleted upstream | Soft-delete (mark inactive) on next full sync |

### Sync Frequency

| Domain | Default Schedule | Rationale |
|---|---|---|
| Facilities | Weekly (`0 3 * * 0`) | Org unit hierarchy rarely changes |
| Stock | Daily (`0 2 * * *`) | Stock levels change with every delivery |
| Immunization | Daily (`0 2 * * *`) | New dose reports arrive daily |
| Cold Chain | Every 6 hours (`0 */6 * * *`) | Equipment status can change rapidly |

### Error Handling

- **Network errors** — Retry with exponential backoff via Celery.
- **Auth failures (401/403)** — Do not retry. Mark sync as failed, log credential issue.
- **Rate limiting (429)** — Respect `Retry-After` header. DHIS2 demo server has modest limits.
- **Partial failures** — Each domain syncs independently. A stock sync failure does not block facility sync.
- **Data validation errors** — Log and skip invalid records. Continue processing remaining records.

---

## 7. Database Migrations

Three new tables required:

### `data_source_configs`

```sql
CREATE TABLE data_source_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(16) NOT NULL,  -- dhis2, fhir, msupply, openlmis
    base_url VARCHAR(1024) NOT NULL,
    encrypted_credentials JSONB,
    enabled BOOLEAN NOT NULL DEFAULT true,
    sync_cron VARCHAR(64),
    config JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `data_mapping_configs`

```sql
CREATE TABLE data_mapping_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_config_id UUID NOT NULL REFERENCES data_source_configs(id),
    domain VARCHAR(32) NOT NULL,
    external_uid VARCHAR(64) NOT NULL,
    external_name VARCHAR(512),
    vaxai_model VARCHAR(128) NOT NULL,
    vaxai_field VARCHAR(128) NOT NULL,
    transform_rule JSONB,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_data_mapping_source ON data_mapping_configs(source_config_id);
CREATE INDEX ix_data_mapping_domain ON data_mapping_configs(domain);
CREATE INDEX ix_data_mapping_uid ON data_mapping_configs(external_uid);
```

### `sync_runs`

```sql
CREATE TABLE sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_config_id UUID NOT NULL REFERENCES data_source_configs(id),
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    domain VARCHAR(32) NOT NULL,
    records_fetched INTEGER NOT NULL DEFAULT 0,
    records_created INTEGER NOT NULL DEFAULT 0,
    records_updated INTEGER NOT NULL DEFAULT 0,
    records_skipped INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    high_watermark TIMESTAMPTZ,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    triggered_by_user_id UUID
);

CREATE INDEX ix_sync_runs_source ON sync_runs(source_config_id);
```

### Existing Table Additions

Add `dhis2_id` column to `coverage_facilities` for cross-reference:

```sql
ALTER TABLE coverage_facilities ADD COLUMN dhis2_id VARCHAR(16);
CREATE UNIQUE INDEX ix_coverage_dhis2_id ON coverage_facilities(dhis2_id) WHERE dhis2_id IS NOT NULL;
```

---

## 8. Demo Server Configuration

For the MVP demo, connect to the DHIS2 public demo server:

- **URL:** `https://play.dhis2.org/40.4.0`
- **Auth:** Basic Auth (`admin` / `district`)
- **Data:** Sierra Leone sample data (facilities, immunization, stock)

Seed a `DataSourceConfig` row:

```json
{
  "name": "DHIS2 Sierra Leone Demo",
  "source_type": "dhis2",
  "base_url": "https://play.dhis2.org/40.4.0",
  "encrypted_credentials": "<fernet-encrypted {'auth_type': 'basic', 'username': 'admin', 'password': 'district'}>",
  "enabled": true,
  "sync_cron": "0 2 * * *",
  "config": {
    "country_code": "SL",
    "org_unit_level": 4,
    "default_period_type": "MONTHLY"
  }
}
```

---

## 9. Security Considerations

1. **Credential encryption** — All credentials encrypted with Fernet. Key from `INTEGRATION_ENCRYPTION_KEY` env var.
2. **Principle of least privilege** — DHIS2 connector is read-only. Never writes back to DHIS2.
3. **Network isolation** — In production, DHIS2 sync runs from a worker process, not the API server.
4. **Audit trail** — Every sync execution recorded in `sync_runs` with timestamps, counts, and errors.
5. **Rate limiting** — Built-in request pacing (200 records/page, sequential pagination) to avoid overwhelming DHIS2 servers.

---

## 10. Dependencies on This Architecture

| Downstream Task | What They Need | Status |
|---|---|---|
| Backend Engineer: DHIS2 API Client + ETL | `ExternalDataSource` interface, `DHIS2Connector` skeleton, DB schema | **Ready** |
| Full-Stack Engineer: Admin UI | `DataSourceConfig` + `DataMappingConfig` models, API endpoints | **Ready** (models defined) |
| ML Engineer: Pipeline Update | Understanding of data granularity + quality characteristics | **Ready** (documented above) |
