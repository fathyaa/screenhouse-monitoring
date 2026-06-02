-- =========================================
-- SCREENHOUSE MONITORING SYSTEM — SEED DATA
-- Model: screenhouses → sensor_nodes → sensor_data
--
-- Jalankan dari root project (fresh install):
--   psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/schema.sql
--   psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/seed.sql
--
-- Isi: user demo, 3 screenhouse inti, histori sensor 24 jam.
-- Wilayah lengkap + 30 screenhouse peta: jalankan import lalu seed_map (lihat README).
-- Password semua user demo: 123456
-- =========================================

BEGIN;

-- ─── 1. Wilayah minimal (FK screenhouse inti — dilengkapi import idn-area-data) ───
INSERT INTO provinces (id, name, kode) VALUES (1, 'Jawa Barat', '32');

INSERT INTO regencies (id, province_id, name, kode) VALUES
(1, 1, 'Kabupaten Sukabumi', '32.02');

INSERT INTO districts (id, regency_id, name) VALUES
(1, 1, 'Cisaat'),
(2, 1, 'Kadudampit');

INSERT INTO villages (id, district_id, name) VALUES
(1, 1, 'Babakan'),
(2, 1, 'Sukamanah'),
(3, 2, 'Gedepangrango');

-- ─── 2. User demo ───
INSERT INTO users (id, name, phone_number, password, role, status) VALUES
(1, 'Pak Eko', '081111111111', '$2b$10$CpSrK0m24PkChDP3crnSjuarCH3OFl9m2tr3f.fPmD7J7GO3c4biS', 'petani', 'approved'),
(2, 'Operator MCtan', '089999999999', '$2b$10$CpSrK0m24PkChDP3crnSjuarCH3OFl9m2tr3f.fPmD7J7GO3c4biS', 'operator', 'approved'),
(3, 'Super Admin', '088888888888', '$2b$10$CpSrK0m24PkChDP3crnSjuarCH3OFl9m2tr3f.fPmD7J7GO3c4biS', 'super_admin', 'approved');

-- ─── 3. Screenhouse inti (3) ───
INSERT INTO screenhouses (
    id, name, province_id, regency_id, district_id, village_id,
    owner_user_id, address_detail, latitude, longitude, status
) VALUES
(1, 'Screenhouse Sukabumi 01', 1, 1, 1, 1, 1, 'Dekat irigasi timur', -6.9175, 106.9287, 'active'),
(2, 'Screenhouse Sukabumi 02', 1, 1, 1, 2, 1, 'Area pembibitan selatan', -6.9200, 106.9310, 'active'),
(3, 'Screenhouse Kadudampit 01', 1, 1, 2, 3, 1, 'Dekat jalan desa', -6.8900, 106.9500, 'active');

INSERT INTO sensor_nodes (
    id, screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active
) VALUES
(1, 1, 'SH01-N01', 'Node Utara', 'Zona A — barat', 60, true),
(2, 1, 'SH01-N02', 'Node Selatan', 'Zona B — timur', 60, true),
(3, 2, 'SH02-N01', 'Node Utama', 'Pusat pembibitan', 60, true),
(4, 3, 'SH03-N01', 'Node Utama', 'Dekat jalan desa', 120, true);

INSERT INTO thresholds (
    id, screenhouse_id,
    min_nitrogen, max_nitrogen,
    min_phosphorus, max_phosphorus,
    min_potassium, max_potassium,
    min_soil_moisture, max_soil_moisture,
    min_soil_temperature, max_soil_temperature,
    min_soil_ph, max_soil_ph,
    min_conductivity, max_conductivity,
    min_air_temperature, max_air_temperature,
    min_air_humidity, max_air_humidity,
    min_light_intensity, max_light_intensity
) VALUES
(1, 1, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000),
(2, 2, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000),
(3, 3, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000);

SELECT setval('screenhouses_id_seq', (SELECT MAX(id) FROM screenhouses));
SELECT setval('sensor_nodes_id_seq', (SELECT MAX(id) FROM sensor_nodes));
SELECT setval('thresholds_id_seq', (SELECT MAX(id) FROM thresholds));

-- ─── 4. Histori sensor 24 jam (screenhouse 1 & 2) + alert ───
\ir data/seed_sensor_history.sql

SELECT setval('sensor_data_id_seq', (SELECT COALESCE(MAX(id), 1) FROM sensor_data));
SELECT setval('alerts_id_seq', (SELECT COALESCE(MAX(id), 1) FROM alerts));

-- Screenhouse peta (30 titik): jalankan SETELAH `npm run import`
--   psql ... -f database/data/seed_map_screenhouses.sql

-- ─── 6. Reset sequences ───
SELECT setval('provinces_id_seq', (SELECT COALESCE(MAX(id), 1) FROM provinces));
SELECT setval('regencies_id_seq', (SELECT COALESCE(MAX(id), 1) FROM regencies));
SELECT setval('districts_id_seq', (SELECT COALESCE(MAX(id), 1) FROM districts));
SELECT setval('villages_id_seq', (SELECT COALESCE(MAX(id), 1) FROM villages));
SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));
SELECT setval('screenhouses_id_seq', (SELECT COALESCE(MAX(id), 1) FROM screenhouses));
SELECT setval('sensor_nodes_id_seq', (SELECT COALESCE(MAX(id), 1) FROM sensor_nodes));
SELECT setval('sensor_data_id_seq', (SELECT COALESCE(MAX(id), 1) FROM sensor_data));
SELECT setval('thresholds_id_seq', (SELECT COALESCE(MAX(id), 1) FROM thresholds));
SELECT setval('alerts_id_seq', (SELECT COALESCE(MAX(id), 1) FROM alerts));

COMMIT;
