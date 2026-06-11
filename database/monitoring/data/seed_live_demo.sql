-- =========================================
-- DEMO STATUS PETA — inject reading "live" (created_at = NOW())
--   SH01-T01 → Sehat
--   SH02-T01 → Peringatan
--   SH03-T01 → Kritis
--
-- Jalankan:
--   psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring \
--     -f database/monitoring/data/seed_live_demo.sql
-- =========================================

BEGIN;

-- Screenhouse 1 — SEHAT
INSERT INTO sensor_data (
    sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
    soil_temperature, soil_moisture, soil_ph, conductivity,
    air_temperature, air_humidity, light_intensity, created_at
)
SELECT sn.id, sk.id, 30, 20, 30, 27.0, 65.0, 6.3, 450, 28.0, 70.0, 20000, NOW()
FROM sensor_nodes sn
JOIN sink_nodes sk ON sk.screenhouse_id = sn.screenhouse_id
WHERE sn.node_code = 'SH01-T01';

UPDATE sink_nodes SET fan_status = true, irrigation_status = false, lamp_status = false, updated_at = NOW()
WHERE node_code = 'SH01-SINK';

-- Screenhouse 2 — PERINGATAN
UPDATE alerts SET status = 'resolved'
WHERE status = 'active'
  AND screenhouse_id = (SELECT screenhouse_id FROM sensor_nodes WHERE node_code = 'SH02-T01');

WITH node AS (
    SELECT sn.id AS sensor_node_id, sn.screenhouse_id, sk.id AS sink_node_id
    FROM sensor_nodes sn
    JOIN sink_nodes sk ON sk.screenhouse_id = sn.screenhouse_id
    WHERE sn.node_code = 'SH02-T01'
),
reading AS (
    INSERT INTO sensor_data (
        sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
        soil_temperature, soil_moisture, soil_ph, conductivity,
        air_temperature, air_humidity, light_intensity, created_at
    )
    SELECT sensor_node_id, sink_node_id, 30, 20, 30, 27.0, 35.0, 6.3, 450, 29.0, 68.0, 18000, NOW()
    FROM node
    RETURNING id, sensor_node_id
)
INSERT INTO alerts (screenhouse_id, sensor_node_id, sensor_data_id, message, status, created_at)
SELECT n.screenhouse_id, r.sensor_node_id, r.id,
       'Kelembapan tanah di bawah batas minimum', 'active', NOW()
FROM reading r JOIN node n ON n.sensor_node_id = r.sensor_node_id;

UPDATE sink_nodes SET fan_status = true, irrigation_status = true, lamp_status = false, updated_at = NOW()
WHERE node_code = 'SH02-SINK';

-- Screenhouse 3 — KRITIS
UPDATE alerts SET status = 'resolved'
WHERE status = 'active'
  AND screenhouse_id = (SELECT screenhouse_id FROM sensor_nodes WHERE node_code = 'SH03-T01');

WITH node AS (
    SELECT sn.id AS sensor_node_id, sn.screenhouse_id, sk.id AS sink_node_id
    FROM sensor_nodes sn
    JOIN sink_nodes sk ON sk.screenhouse_id = sn.screenhouse_id
    WHERE sn.node_code = 'SH03-T01'
),
reading AS (
    INSERT INTO sensor_data (
        sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
        soil_temperature, soil_moisture, soil_ph, conductivity,
        air_temperature, air_humidity, light_intensity, created_at
    )
    SELECT sensor_node_id, sink_node_id, 30, 20, 30, 27.0, 62.0, 6.3, 450, 41.0, 55.0, 22000, NOW()
    FROM node
    RETURNING id, sensor_node_id
)
INSERT INTO alerts (screenhouse_id, sensor_node_id, sensor_data_id, message, status, created_at)
SELECT n.screenhouse_id, r.sensor_node_id, r.id,
       'Suhu udara melebihi batas maksimum', 'active', NOW()
FROM reading r JOIN node n ON n.sensor_node_id = r.sensor_node_id;

UPDATE sink_nodes SET fan_status = false, irrigation_status = false, lamp_status = false, updated_at = NOW()
WHERE node_code = 'SH03-SINK';

COMMIT;

SELECT sn.node_code, sd.soil_moisture, sd.air_temperature, sd.created_at
FROM sensor_data sd
JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
WHERE sn.node_code IN ('SH01-T01', 'SH02-T01', 'SH03-T01')
ORDER BY sn.node_code, sd.created_at DESC;
