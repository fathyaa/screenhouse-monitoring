#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created load-test/.env from .env.example"
fi

echo "Checking MQTT broker…"
node -e "
const mqtt = require('mqtt');
const c = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883');
c.on('connect', () => { console.log('  MQTT OK'); c.end(); process.exit(0); });
c.on('error', () => { console.log('  Warning: MQTT broker not reachable'); process.exit(0); });
setTimeout(() => { console.log('  Warning: MQTT broker timeout'); process.exit(0); }, 3000);
" 2>/dev/null || echo "  Warning: MQTT broker not reachable — start docker compose first"

echo "Checking monitoring-service…"
curl -sf --max-time 3 "${MONITORING_URL:-http://localhost:3001}/" >/dev/null && echo "  Backend OK" || echo "  Warning: monitoring-service not reachable"

echo "Checking RabbitMQ management…"
curl -sf --max-time 3 -u "${RABBITMQ_USER:-screenhouse}:${RABBITMQ_PASSWORD:-screenhouse}" \
  "${RABBITMQ_MGMT_URL:-http://localhost:15672}/api/overview" >/dev/null \
  && echo "  RabbitMQ OK" || echo "  Warning: RabbitMQ mgmt not reachable"

echo "Prepare complete. Run: npm run seed:nodes && npm run run -- S1"
