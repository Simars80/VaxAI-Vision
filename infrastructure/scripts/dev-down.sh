#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(realpath "$SCRIPT_DIR/../docker")"
docker compose -f "$DOCKER_DIR/docker-compose.yml" down
echo "==> Dev stack stopped."
