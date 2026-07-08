-- =========================================
-- MONITORING DATABASE — DATA DEMO TAMBAHAN untuk Pak Eko (screenhouse_monitoring)
-- Registry + threshold snapshot + sink/sensor node + histori 24 jam + alert
-- lintas hari untuk screenhouse 93, 94, 95 (mirror App DB) — dipakai untuk uji:
--   - Notifikasi (pengelompokan per screenhouse + per hari, auto vs manual)
--   - Dashboard petani (verdict pill: campuran / sehat / semua auto-handled)
-- ID dipilih di atas MAX(id) yang sudah terpakai saat penulisan — TIDAK
-- menghapus/mengubah data yang sudah ada.
--
-- Jalankan SETELAH database/app/seed_pak_eko_demo.sql (screenhouse_id harus
-- sudah ada di App DB):
--   PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring \
--     -f database/monitoring/seed_pak_eko_demo.sql
-- =========================================

BEGIN;

-- ─── 1. Registry + threshold snapshot (mirror App DB screenhouse 93, 94, 95) ───
INSERT INTO screenhouse_registry (screenhouse_id, owner_user_id, screenhouse_name, status) VALUES
(93, 1, 'Screenhouse Cisaat Timur', 'active'),
(94, 1, 'Screenhouse Kadudampit Asri', 'active'),
(95, 1, 'Screenhouse Sukamanah Barat', 'active');

INSERT INTO threshold_snapshots (
    screenhouse_id,
    min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus,
    min_potassium, max_potassium, min_soil_moisture, max_soil_moisture,
    min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph,
    min_conductivity, max_conductivity, min_air_temperature, max_air_temperature,
    min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity
) VALUES
(93, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000),
(94, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000),
(95, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000);

-- ─── 2. Sink + sensor node (1 tray per screenhouse) ───
INSERT INTO sink_nodes (id, screenhouse_id, node_code, node_name, relay_channels, fan_status, irrigation_status, lamp_status, is_active) VALUES
(93, 93, 'SH93-SINK', 'Sink Node SH93', 3, false, false, false, true),
(94, 94, 'SH94-SINK', 'Sink Node SH94', 3, false, false, false, true),
(95, 95, 'SH95-SINK', 'Sink Node SH95', 3, false, false, false, true);

INSERT INTO sensor_nodes (id, screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active) VALUES
(93, 93, 'SH93-T01', 'Tray A1', 'Baris tengah', 60, true),
(94, 94, 'SH94-T01', 'Tray A1', 'Dekat pintu masuk', 60, true),
(95, 95, 'SH95-T01', 'Tray A1', 'Sudut timur', 60, true);

-- ─── 3. Histori sensor 24 jam (latar belakang grafik/tren/uptime) ───

-- 93 — nitrogen cenderung rendah sepanjang hari
INSERT INTO sensor_data (
    sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
    soil_temperature, soil_moisture, soil_ph, conductivity,
    air_temperature, air_humidity, light_intensity, created_at
)
SELECT
    93, 93,
    (14 + (h % 3))::int,
    (13 + (h % 4))::int,
    (17 + (h % 3))::int,
    ROUND((25.0 + 3.0 * SIN((h - 6) * PI() / 12))::numeric, 1),
    ROUND((60.0 + 6 * SIN(h * PI() / 10))::numeric, 1),
    ROUND((6.1 + 0.08 * SIN(h * PI() / 6))::numeric, 2),
    ROUND((410.0 + h * 3)::numeric, 1),
    ROUND((27.0 + 3.5 * SIN((h - 5) * PI() / 12))::numeric, 1),
    ROUND((70.0 + 8 * COS(h * PI() / 10))::numeric, 1),
    CASE
        WHEN EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) BETWEEN 6 AND 18
        THEN ROUND((8000 + EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) * 1200)::numeric, 0)
        ELSE ROUND(2500::numeric, 0)
    END,
    t.ts
FROM generate_series(23, 0, -1) AS h
CROSS JOIN LATERAL (SELECT (NOW() - (h || ' hours')::interval) AS ts) t;

