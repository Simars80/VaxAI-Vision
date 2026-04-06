-- VaxAI Vision — Demo Seed: Nigerian & Kenyan Facility Vaccine Transactions
-- Migration: V006
-- Description: Seeds realistic supply transactions for 6 facilities (3 Nigeria, 3 Kenya)
--              covering bOPV, PENTA, PCV13, and ROTA vaccines with 12+ months of history.
--              Designed to give the forecasting model sufficient history for demo predictions.

-- ─── Admin Areas ──────────────────────────────────────────────────────────────
-- Level-1 states/counties for Nigeria and Kenya

INSERT INTO admin_areas (id, country_id, parent_id, level, code, name)
SELECT gen.id, c.id, NULL, 1, gen.code, gen.name
FROM (
    VALUES
        ('aa000001-0000-0000-0000-000000000001'::uuid, 'NG-LA', 'Lagos State'),
        ('aa000001-0000-0000-0000-000000000002'::uuid, 'NG-KN', 'Kano State'),
        ('aa000001-0000-0000-0000-000000000003'::uuid, 'NG-FC', 'Federal Capital Territory'),
        ('aa000001-0000-0000-0000-000000000004'::uuid, 'KE-047', 'Nairobi County'),
        ('aa000001-0000-0000-0000-000000000005'::uuid, 'KE-001', 'Mombasa County'),
        ('aa000001-0000-0000-0000-000000000006'::uuid, 'KE-042', 'Kisumu County')
) AS gen(id, code, name)
JOIN countries c ON (
    (c.iso2 = 'NG' AND gen.code LIKE 'NG-%') OR
    (c.iso2 = 'KE' AND gen.code LIKE 'KE-%')
)
ON CONFLICT (country_id, code) DO NOTHING;

-- ─── Health Facilities ────────────────────────────────────────────────────────

INSERT INTO facilities (id, admin_area_id, external_id, name, type, latitude, longitude, catchment_pop, is_active)
VALUES
    -- Nigeria
    (
        'fa000001-0000-0000-0000-000000000001'::uuid,
        'aa000001-0000-0000-0000-000000000001'::uuid,
        'NG-FAC-LAG-001',
        'Lagos State Primary Healthcare Development Agency Store',
        'regional_store',
        6.4550, 3.3841,
        4500000,
        TRUE
    ),
    (
        'fa000001-0000-0000-0000-000000000002'::uuid,
        'aa000001-0000-0000-0000-000000000001'::uuid,
        'NG-FAC-LAG-002',
        'Mainland General Hospital — PHC Immunisation Unit',
        'health_facility',
        6.4698, 3.3903,
        180000,
        TRUE
    ),
    (
        'fa000001-0000-0000-0000-000000000003'::uuid,
        'aa000001-0000-0000-0000-000000000002'::uuid,
        'NG-FAC-KAN-001',
        'Kano State PHC Management Board Supply Store',
        'district_store',
        11.9964, 8.5122,
        2800000,
        TRUE
    ),
    -- Kenya
    (
        'fa000001-0000-0000-0000-000000000004'::uuid,
        'aa000001-0000-0000-0000-000000000004'::uuid,
        'KE-FAC-NBI-001',
        'Nairobi City County Health Services Vaccines Store',
        'regional_store',
        -1.2921, 36.8219,
        4400000,
        TRUE
    ),
    (
        'fa000001-0000-0000-0000-000000000005'::uuid,
        'aa000001-0000-0000-0000-000000000005'::uuid,
        'KE-FAC-MSA-001',
        'Mombasa County Referral Hospital — Immunisation Dept',
        'health_facility',
        -4.0435, 39.6682,
        220000,
        TRUE
    ),
    (
        'fa000001-0000-0000-0000-000000000006'::uuid,
        'aa000001-0000-0000-0000-000000000006'::uuid,
        'KE-FAC-KSM-001',
        'Kisumu County Teaching & Referral Hospital — Vaccines',
        'health_facility',
        -0.0917, 34.7680,
        130000,
        TRUE
    )
