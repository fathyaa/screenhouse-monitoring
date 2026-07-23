-- =========================================
-- MONITORING DATABASE — DATA DEMO SEBARAN (screenhouse_monitoring)
-- Pasangan dari database/app/seed_demo_bandung.sql untuk screenhouse 901–910.
-- Berisi: registry + threshold snapshot + sink/sensor node (tray) + histori sensor
-- 7 hari (hourly) + alert. Profil sensor dibuat agar skor kondisi menghasilkan:
--   - 901,902,903,904,906,907,908,910 : sehat  → estimasi on_track
--   - 905 : kondisi tanah kurang (N & kelembapan rendah) + suhu udara tinggi → terlambat + alert
--   - 909 : PERANGKAT OFFLINE (tidak ada data 2 hari terakhir) → perlu_evaluasi
--
-- screenhouse_id WAJIB sama dengan App DB. Node id / sensor_data id / alert id pakai
-- SERIAL (bebas tabrakan). Guard di bawah membatalkan seed jika registry 901–910 sudah ada.
--
-- Jalankan SETELAH database/app/seed_demo_bandung.sql:
--   PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring \
--     -f database/monitoring/seed_demo_bandung.sql
-- =========================================

BEGIN;

-- ─── Guard ───
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM screenhouse_registry WHERE screenhouse_id BETWEEN 901 AND 910) THEN
    RAISE EXCEPTION 'Registry 901-910 sudah terpakai. Sesuaikan blok id sebelum menjalankan seed ini.';
  END IF;
END $$;

-- ─── 1. Registry (mirror App DB: id, owner, nama) ───
INSERT INTO screenhouse_registry (screenhouse_id, owner_user_id, screenhouse_name, status) VALUES
(901, 901, 'Screenhouse Tani Makmur',     'active'),
(902, 901, 'Rumah Bibit Sukatani',        'active'),
(903, 901, 'Screenhouse Sri Rejeki',      'active'),
(904, 902, 'Screenhouse Mekar Sari',      'active'),
(905, 902, 'Rumah Bibit Karya Tani',      'active'),
(906, 903, 'Screenhouse Sumber Rejeki',   'active'),
(907, 903, 'Screenhouse Harapan Jaya',    'active'),
(908, 904, 'Rumah Bibit Barokah',         'active'),
(909, 904, 'Screenhouse Cahaya Tani',     'active'),
(910, 905, 'Screenhouse Mitra Sejahtera', 'active');

-- ─── 2. Threshold snapshot (sama untuk semua) ───
INSERT INTO threshold_snapshots (
    screenhouse_id,
    min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus,
    min_potassium, max_potassium, min_soil_moisture, max_soil_moisture,
    min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph,
    min_conductivity, max_conductivity, min_air_temperature, max_air_temperature,
    min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity
)
SELECT g, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0,
       200, 800, 22, 35, 40, 85, 5000, 50000
FROM generate_series(901, 910) g;

-- ─── 3. Sink node (1 gateway per screenhouse) ───
INSERT INTO sink_nodes (screenhouse_id, node_code, node_name, relay_channels, is_active)
SELECT g, 'SH' || g || '-SINK', 'Sink Node', 3, true
FROM generate_series(901, 910) g;

-- 905: kipas otomatis menyala (menangani suhu udara tinggi)
UPDATE sink_nodes SET fan_status = true WHERE node_code = 'SH905-SINK';

-- ─── 4. Sensor node (tray) — jumlah tray per screenhouse bervariasi ───
INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT p.sid,
       'SH' || p.sid || '-T0' || g,
       'Tray ' || (ARRAY['Utara','Selatan','Timur'])[g],
       (ARRAY['Baris depan','Baris tengah','Baris belakang'])[g],
       60, true
FROM (VALUES (901,2),(902,1),(903,3),(904,2),(905,2),(906,1),(907,2),(908,3),(909,1),(910,2)) p(sid,cnt)
CROSS JOIN LATERAL generate_series(1, p.cnt) g;

