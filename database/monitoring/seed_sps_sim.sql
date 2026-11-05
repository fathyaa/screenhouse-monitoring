-- Pasangan database/app/seed_sps_sim.sql (screenhouse_id 90 harus sama di kedua DB).
-- Kode node mengikuti konvensi repo: sink <h_id>-SINK, tray <h_id>-Tnn. Simulasi
-- tesis memakai house_id "SH90" dan n_id "SH90-T01".."SH90-T04" (satu set WSN per kotak).
BEGIN;
INSERT INTO screenhouse_registry (screenhouse_id, owner_user_id, screenhouse_name, status)
VALUES (90, 1, 'SPS Simulasi (4 kotak, robot)', 'active')
ON CONFLICT (screenhouse_id) DO NOTHING;

INSERT INTO threshold_snapshots (
    screenhouse_id,
    min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus,
    min_potassium, max_potassium, min_soil_moisture, max_soil_moisture,
    min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph,
    min_conductivity, max_conductivity, min_air_temperature, max_air_temperature,
    min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity
) VALUES (90, 20, 60, 10, 30, 15, 50, 60, 85, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 90, 5000, 50000)
ON CONFLICT (screenhouse_id) DO NOTHING;

INSERT INTO sink_nodes (screenhouse_id, node_code, node_name, relay_channels, is_active)
VALUES (90, 'SH90-SINK', 'Sink Node FRDM-RW612 (SPS)', 4, true)
ON CONFLICT (node_code) DO NOTHING;

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
VALUES
(90, 'SH90-T01', 'Kotak 1 (WSN S1)', 'Kiri-bawah', 30, true),
(90, 'SH90-T02', 'Kotak 2 (WSN S2)', 'Kanan-bawah', 30, true),
(90, 'SH90-T03', 'Kotak 3 (WSN S3)', 'Kiri-atas', 30, true),
(90, 'SH90-T04', 'Kotak 4 (WSN S4)', 'Kanan-atas', 30, true)
ON CONFLICT (node_code) DO NOTHING;
COMMIT;