ON CONFLICT DO NOTHING;

-- ─── Supply Items (vaccine catalogue for supply_transactions) ─────────────────
-- These mirror the vaccines table but serve the operational ingestion pipeline.

INSERT INTO supply_items (id, external_code, name, description, category, unit_of_measure, min_temp_celsius, max_temp_celsius)
VALUES
    (
        'si000001-0000-0000-0000-000000000001'::uuid,
        'bOPV',
        'Oral Polio Vaccine bivalent (bOPV)',
        'Bivalent oral polio vaccine (type 1 and 3). EPI routine schedule: 0, 6, 10, 14 weeks.',
        'vaccine',
        'dose',
        -25, -15
    ),
    (
        'si000001-0000-0000-0000-000000000002'::uuid,
        'PENTA',
        'Pentavalent DTP-HepB-Hib (PENTA)',
        'Combined diphtheria, tetanus, pertussis, hepatitis B, and Hib vaccine. 10 doses/vial.',
        'vaccine',
        'dose',
        2, 8
    ),
    (
        'si000001-0000-0000-0000-000000000003'::uuid,
        'PCV13',
        'Pneumococcal Conjugate Vaccine 13-valent (PCV13)',
        'Protects against 13 strains of Streptococcus pneumoniae. 4 doses/vial.',
        'vaccine',
        'dose',
        2, 8
    ),
    (
        'si000001-0000-0000-0000-000000000004'::uuid,
        'RV1',
        'Rotavirus Vaccine Monovalent (RV1 / ROTA)',
        'Live attenuated human rotavirus vaccine. Single-dose vial. EPI schedule: 6 and 10 weeks.',
        'vaccine',
        'dose',
        2, 8
    )
ON CONFLICT DO NOTHING;

-- ─── Supply Transactions: 13 months Apr 2025 – Apr 2026 ──────────────────────
-- Each month generates:
--   1. Receipt  (1st of month)  — delivery to facility from national/regional store
--   2. Issue    (15th of month) — distribution to beneficiaries / sub-stores
--   3. Wastage  (last day)      — open-vial and cold-chain wastage (~3–5 % of issued)
--
-- Monthly base volumes (doses) by facility × vaccine:
--
--   Facility                         | bOPV   | PENTA  | PCV13  | ROTA
--   ---------------------------------|--------|--------|--------|------
--   Lagos PHCDA Store  (regional)    | 82000  | 48000  | 26000  | 32000
--   Mainland Gen Hosp  (facility)    | 14000  |  8500  |  4800  |  5500
--   Kano PHC Board     (district)    | 38000  | 22000  | 13000  | 16000
--   Nairobi CC Store   (regional)    | 65000  | 38000  | 21000  | 27000
--   Mombasa Referral   (facility)    | 19000  | 11500  |  6500  |  8000
--   Kisumu Referral    (facility)    |  9000  |  5500  |  3200  |  4200
--
-- Seasonal multipliers simulate campaign peaks (Q2: Apr-Jun +15%, Q3: Jul-Sep +5%,
-- Q4: Oct-Dec -5%, Q1: Jan-Mar = baseline) applied to both receipt and issue quantities.

WITH
-- All 13 month start dates
months AS (
    SELECT generate_series(
        '2025-04-01'::date,
        '2026-04-01'::date,
        '1 month'::interval
    )::date AS month_start
),

-- Seasonal multiplier per month
month_meta AS (
    SELECT
        month_start,
        month_start + INTERVAL '14 days' AS issue_date,
        (month_start + INTERVAL '1 month' - INTERVAL '1 day')::date AS last_day,
        CASE EXTRACT(MONTH FROM month_start)
            WHEN  4 THEN 1.15  WHEN  5 THEN 1.18  WHEN  6 THEN 1.12
            WHEN  7 THEN 1.06  WHEN  8 THEN 1.08  WHEN  9 THEN 1.05
            WHEN 10 THEN 0.97  WHEN 11 THEN 0.95  WHEN 12 THEN 0.93
            WHEN  1 THEN 1.00  WHEN  2 THEN 1.02  WHEN  3 THEN 1.04
            ELSE 1.0
        END AS seasonal_mult
    FROM months
),

