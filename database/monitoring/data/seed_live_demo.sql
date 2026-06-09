-- =========================================
-- DEMO STATUS PETA — inject reading "live" (created_at = NOW())
-- supaya marker peta operator menampilkan beragam status:
--   SH01-N01 → 🟢 Sehat      (semua parameter dalam batas)
--   SH02-N01 → 🟠 Peringatan (kelembapan tanah di bawah min + alert aktif)
--   SH03-N01 → 🔴 Kritis     (suhu udara di atas max + alert aktif)
-- Screenhouse lain (data terakhir > 15 menit) tetap ⚪ Offline.
--
-- Jalankan dari root project:
--   PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres \
--     -d screenhouse_monitoring -f database/monitoring/data/seed_live_demo.sql
--
-- Catatan: status "online" hanya bertahan ~15 menit. Jalankan ulang kapan saja
-- untuk menyegarkan timestamp.
-- =========================================

BEGIN;

-- ─── 🟢 Screenhouse 1 — SEHAT ───
INSERT INTO sensor_data (
    sensor_node_id, nitrogen, phosphorus, potassium,
    soil_temperature, soil_moisture, soil_ph, conductivity,
    air_temperature, air_humidity, light_intensity,
    fan_status, irrigation_status, lamp_status, created_at
)
SELECT id, 30, 20, 30, 27.0, 65.0, 6.3, 450, 28.0, 70.0, 20000,
       true, false, false, NOW()
FROM sensor_nodes WHERE node_code = 'SH01-N01';

-- ─── 🟠 Screenhouse 2 — PERINGATAN (kelembapan tanah 35% < min 50%) + alert aktif ───
UPDATE alerts SET status = 'resolved'
WHERE status = 'active'
  AND screenhouse_id = (
    SELECT screenhouse_id FROM sensor_nodes WHERE node_code = 'SH02-N01'
  );

WITH node AS (
    SELECT id, screenhouse_id FROM sensor_nodes WHERE node_code = 'SH02-N01'
),
reading AS (
    INSERT INTO sensor_data (
        sensor_node_id, nitrogen, phosphorus, potassium,
        soil_temperature, soil_moisture, soil_ph, conductivity,
        air_temperature, air_humidity, light_intensity,
        fan_status, irrigation_status, lamp_status, created_at
    )
    SELECT id, 30, 20, 30, 27.0, 35.0, 6.3, 450, 29.0, 68.0, 18000,
           true, true, false, NOW()
    FROM node
    RETURNING id, sensor_node_id
)
INSERT INTO alerts (screenhouse_id, sensor_node_id, sensor_data_id, message, status, created_at)
SELECT n.screenhouse_id, r.sensor_node_id, r.id,
       'Kelembapan tanah di bawah batas minimum', 'active', NOW()
FROM reading r JOIN node n ON n.id = r.sensor_node_id;

-- ─── 🔴 Screenhouse 3 — KRITIS (suhu udara 41°C > max 35°C) + alert aktif ───
-- Bereskan alert demo lama dulu agar tidak menumpuk.
UPDATE alerts SET status = 'resolved'
WHERE status = 'active'
  AND screenhouse_id = (
    SELECT screenhouse_id FROM sensor_nodes WHERE node_code = 'SH03-N01'
  );

WITH node AS (
    SELECT id, screenhouse_id FROM sensor_nodes WHERE node_code = 'SH03-N01'
),
reading AS (
    INSERT INTO sensor_data (
        sensor_node_id, nitrogen, phosphorus, potassium,
        soil_temperature, soil_moisture, soil_ph, conductivity,
        air_temperature, air_humidity, light_intensity,
        fan_status, irrigation_status, lamp_status, created_at
    )
    SELECT id, 30, 20, 30, 27.0, 62.0, 6.3, 450, 41.0, 55.0, 22000,
           false, false, false, NOW()
    FROM node
    RETURNING id, sensor_node_id
)
INSERT INTO alerts (screenhouse_id, sensor_node_id, sensor_data_id, message, status, created_at)
SELECT n.screenhouse_id, r.sensor_node_id, r.id,
       'Suhu udara melebihi batas maksimum', 'active', NOW()
FROM reading r JOIN node n ON n.id = r.sensor_node_id;

COMMIT;

-- Ringkasan cepat hasil seed
SELECT sn.node_code,
       sd.soil_moisture,
       sd.air_temperature,
       sd.created_at
FROM sensor_data sd
JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
WHERE sn.node_code IN ('SH01-N01', 'SH02-N01', 'SH03-N01')
ORDER BY sn.node_code, sd.created_at DESC;