-- 94 — semua parameter normal (sehat)
INSERT INTO sensor_data (
    sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
    soil_temperature, soil_moisture, soil_ph, conductivity,
    air_temperature, air_humidity, light_intensity, created_at
)
SELECT
    94, 94,
    (28 + (h % 6))::int,
    (16 + (h % 4))::int,
    (22 + (h % 5))::int,
    ROUND((26.0 + 2.5 * SIN(h * PI() / 12))::numeric, 1),
    ROUND((65.0 + 6 * SIN(h * PI() / 10))::numeric, 1),
    6.3,
    460,
    ROUND((27.0 + 2.5 * SIN(h * PI() / 9))::numeric, 1),
    ROUND((64.0 + 6 * COS(h * PI() / 9))::numeric, 1),
    CASE
        WHEN EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) BETWEEN 6 AND 18
        THEN ROUND((9000 + EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) * 1000)::numeric, 0)
        ELSE ROUND(2800::numeric, 0)
    END,
    t.ts
FROM generate_series(23, 0, -1) AS h
CROSS JOIN LATERAL (SELECT (NOW() - (h || ' hours')::interval) AS ts) t;

-- 95 — suhu & kelembapan udara cenderung tinggi siang hari
INSERT INTO sensor_data (
    sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
    soil_temperature, soil_moisture, soil_ph, conductivity,
    air_temperature, air_humidity, light_intensity, created_at
)
SELECT
    95, 95,
    (24 + (h % 5))::int,
    (15 + (h % 3))::int,
    (19 + (h % 4))::int,
    ROUND((26.5 + 3.0 * SIN((h - 4) * PI() / 12))::numeric, 1),
    ROUND((58.0 + 5 * SIN(h * PI() / 11))::numeric, 1),
    6.2,
    470,
    ROUND((30.0 + 4.5 * SIN((h - 3) * PI() / 12))::numeric, 1),
    ROUND((72.0 + 9 * COS(h * PI() / 9))::numeric, 1),
    CASE
        WHEN EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) BETWEEN 6 AND 18
        THEN ROUND((8500 + EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) * 1100)::numeric, 0)
        ELSE ROUND(2600::numeric, 0)
    END,
    t.ts
FROM generate_series(23, 0, -1) AS h
CROSS JOIN LATERAL (SELECT (NOW() - (h || ' hours')::interval) AS ts) t;

-- ─── 4. Reading + alert eksplisit (kemarin & hari ini) — uji grouping Notifikasi ───

-- 93 — kemarin: nitrogen rendah, sudah diselesaikan manual
WITH reading AS (
    INSERT INTO sensor_data (
        sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
        soil_temperature, soil_moisture, soil_ph, conductivity,
        air_temperature, air_humidity, light_intensity, created_at
    )
    VALUES (93, 93, 14, 15, 18, 25.5, 61.0, 6.1, 410, 27.0, 66.0, 9000, NOW() - INTERVAL '1 day 4 hours')
    RETURNING id, sensor_node_id
)
INSERT INTO alerts (sensor_data_id, screenhouse_id, sensor_node_id, message, status, created_at, resolved_at, resolve_note)
SELECT id, 93, sensor_node_id, 'Nitrogen di bawah batas minimum', 'resolved',
       NOW() - INTERVAL '1 day 4 hours', NOW() - INTERVAL '1 day 2 hours', 'Sudah ditambah pupuk urea'
FROM reading;

-- 93 — hari ini: nitrogen masih rendah, belum ditangani (butuh aksi manual)
WITH reading AS (
    INSERT INTO sensor_data (
        sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
        soil_temperature, soil_moisture, soil_ph, conductivity,
        air_temperature, air_humidity, light_intensity, created_at
    )
    VALUES (93, 93, 15, 14, 17, 25.8, 59.0, 6.1, 415, 27.5, 68.0, 9500, NOW() - INTERVAL '2 hours')
    RETURNING id, sensor_node_id
)
INSERT INTO alerts (sensor_data_id, screenhouse_id, sensor_node_id, message, status, created_at)
SELECT id, 93, sensor_node_id, 'Nitrogen di bawah batas minimum', 'active', NOW() - INTERVAL '2 hours'
FROM reading;