-- Facility × vaccine base volumes
fac_vax_base (facility_id, supply_item_id, base_receipt, lot_prefix) AS (
    VALUES
        -- Lagos PHCDA regional store
        ('fa000001-0000-0000-0000-000000000001'::uuid,'si000001-0000-0000-0000-000000000001'::uuid, 82000.0, 'LG-bOPV'),
        ('fa000001-0000-0000-0000-000000000001'::uuid,'si000001-0000-0000-0000-000000000002'::uuid, 48000.0, 'LG-PEN'),
        ('fa000001-0000-0000-0000-000000000001'::uuid,'si000001-0000-0000-0000-000000000003'::uuid, 26000.0, 'LG-PCV'),
        ('fa000001-0000-0000-0000-000000000001'::uuid,'si000001-0000-0000-0000-000000000004'::uuid, 32000.0, 'LG-RV1'),
        -- Mainland General Hospital
        ('fa000001-0000-0000-0000-000000000002'::uuid,'si000001-0000-0000-0000-000000000001'::uuid, 14000.0, 'MG-bOPV'),
        ('fa000001-0000-0000-0000-000000000002'::uuid,'si000001-0000-0000-0000-000000000002'::uuid,  8500.0, 'MG-PEN'),
        ('fa000001-0000-0000-0000-000000000002'::uuid,'si000001-0000-0000-0000-000000000003'::uuid,  4800.0, 'MG-PCV'),
        ('fa000001-0000-0000-0000-000000000002'::uuid,'si000001-0000-0000-0000-000000000004'::uuid,  5500.0, 'MG-RV1'),
        -- Kano PHC Management Board
        ('fa000001-0000-0000-0000-000000000003'::uuid,'si000001-0000-0000-0000-000000000001'::uuid, 38000.0, 'KN-bOPV'),
        ('fa000001-0000-0000-0000-000000000003'::uuid,'si000001-0000-0000-0000-000000000002'::uuid, 22000.0, 'KN-PEN'),
        ('fa000001-0000-0000-0000-000000000003'::uuid,'si000001-0000-0000-0000-000000000003'::uuid, 13000.0, 'KN-PCV'),
        ('fa000001-0000-0000-0000-000000000003'::uuid,'si000001-0000-0000-0000-000000000004'::uuid, 16000.0, 'KN-RV1'),
        -- Nairobi City County Store
        ('fa000001-0000-0000-0000-000000000004'::uuid,'si000001-0000-0000-0000-000000000001'::uuid, 65000.0, 'NB-bOPV'),
        ('fa000001-0000-0000-0000-000000000004'::uuid,'si000001-0000-0000-0000-000000000002'::uuid, 38000.0, 'NB-PEN'),
        ('fa000001-0000-0000-0000-000000000004'::uuid,'si000001-0000-0000-0000-000000000003'::uuid, 21000.0, 'NB-PCV'),
        ('fa000001-0000-0000-0000-000000000004'::uuid,'si000001-0000-0000-0000-000000000004'::uuid, 27000.0, 'NB-RV1'),
        -- Mombasa County Referral
        ('fa000001-0000-0000-0000-000000000005'::uuid,'si000001-0000-0000-0000-000000000001'::uuid, 19000.0, 'MB-bOPV'),
        ('fa000001-0000-0000-0000-000000000005'::uuid,'si000001-0000-0000-0000-000000000002'::uuid, 11500.0, 'MB-PEN'),
        ('fa000001-0000-0000-0000-000000000005'::uuid,'si000001-0000-0000-0000-000000000003'::uuid,  6500.0, 'MB-PCV'),
        ('fa000001-0000-0000-0000-000000000005'::uuid,'si000001-0000-0000-0000-000000000004'::uuid,  8000.0, 'MB-RV1'),
        -- Kisumu County Referral
        ('fa000001-0000-0000-0000-000000000006'::uuid,'si000001-0000-0000-0000-000000000001'::uuid,  9000.0, 'KS-bOPV'),
        ('fa000001-0000-0000-0000-000000000006'::uuid,'si000001-0000-0000-0000-000000000002'::uuid,  5500.0, 'KS-PEN'),
        ('fa000001-0000-0000-0000-000000000006'::uuid,'si000001-0000-0000-0000-000000000003'::uuid,  3200.0, 'KS-PCV'),
        ('fa000001-0000-0000-0000-000000000006'::uuid,'si000001-0000-0000-0000-000000000004'::uuid,  4200.0, 'KS-RV1')
),

