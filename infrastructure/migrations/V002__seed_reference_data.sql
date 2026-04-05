-- VaxAI Vision — Seed Reference Data
-- Migration: V002
-- Description: Seed initial vaccine catalog and demo country data

INSERT INTO countries (iso2, iso3, name, region) VALUES
    ('NG', 'NGA', 'Nigeria',        'Sub-Saharan Africa'),
    ('KE', 'KEN', 'Kenya',          'Sub-Saharan Africa'),
    ('GH', 'GHA', 'Ghana',          'Sub-Saharan Africa'),
    ('ET', 'ETH', 'Ethiopia',       'Sub-Saharan Africa'),
    ('ZA', 'ZAF', 'South Africa',   'Sub-Saharan Africa'),
    ('IN', 'IND', 'India',          'South Asia'),
    ('BD', 'BGD', 'Bangladesh',     'South Asia')
ON CONFLICT (iso2) DO NOTHING;

INSERT INTO vaccines (name, short_name, manufacturer, doses_per_vial, cold_chain_temp, shelf_life_days) VALUES
    ('Oral Polio Vaccine bivalent',             'bOPV',     'Various',          20, -20, 730),
    ('Pentavalent DTP-HepB-Hib',                'PENTA',    'Various',          10,   2, 730),
    ('Pneumococcal Conjugate Vaccine 13v',       'PCV13',    'Pfizer',            4,   2, 730),
    ('Rotavirus Vaccine (monovalent)',           'RV1',      'GSK',               1,   2, 365),
    ('Measles-Rubella',                          'MR',       'Various',          10,   2, 730),
    ('Inactivated Polio Vaccine',                'IPV',      'Various',          10,   2, 730),
    ('Human Papillomavirus Vaccine',             'HPV',      'MSD / GSK',         1,   2, 730),
    ('Yellow Fever',                             'YF',       'Various',          10,   2, 730),
    ('Meningococcal A Conjugate',                'MenA',     'Serum Inst.',      10,   2, 730),
    ('COVID-19 mRNA',                            'COVID19',  'Various',           6,  -20, 180)
ON CONFLICT DO NOTHING;
