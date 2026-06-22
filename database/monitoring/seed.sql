-- =========================================
-- MONITORING DATABASE — SEED DATA (screenhouse_monitoring)
-- Isi: registry + threshold 3 screenhouse, sink node, sensor node per tray
--       (sesuai tray_count di App DB: SH01=2, SH02=1, SH03=1),
--       histori sensor 24 jam + status peta demo (Sehat/Peringatan/Kritis).
--
-- Jalankan dari root project (setelah App DB seed + schema monitoring):
--   psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/seed.sql
-- =========================================

BEGIN;

-- ─── 1. Registry (mirror screenhouse inti dari App DB) ───
INSERT INTO screenhouse_registry (screenhouse_id, owner_user_id, screenhouse_name, status) VALUES
(1, 1, 'Screenhouse Sukabumi 01', 'active'),
(2, 1, 'Screenhouse Sukabumi 02', 'active'),
(3, 1, 'Screenhouse Kadudampit 01', 'active');

-- ─── 2. Threshold snapshots ───
INSERT INTO threshold_snapshots (
    screenhouse_id,
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
(1, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000),
(2, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000),
(3, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000);

-- ─── 3. Sink nodes (1 per screenhouse, gateway + relay) ───
INSERT INTO sink_nodes (
    id, screenhouse_id, node_code, node_name, relay_channels,
    fan_status, irrigation_status, lamp_status, is_active
) VALUES
(1, 1, 'SH01-SINK', 'Sink Node SH01', 3, false, false, false, true),
(2, 2, 'SH02-SINK', 'Sink Node SH02', 3, false, false, false, true),
(3, 3, 'SH03-SINK', 'Sink Node SH03', 3, false, false, false, true);

-- ─── 4. Sensor nodes (1 tray = 1 node, mirror tray_count App DB) ───
INSERT INTO sensor_nodes (
    id, screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active
) VALUES
(1, 1, 'SH01-T01', 'Tray A1', 'Baris 1 kolom A', 60, true),
(2, 1, 'SH01-T02', 'Tray B1', 'Baris 1 kolom B', 60, true),
(3, 2, 'SH02-T01', 'Tray A1', 'Pusat pembibitan', 60, true),
(4, 3, 'SH03-T01', 'Tray A1', 'Dekat jalan desa', 120, true);

-- ─── 5. Histori sensor 24 jam + alert demo + reading live peta ───
\ir data/seed_sensor_history.sql

-- ─── 6. Reset sequences ───
SELECT setval('sink_nodes_id_seq',     (SELECT COALESCE(MAX(id), 1) FROM sink_nodes));
SELECT setval('sensor_nodes_id_seq',   (SELECT COALESCE(MAX(id), 1) FROM sensor_nodes));
SELECT setval('sensor_data_id_seq',    (SELECT COALESCE(MAX(id), 1) FROM sensor_data));
SELECT setval('actuator_logs_id_seq',  (SELECT COALESCE(MAX(id), 1) FROM actuator_logs));
SELECT setval('alerts_id_seq',         (SELECT COALESCE(MAX(id), 1) FROM alerts));

COMMIT;