-- Facility display names for denormalization
fac_names (facility_id, facility_name, facility_ext_id) AS (
    VALUES
        ('fa000001-0000-0000-0000-000000000001'::uuid, 'Lagos State PHCDA Store',           'NG-FAC-LAG-001'),
        ('fa000001-0000-0000-0000-000000000002'::uuid, 'Mainland General Hospital PHC',      'NG-FAC-LAG-002'),
        ('fa000001-0000-0000-0000-000000000003'::uuid, 'Kano State PHC Mgmt Board Store',    'NG-FAC-KAN-001'),
        ('fa000001-0000-0000-0000-000000000004'::uuid, 'Nairobi CC Health Services Store',   'KE-FAC-NBI-001'),
        ('fa000001-0000-0000-0000-000000000005'::uuid, 'Mombasa County Referral Hospital',   'KE-FAC-MSA-001'),
        ('fa000001-0000-0000-0000-000000000006'::uuid, 'Kisumu County Teaching & Referral',  'KE-FAC-KSM-001')
),

-- Combined: receipt quantity per facility/vaccine/month with seasonal adjustment
-- A small deterministic variance is applied via row number to avoid flat lines
receipts_base AS (
    SELECT
        fv.facility_id,
        fv.supply_item_id,
        fv.lot_prefix,
        m.month_start,
        m.issue_date,
        m.last_day,
        m.seasonal_mult,
        ROUND(fv.base_receipt * m.seasonal_mult
            -- +/- 8% pseudo-variance using modular arithmetic on row index
            * (1.0 + 0.08 * SIN(EXTRACT(MONTH FROM m.month_start) + EXTRACT(DOW FROM m.month_start)))
        )::integer AS receipt_qty,
        fn.facility_name,
        fn.facility_ext_id
    FROM fac_vax_base fv
    CROSS JOIN month_meta m
    JOIN fac_names fn ON fn.facility_id = fv.facility_id
),

