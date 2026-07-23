-- ============================================================================
-- Seed screenhouse "GH01" — perangkat sensor sungguhan via HiveMQ Cloud.
-- Pasangan wajib: database/monitoring/seed_gh01.sql (screenhouse_id HARUS sama).
--
-- screenhouse_id = 700 dipilih di atas MAX id load-test (642) di KEDUA DB.
-- owner_user_id  = 7  (Fathya Ariyani, role petani) — ganti bila perlu.
-- Idempotent: aman dijalankan berulang.
-- ============================================================================

INSERT INTO screenhouses (
  id, name, province_id, regency_id, district_id, village_id,
  latitude, longitude, status, owner_user_id, tray_count, seed_variety, varietas_id
) VALUES (
  700, 'Screenhouse GH01 (HiveMQ)', 1, 7, 52, 459,
  -6.9197, 106.9269, 'active', 7, 2, 'IR64', 2
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO thresholds (
  screenhouse_id,
  min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus,
  min_potassium, max_potassium, min_soil_moisture, max_soil_moisture,
  min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph,
  min_conductivity, max_conductivity, min_air_temperature, max_air_temperature,
  min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity,
  varietas_id
) VALUES (
  700,
  20, 45, 12, 32,
  15, 52, 50, 82,
  20.00, 35.00, 5.50, 7.00,
  200.00, 800.00, 22.00, 35.00,
  40.00, 85.00, 5000.00, 50000.00,
  2
)
ON CONFLICT (screenhouse_id) DO NOTHING;
