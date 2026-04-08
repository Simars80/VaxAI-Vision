-- VaxAI Vision — Coverage Facilities
-- Migration: V008
-- Description: Creates coverage_facilities table and seeds 19 pilot facilities
--              from the hardcoded FACILITIES array in CoverageMapPage.tsx

CREATE TABLE coverage_facilities (
    id                  TEXT         PRIMARY KEY,
    name                TEXT         NOT NULL,
    country             TEXT         NOT NULL,
    region              TEXT         NOT NULL,
    lat                 DOUBLE PRECISION NOT NULL,
    lng                 DOUBLE PRECISION NOT NULL,
    coverage_rate       DOUBLE PRECISION NOT NULL,
    stock_status        TEXT         NOT NULL CHECK (stock_status IN ('adequate', 'low', 'critical')),
    vaccine_type        TEXT         NOT NULL,
    period              TEXT         NOT NULL,
    doses_administered  INTEGER      NOT NULL,
    target_population   INTEGER      NOT NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coverage_facilities_country      ON coverage_facilities(country);
CREATE INDEX idx_coverage_facilities_vaccine_type ON coverage_facilities(vaccine_type);
CREATE INDEX idx_coverage_facilities_stock_status ON coverage_facilities(stock_status);

-- ── Seed: 19 pilot facilities ──────────────────────────────────────────────────

INSERT INTO coverage_facilities
    (id, name, country, region, lat, lng, coverage_rate, stock_status, vaccine_type, period, doses_administered, target_population)
VALUES
    ('ng-1', 'Lagos Central Clinic',        'Nigeria',   'Lagos',          6.524,   3.379,  87, 'adequate', 'OPV', '2024-Q4', 4320, 4965),
    ('ng-2', 'Kano District Hospital',       'Nigeria',   'Kano',          12.000,   8.517,  52, 'low',      'DTP', '2024-Q4', 1980, 3808),
    ('ng-3', 'Abuja PHC Centre',             'Nigeria',   'FCT',            9.076,   7.399,  74, 'adequate', 'BCG', '2024-Q4', 2960, 4000),
    ('ng-4', 'Ibadan Health Post',           'Nigeria',   'Oyo',            7.388,   3.896,  38, 'critical', 'OPV', '2024-Q4',  760, 2000),
    ('ng-5', 'Kaduna Rural Clinic',          'Nigeria',   'Kaduna',        10.524,   7.441,  61, 'low',      'MCV', '2024-Q4', 1525, 2500),
    ('ke-1', 'Nairobi Immunization Hub',     'Kenya',     'Nairobi',       -1.286,  36.817,  91, 'adequate', 'DTP', '2024-Q4', 9100, 10000),
    ('ke-2', 'Mombasa Port Clinic',          'Kenya',     'Mombasa',       -4.043,  39.668,  78, 'adequate', 'OPV', '2024-Q4', 3900, 5000),
    ('ke-3', 'Kisumu District Health',       'Kenya',     'Kisumu',        -0.102,  34.762,  45, 'critical', 'BCG', '2024-Q4', 1350, 3000),
    ('ke-4', 'Nakuru County Hospital',       'Kenya',     'Nakuru',        -0.302,  36.066,  83, 'adequate', 'MCV', '2024-Q4', 2490, 3000),
    ('et-1', 'Addis Ababa Health Centre',    'Ethiopia',  'Addis Ababa',    9.032,  38.740,  69, 'low',      'DTP', '2024-Q4', 6900, 10000),
    ('et-2', 'Dire Dawa PHC',               'Ethiopia',  'Dire Dawa',      9.590,  41.861,  42, 'critical', 'OPV', '2024-Q4', 1260, 3000),
    ('et-3', 'Bahir Dar District Clinic',    'Ethiopia',  'Amhara',        11.593,  37.390,  56, 'low',      'BCG', '2024-Q4', 2800, 5000),
    ('gh-1', 'Accra Central Hospital',       'Ghana',     'Greater Accra',  5.556,  -0.197,  88, 'adequate', 'MCV', '2024-Q4', 4400, 5000),
    ('gh-2', 'Kumasi Health Post',           'Ghana',     'Ashanti',        6.688,  -1.624,  71, 'adequate', 'DTP', '2024-Q4', 2840, 4000),
    ('gh-3', 'Tamale PHC',                  'Ghana',     'Northern',       9.403,  -0.839,  33, 'critical', 'OPV', '2024-Q4',  990, 3000),
    ('ug-1', 'Kampala City Clinic',          'Uganda',    'Central',        0.347,  32.582,  80, 'adequate', 'BCG', '2024-Q4', 4000, 5000),
    ('ug-2', 'Gulu District Hospital',       'Uganda',    'Northern',       2.779,  32.299,  49, 'critical', 'DTP', '2024-Q4', 1470, 3000),
    ('tz-1', 'Dar es Salaam Hub',           'Tanzania',  'Dar es Salaam',  -6.792,  39.208,  85, 'adequate', 'MCV', '2024-Q4', 8500, 10000),
    ('tz-2', 'Dodoma Central Clinic',        'Tanzania',  'Dodoma',        -6.173,  35.739,  60, 'low',      'OPV', '2024-Q4', 1800, 3000);

-- ── Updated-at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_coverage_facilities_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_coverage_facilities_updated_at
    BEFORE UPDATE ON coverage_facilities
    FOR EACH ROW EXECUTE FUNCTION set_coverage_facilities_updated_at();
