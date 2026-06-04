#!/usr/bin/env bash
# Setup 2 database dari root project: bash database/scripts/setup-databases.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PG_APP_HOST="${PG_APP_HOST:-localhost}"
PG_APP_PORT="${PG_APP_PORT:-5432}"
PG_MON_PORT="${PG_MON_PORT:-5433}"
PG_USER="${PG_USER:-postgres}"

echo "==> Create databases (ignore error if already exists)"
psql -h "$PG_APP_HOST" -p "$PG_APP_PORT" -U "$PG_USER" -c "CREATE DATABASE screenhouse_app;" 2>/dev/null || true
psql -h "$PG_APP_HOST" -p "$PG_MON_PORT" -U "$PG_USER" -c "CREATE DATABASE screenhouse_monitoring;" 2>/dev/null || true

echo "==> App DB"
psql -h "$PG_APP_HOST" -p "$PG_APP_PORT" -U "$PG_USER" -d screenhouse_app -f "$ROOT/database/app/schema.sql"
psql -h "$PG_APP_HOST" -p "$PG_APP_PORT" -U "$PG_USER" -d screenhouse_app -f "$ROOT/database/app/seed.sql"

echo "==> Monitoring DB"
psql -h "$PG_APP_HOST" -p "$PG_MON_PORT" -U "$PG_USER" -d screenhouse_monitoring -f "$ROOT/database/monitoring/schema.sql"
psql -h "$PG_APP_HOST" -p "$PG_MON_PORT" -U "$PG_USER" -d screenhouse_monitoring -f "$ROOT/database/monitoring/seed.sql"

echo "==> Done. Optional: cd database/scripts && npm run import (wilayah)"
