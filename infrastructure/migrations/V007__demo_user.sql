-- VAX-44: Demo account for zero-friction demo mode
-- Requires pgcrypto extension (should already be enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO users (email, full_name, hashed_password, role)
VALUES (
  'demo@vaxaivision.com',
  'Demo User',
  crypt('VaxAIDemo2026!', gen_salt('bf')),
  'viewer'
)
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name;
