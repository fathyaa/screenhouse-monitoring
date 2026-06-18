-- =========================================
-- APP DATABASE — SEED DATA (screenhouse_app)
-- Isi: wilayah minimal, user demo, 3 screenhouse inti + thresholds.
--
-- Jalankan dari root project (setelah schema):
--   psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/seed.sql
--
-- Wilayah lengkap + 30+ screenhouse peta: jalankan `npm run import` lalu
-- `npm run seed:map` di database/scripts (lihat database/README.md).
-- Password semua user demo: 123456
-- =========================================

BEGIN;

-- ─── 1. Wilayah minimal (dilengkapi import idn-area-data) ───
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

-- ─── 2. User demo (password: 123456) ───
INSERT INTO users (id, name, phone_number, password, role, status) VALUES
(1, 'Pak Eko', '081111111111', '$2b$10$CpSrK0m24PkChDP3crnSjuarCH3OFl9m2tr3f.fPmD7J7GO3c4biS', 'petani', 'approved'),
(2, 'Operator', '089999999999', '$2b$10$CpSrK0m24PkChDP3crnSjuarCH3OFl9m2tr3f.fPmD7J7GO3c4biS', 'operator', 'approved'),
(3, 'Super Admin', '088888888888', '$2b$10$CpSrK0m24PkChDP3crnSjuarCH3OFl9m2tr3f.fPmD7J7GO3c4biS', 'super_admin', 'approved');

-- ─── 3. Screenhouse inti (3) + thresholds ───
INSERT INTO screenhouses (
    id, name, province_id, regency_id, district_id, village_id,
    owner_user_id, address_detail, latitude, longitude, tray_count, status
) VALUES
(1, 'Screenhouse Sukabumi 01', 1, 1, 1, 1, 1, 'Dekat irigasi timur', -6.9175, 106.9287, 2, 'active'),
(2, 'Screenhouse Sukabumi 02', 1, 1, 1, 2, 1, 'Area pembibitan selatan', -6.9200, 106.9310, 1, 'active'),
(3, 'Screenhouse Kadudampit 01', 1, 1, 2, 3, 1, 'Dekat jalan desa', -6.8900, 106.9500, 1, 'active');

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

-- ─── 4. Reset sequences ───
SELECT setval('provinces_id_seq',    (SELECT COALESCE(MAX(id), 1) FROM provinces));
SELECT setval('regencies_id_seq',    (SELECT COALESCE(MAX(id), 1) FROM regencies));
SELECT setval('districts_id_seq',    (SELECT COALESCE(MAX(id), 1) FROM districts));
SELECT setval('villages_id_seq',     (SELECT COALESCE(MAX(id), 1) FROM villages));
SELECT setval('users_id_seq',        (SELECT COALESCE(MAX(id), 1) FROM users));
SELECT setval('screenhouses_id_seq', (SELECT COALESCE(MAX(id), 1) FROM screenhouses));
SELECT setval('thresholds_id_seq',   (SELECT COALESCE(MAX(id), 1) FROM thresholds));

COMMIT;
