#!/usr/bin/env bash
# Run database migrations via Flyway (Docker wrapper — no local Flyway install needed)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$(realpath "$SCRIPT_DIR/../migrations")"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-vaxai_vision}"
DB_USER="${DB_USER:-vaxai}"
DB_PASS="${DB_PASS:-vaxai_dev_password}"
FLYWAY_CMD="${1:-migrate}"   # migrate | info | validate | repair | baseline

echo "==> VaxAI Vision DB Migration — flyway $FLYWAY_CMD"
echo "    Host: $DB_HOST:$DB_PORT/$DB_NAME"

docker run --rm --network vaxai_network \
    -v "$MIGRATIONS_DIR:/flyway/sql" \
    flyway/flyway:10 \
    -url="jdbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}" \
    -user="$DB_USER" \
    -password="$DB_PASS" \
    -locations="filesystem:/flyway/sql" \
    -baselineOnMigrate=true \
    "$FLYWAY_CMD"