-- Issue quantity = 94–97% of receipt (leaves a small buffer stock)
all_transactions AS (

    -- RECEIPTS (transaction_type = 'receipt')
    SELECT
        gen_random_uuid()                       AS id,
        supply_item_id,
        'receipt'                               AS transaction_type,
        receipt_qty::double precision           AS quantity,
        'dose'                                  AS unit_of_measure,
        facility_ext_id                         AS facility_id,
        facility_name,
        (month_start || ' 08:00:00+00')::timestamptz AS transaction_date,
        lot_prefix || '-' || TO_CHAR(month_start, 'YYMM') || '-A' AS lot_number,
        (month_start + INTERVAL '18 months')::timestamptz AS expiry_date,
        NULL::uuid                              AS source_job_id,
        jsonb_build_object(
            'source', 'demo_seed',
            'country', CASE WHEN facility_ext_id LIKE 'NG-%' THEN 'NG' ELSE 'KE' END,
            'campaign_month', TO_CHAR(month_start, 'YYYY-MM')
        )                                       AS extra
    FROM receipts_base

    UNION ALL

    -- ISSUES (transaction_type = 'issue') — 15th of month
    SELECT
        gen_random_uuid(),
        supply_item_id,
        'issue',
        -- Issues = 94–97% of receipt; varies with seasonal multiplier
        ROUND(receipt_qty * (0.94 + 0.03 * seasonal_mult / 1.18))::double precision,
        'dose',
        facility_ext_id,
        facility_name,
        (issue_date || ' 09:00:00+00')::timestamptz,
        lot_prefix || '-' || TO_CHAR(month_start, 'YYMM') || '-A',
        (month_start + INTERVAL '18 months')::timestamptz,
        NULL::uuid,
        jsonb_build_object(
            'source', 'demo_seed',
            'country', CASE WHEN facility_ext_id LIKE 'NG-%' THEN 'NG' ELSE 'KE' END,
            'issue_type', 'routine_distribution'
        )
    FROM receipts_base

    UNION ALL

    -- WASTAGE (transaction_type = 'wastage') — last day of month
    -- ~3–5% of issued doses; only every second month (open-vial wastage)
    SELECT
        gen_random_uuid(),
        supply_item_id,
        'wastage',
        GREATEST(
            10,
            ROUND(receipt_qty * 0.035
                -- higher wastage for facilities using multi-dose vials in warm months
                * (1 + 0.5 * GREATEST(0, seasonal_mult - 1.0))
            )::double precision
        ),
        'dose',
        facility_ext_id,
        facility_name,
        (last_day || ' 16:00:00+00')::timestamptz,
        lot_prefix || '-' || TO_CHAR(month_start, 'YYMM') || '-A',
        (month_start + INTERVAL '18 months')::timestamptz,
        NULL::uuid,
        jsonb_build_object(
            'source', 'demo_seed',
            'country', CASE WHEN facility_ext_id LIKE 'NG-%' THEN 'NG' ELSE 'KE' END,
            'wastage_reason', 'open_vial'
        )
    FROM receipts_base
    -- Wastage recorded every other month (months 1,3,5,7,9,11,13 of the series)
    WHERE EXTRACT(MONTH FROM month_start)::integer % 2 = 0
)

INSERT INTO supply_transactions (
    id,
    supply_item_id,
    transaction_type,
    quantity,
    unit_of_measure,
    facility_id,
    facility_name,
    transaction_date,
    lot_number,
    expiry_date,
    source_job_id,
    extra
)
SELECT
    id,
    supply_item_id,
    transaction_type,
    quantity,
    unit_of_measure,
    facility_id,
    facility_name,
    transaction_date,
    lot_number,
    expiry_date,
    source_job_id,
    extra
FROM all_transactions
ORDER BY transaction_date, facility_id, supply_item_id;


-- ─── Inventory Snapshots (end-of-month stock levels) ─────────────────────────
-- Snapshot = prior_snapshot + receipts - issues - wastage for the month
-- Bootstrapped from a realistic opening stock (2 months of supply at April 2025)

WITH
months AS (
    SELECT generate_series(
        '2025-04-30'::date,
        '2026-04-30'::date,
        '1 month'::interval
    )::date AS snap_date
),

-- Reference: vaccines and facilities from the seeded tables
v_ids AS (
    SELECT id AS vaccine_id, short_name
    FROM vaccines
    WHERE short_name IN ('bOPV', 'PENTA', 'PCV13', 'RV1')
),

f_ids AS (
    SELECT id AS facility_id, external_id
    FROM facilities
    WHERE external_id IN (
        'NG-FAC-LAG-001','NG-FAC-LAG-002','NG-FAC-KAN-001',
        'KE-FAC-NBI-001','KE-FAC-MSA-001','KE-FAC-KSM-001'
    )
),