-- ─── 5. Histori sensor 7 hari (hourly) ───
-- Profil: healthy = nilai tengah rentang (skor 100); stress = N & kelembapan tanah rendah,
-- suhu udara tinggi; offline = hanya data 2–3 hari lalu (tidak ada data terbaru).
INSERT INTO sensor_data (
    sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
    soil_temperature, soil_moisture, soil_ph, conductivity,
    air_temperature, air_humidity, light_intensity, created_at
)
SELECT
    sn.id, sk.id,
    CASE k.kind WHEN 'stress' THEN 16 + (h % 2) ELSE 30 + (h % 3) END,
    18 + (h % 3),
    30 + (h % 4),
    ROUND((26.0 + 2.0 * SIN(h * PI() / 12))::numeric, 1),
    CASE k.kind WHEN 'stress'
        THEN ROUND((46.0 - (h % 2))::numeric, 1)
        ELSE ROUND((64.0 + 4 * SIN(h * PI() / 10))::numeric, 1) END,
    6.3,
    ROUND((450 + (h % 24) * 4)::numeric, 1),
    CASE k.kind WHEN 'stress'
        THEN ROUND((36.0 + 2 * SIN(h * PI() / 12))::numeric, 1)
        ELSE ROUND((27.0 + 3 * SIN(h * PI() / 12))::numeric, 1) END,
    CASE k.kind WHEN 'stress'
        THEN ROUND((88.0 + 2 * COS(h * PI() / 10))::numeric, 1)
        ELSE ROUND((65.0 + 6 * COS(h * PI() / 10))::numeric, 1) END,
    CASE
        WHEN EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) BETWEEN 6 AND 18
        THEN ROUND((9000 + EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) * 1200)::numeric, 0)
        ELSE ROUND(2600::numeric, 0)
    END,
    t.ts
FROM sensor_nodes sn
JOIN sink_nodes sk ON sk.screenhouse_id = sn.screenhouse_id
JOIN (VALUES
    (901,'healthy'),(902,'healthy'),(903,'healthy'),(904,'healthy'),(905,'stress'),
    (906,'healthy'),(907,'healthy'),(908,'healthy'),(909,'offline'),(910,'healthy')
) k(sid, kind) ON k.sid = sn.screenhouse_id
CROSS JOIN LATERAL generate_series(167, 0, -1) AS h
CROSS JOIN LATERAL (SELECT (NOW() - (h || ' hours')::interval) AS ts) t
WHERE sn.screenhouse_id BETWEEN 901 AND 910
  AND (k.kind <> 'offline' OR h BETWEEN 48 AND 72);   -- 909: hanya data 2–3 hari lalu

-- ─── 6. Alert (konsisten dengan data) ───
-- 905 — nitrogen rendah (butuh tindakan manual: tambah pupuk)
WITH r AS (
    SELECT sd.id, sd.sensor_node_id FROM sensor_data sd
    JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
    WHERE sn.screenhouse_id = 905 ORDER BY sd.created_at DESC LIMIT 1)
INSERT INTO alerts (screenhouse_id, sensor_node_id, sensor_data_id, message, status, created_at)
SELECT 905, sensor_node_id, id, 'Nitrogen di bawah batas minimum', 'active', NOW() - INTERVAL '3 hours' FROM r;

-- 905 — suhu udara tinggi (ditangani otomatis oleh kipas)
WITH r AS (
    SELECT sd.id, sd.sensor_node_id FROM sensor_data sd
    JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
    WHERE sn.screenhouse_id = 905 ORDER BY sd.created_at DESC LIMIT 1)
INSERT INTO alerts (screenhouse_id, sensor_node_id, sensor_data_id, message, status, created_at)
SELECT 905, sensor_node_id, id, 'Suhu udara melebihi batas maksimum', 'active', NOW() - INTERVAL '1 hour' FROM r;

-- 907 — kemarin nitrogen rendah, sudah diselesaikan manual
WITH r AS (
    SELECT sd.id, sd.sensor_node_id FROM sensor_data sd
    JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
    WHERE sn.screenhouse_id = 907 ORDER BY sd.created_at DESC LIMIT 1)
INSERT INTO alerts (screenhouse_id, sensor_node_id, sensor_data_id, message, status, created_at, resolved_at, resolve_note)
SELECT 907, sensor_node_id, id, 'Nitrogen di bawah batas minimum', 'resolved',
       NOW() - INTERVAL '1 day 5 hours', NOW() - INTERVAL '1 day 3 hours', 'Sudah ditambah pupuk urea' FROM r;

-- 904 — kemarin suhu udara tinggi, sudah kembali normal otomatis
WITH r AS (
    SELECT sd.id, sd.sensor_node_id FROM sensor_data sd
    JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
    WHERE sn.screenhouse_id = 904 ORDER BY sd.created_at DESC LIMIT 1)
INSERT INTO alerts (screenhouse_id, sensor_node_id, sensor_data_id, message, status, created_at, resolved_at)
SELECT 904, sensor_node_id, id, 'Suhu udara melebihi batas maksimum', 'resolved',
       NOW() - INTERVAL '1 day 8 hours', NOW() - INTERVAL '1 day 7 hours' FROM r;

-- ─── 7. Reset sequences ───
SELECT setval('sink_nodes_id_seq',   (SELECT MAX(id) FROM sink_nodes));
SELECT setval('sensor_nodes_id_seq', (SELECT MAX(id) FROM sensor_nodes));
SELECT setval('sensor_data_id_seq',  (SELECT MAX(id) FROM sensor_data));
SELECT setval('alerts_id_seq',       (SELECT MAX(id) FROM alerts));

COMMIT;
