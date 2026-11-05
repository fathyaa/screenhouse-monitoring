-- Screenhouse simulasi Smart Portable Screenhouse (SPS) untuk pengujian model
-- kolaborasi robot (Gazebo/ROS 2 + emulator sink node dari repo tesis).
-- id 90 dipilih agar tidak bentrok dengan seed demo; CEK `SELECT MAX(id) FROM screenhouses`
-- di DB yang sudah berisi data load-test dan ganti id bila perlu (juga di
-- database/monitoring/seed_sps_sim.sql, karena screenhouse_id disinkron manual).
BEGIN;
INSERT INTO screenhouses (
    id, name, province_id, regency_id, district_id, village_id,
    owner_user_id, address_detail, latitude, longitude, tray_count,
    seed_variety, seedling_start_date, status
) VALUES
(90, 'SPS Simulasi (4 kotak, robot)', 1, 1, 1, 1, 1,
 'Smart Portable Screenhouse 4 x 6 m — simulasi Gazebo', -6.9147, 107.6098, 4,
 'Inpari 32', CURRENT_DATE - INTERVAL '7 days', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO thresholds (
    screenhouse_id,
    min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus,
    min_potassium, max_potassium, min_soil_moisture, max_soil_moisture,
    min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph,
    min_conductivity, max_conductivity, min_air_temperature, max_air_temperature,
    min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity
)
SELECT 90, 20, 60, 10, 30, 15, 50, 60, 85, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 90, 5000, 50000
WHERE NOT EXISTS (SELECT 1 FROM thresholds WHERE screenhouse_id = 90);

SELECT setval('screenhouses_id_seq', GREATEST((SELECT MAX(id) FROM screenhouses), 1));
COMMIT;
