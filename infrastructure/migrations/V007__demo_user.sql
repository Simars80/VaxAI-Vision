-- VAX-32: Pre-loaded demo account
-- Requires pgcrypto extension (should already be enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO users (email, hashed_password, role)
VALUES (
  'demo@vaxaivision.com',
  crypt('VaxAIDemo2026!', gen_salt('bf')),
  'viewer'
)
ON CONFLICT DO NOTHING;
