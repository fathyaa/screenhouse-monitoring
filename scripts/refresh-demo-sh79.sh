#!/usr/bin/env bash
# Segarkan data sensor screenhouse 79 (akun demo single-screenhouse: Wati Suhartini)
# ke waktu sekarang dengan nilai sehat, supaya node tetap "online" (ambang stale 15 menit).
# Pakai: bash scripts/refresh-demo-sh79.sh
set -euo pipefail

docker exec screenhouse-postgres-monitoring psql -U postgres -d screenhouse_monitoring -c "
INSERT INTO sensor_data
  (sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, created_at)
SELECT 79, 78,
  33 + (random()*4-2)::int,
  20 + (random()*4-2)::int,
  32 + (random()*4-2)::int,
  27.0 + (random()*1-0.5), 65.0 + (random()*4-2), 6.30 + (random()*0.2-0.1),
  500 + (random()*40-20), 28.0 + (random()*1-0.5), 62.0 + (random()*4-2),
  20000 + (random()*2000-1000),
  now() - (g * interval '2 minutes')
FROM generate_series(0, 4) AS g;
UPDATE sink_nodes SET updated_at = now() WHERE id = 78;
"
echo "OK — data sh79 disegarkan. Node online ±15 menit dari sekarang."
