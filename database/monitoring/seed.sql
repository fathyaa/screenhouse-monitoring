-- Monitoring DB seed — registry, snapshots, nodes, sensor history
-- Jalankan SETELAH database/app/seed.sql (ID screenhouse harus sama)

BEGIN;

INSERT INTO screenhouse_registry (screenhouse_id, owner_user_id, screenhouse_name, status) VALUES
(1, 1, 'Screenhouse Sukabumi 01', 'active'),
(2, 1, 'Screenhouse Sukabumi 02', 'active'),
(3, 1, 'Screenhouse Kadudampit 01', 'active');

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

INSERT INTO sensor_nodes (
    id, screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active
) VALUES
(1, 1, 'SH01-N01', 'Node Utara', 'Zona A — barat', 60, true),
(2, 1, 'SH01-N02', 'Node Selatan', 'Zona B — timur', 60, true),
(3, 2, 'SH02-N01', 'Node Utama', 'Pusat pembibitan', 60, true),
(4, 3, 'SH03-N01', 'Node Utama', 'Dekat jalan desa', 120, true);

SELECT setval('sensor_nodes_id_seq', (SELECT MAX(id) FROM sensor_nodes));

\ir data/seed_sensor_history.sql

SELECT setval('sensor_data_id_seq', (SELECT COALESCE(MAX(id), 1) FROM sensor_data));
SELECT setval('alerts_id_seq', (SELECT COALESCE(MAX(id), 1) FROM alerts));

COMMIT;
