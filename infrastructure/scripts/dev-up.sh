#!/usr/bin/env bash
# Start the local development data stack and run migrations
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(realpath "$SCRIPT_DIR/../docker")"

echo "==> Starting VaxAI Vision dev data stack..."
docker compose -f "$DOCKER_DIR/docker-compose.yml" up -d

echo "==> Waiting for PostgreSQL to be healthy..."
for i in {1..20}; do
    if docker compose -f "$DOCKER_DIR/docker-compose.yml" exec -T postgres \
        pg_isready -U vaxai -d vaxai_vision > /dev/null 2>&1; then
        echo "    PostgreSQL is ready."
        break
    fi
    echo "    Waiting... ($i/20)"
    sleep 3
done

echo "==> Running database migrations..."
bash "$SCRIPT_DIR/migrate.sh" migrate

echo ""
echo "✓ Dev stack is up."
echo ""
echo "  PostgreSQL:  postgresql://vaxai:vaxai_dev_password@localhost:5432/vaxai_vision"
echo "  Redis:       redis://:vaxai_redis_dev@localhost:6379"
echo "  LocalStack:  http://localhost:4566  (S3 endpoint)"
echo "  Adminer UI:  http://localhost:8080"
echo ""
echo "  Stop: bash scripts/dev-down.sh"