-- Base stock per facility × vaccine (two months' supply as opening balance)
base_stock (ext_id, vax_short, opening_doses) AS (
    VALUES
        ('NG-FAC-LAG-001','bOPV',  164000),
        ('NG-FAC-LAG-001','PENTA',  96000),
        ('NG-FAC-LAG-001','PCV13',  52000),
        ('NG-FAC-LAG-001','RV1',    64000),
        ('NG-FAC-LAG-002','bOPV',   28000),
        ('NG-FAC-LAG-002','PENTA',  17000),
        ('NG-FAC-LAG-002','PCV13',   9600),
        ('NG-FAC-LAG-002','RV1',    11000),
        ('NG-FAC-KAN-001','bOPV',   76000),
        ('NG-FAC-KAN-001','PENTA',  44000),
        ('NG-FAC-KAN-001','PCV13',  26000),
        ('NG-FAC-KAN-001','RV1',    32000),
        ('KE-FAC-NBI-001','bOPV',  130000),
        ('KE-FAC-NBI-001','PENTA',  76000),
        ('KE-FAC-NBI-001','PCV13',  42000),
        ('KE-FAC-NBI-001','RV1',    54000),
        ('KE-FAC-MSA-001','bOPV',   38000),
        ('KE-FAC-MSA-001','PENTA',  23000),
        ('KE-FAC-MSA-001','PCV13',  13000),
        ('KE-FAC-MSA-001','RV1',    16000),
        ('KE-FAC-KSM-001','bOPV',   18000),
        ('KE-FAC-KSM-001','PENTA',  11000),
        ('KE-FAC-KSM-001','PCV13',   6400),
        ('KE-FAC-KSM-001','RV1',     8400)
),

seasonal_mult (snap_date, mult) AS (
    SELECT
        s.snap_date,
        CASE EXTRACT(MONTH FROM s.snap_date)
            WHEN  4 THEN 1.15  WHEN  5 THEN 1.18  WHEN  6 THEN 1.12
            WHEN  7 THEN 1.06  WHEN  8 THEN 1.08  WHEN  9 THEN 1.05
            WHEN 10 THEN 0.97  WHEN 11 THEN 0.95  WHEN 12 THEN 0.93
            WHEN  1 THEN 1.00  WHEN  2 THEN 1.02  WHEN  3 THEN 1.04
            ELSE 1.0
        END
    FROM months s
),

-- Approximate end-of-month quantity: opening + cumulative net (receipt - issue - wastage)
-- Simplified: stock oscillates around ~2 months of supply with monthly net +/- buffer
snapshots_raw AS (
    SELECT
        f.facility_id,
        v.vaccine_id,
        m.snap_date,
        -- running stock approximation: opening + small net accumulation/depletion
        GREATEST(
            500,
            ROUND(
                bs.opening_doses
                + bs.opening_doses * 0.05
                    * (EXTRACT(MONTH FROM m.snap_date) - 4 + 1)  -- slow build through year
                - bs.opening_doses * 0.08 * sm.mult               -- seasonal usage draw-down
            )
        )::integer AS quantity_doses,
        CASE
            WHEN ROUND(bs.opening_doses * 0.05 * (EXTRACT(MONTH FROM m.snap_date) - 4 + 1)
                       - bs.opening_doses * 0.08 * sm.mult) > 0 THEN 'adequate'
            WHEN ROUND(bs.opening_doses * 0.05 * (EXTRACT(MONTH FROM m.snap_date) - 4 + 1)
                       - bs.opening_doses * 0.08 * sm.mult) > -bs.opening_doses * 0.1 THEN 'low'
            ELSE 'critical'
        END::supply_status AS status
    FROM base_stock bs
    JOIN f_ids f ON f.external_id = bs.ext_id
    JOIN v_ids v ON v.short_name = bs.vax_short
    CROSS JOIN months m
    JOIN seasonal_mult sm ON sm.snap_date = m.snap_date
)

INSERT INTO inventory_snapshots (
    facility_id,
    vaccine_id,
    snapshot_date,
    quantity_doses,
    quantity_vials,
    status,
    source
)
SELECT
    facility_id,
    vaccine_id,
    snap_date,
    quantity_doses,
    NULL,   -- vials not tracked at this level
    status,
    'demo_seed'
FROM snapshots_raw
ON CONFLICT DO NOTHING;