-- 93 — hari ini: kelembapan udara tinggi, ditangani otomatis oleh kipas
WITH reading AS (
    INSERT INTO sensor_data (
        sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
        soil_temperature, soil_moisture, soil_ph, conductivity,
        air_temperature, air_humidity, light_intensity, created_at
    )
    VALUES (93, 93, 28, 16, 20, 26.0, 63.0, 6.2, 420, 28.0, 91.0, 12000, NOW())
    RETURNING id, sensor_node_id
)
INSERT INTO alerts (sensor_data_id, screenhouse_id, sensor_node_id, message, status, created_at)
SELECT id, 93, sensor_node_id, 'Kelembapan udara melebihi batas maksimum', 'active', NOW()
FROM reading;

UPDATE sink_nodes SET fan_status = true, irrigation_status = false, lamp_status = false, updated_at = NOW()
WHERE node_code = 'SH93-SINK';

-- 94 — hari ini: reading normal, tanpa alert (sehat)
INSERT INTO sensor_data (
    sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
    soil_temperature, soil_moisture, soil_ph, conductivity,
    air_temperature, air_humidity, light_intensity, created_at
)
VALUES (94, 94, 32, 18, 24, 26.5, 66.0, 6.3, 460, 27.0, 63.0, 14000, NOW());

-- 95 — kemarin: suhu udara tinggi, sudah kembali normal otomatis
WITH reading AS (
    INSERT INTO sensor_data (
        sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
        soil_temperature, soil_moisture, soil_ph, conductivity,
        air_temperature, air_humidity, light_intensity, created_at
    )
    VALUES (95, 95, 26, 16, 21, 26.8, 57.0, 6.2, 470, 38.0, 88.0, 11000, NOW() - INTERVAL '1 day 6 hours')
    RETURNING id, sensor_node_id
)
INSERT INTO alerts (sensor_data_id, screenhouse_id, sensor_node_id, message, status, created_at, resolved_at)
SELECT id, 95, sensor_node_id, 'Suhu udara melebihi batas maksimum', 'resolved',
       NOW() - INTERVAL '1 day 6 hours', NOW() - INTERVAL '1 day 5 hours'
FROM reading;

-- 95 — hari ini: suhu & kelembapan udara sama-sama tinggi, keduanya auto-handled
WITH reading AS (
    INSERT INTO sensor_data (
        sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
        soil_temperature, soil_moisture, soil_ph, conductivity,
        air_temperature, air_humidity, light_intensity, created_at
    )
    VALUES (95, 95, 25, 15, 20, 27.0, 56.0, 6.2, 475, 39.0, 90.0, 13000, NOW())
    RETURNING id, sensor_node_id
)
INSERT INTO alerts (sensor_data_id, screenhouse_id, sensor_node_id, message, status, created_at)
SELECT id, 95, sensor_node_id, 'Suhu udara melebihi batas maksimum', 'active', NOW()
FROM reading;

WITH last_reading AS (
    SELECT sd.id, sd.sensor_node_id
    FROM sensor_data sd
    WHERE sd.sensor_node_id = 95
    ORDER BY sd.created_at DESC
    LIMIT 1
)
INSERT INTO alerts (sensor_data_id, screenhouse_id, sensor_node_id, message, status, created_at)
SELECT id, 95, sensor_node_id, 'Kelembapan udara melebihi batas maksimum', 'active', NOW()
FROM last_reading;

UPDATE sink_nodes SET fan_status = true, irrigation_status = false, lamp_status = false, updated_at = NOW()
WHERE node_code = 'SH95-SINK';

-- ─── 5. Reset sequences ───
SELECT setval('sink_nodes_id_seq',   (SELECT COALESCE(MAX(id), 1) FROM sink_nodes));
SELECT setval('sensor_nodes_id_seq', (SELECT COALESCE(MAX(id), 1) FROM sensor_nodes));
SELECT setval('sensor_data_id_seq',  (SELECT COALESCE(MAX(id), 1) FROM sensor_data));
SELECT setval('alerts_id_seq',       (SELECT COALESCE(MAX(id), 1) FROM alerts));

COMMIT;
