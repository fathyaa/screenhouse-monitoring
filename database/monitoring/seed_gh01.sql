-- ============================================================================
-- Seed screenhouse "GH01" — sisi DB monitoring (screenhouse_monitoring).
-- Pasangan wajib: database/app/seed_gh01.sql (screenhouse_id HARUS sama = 700).
--
-- Sink node = node_code '255' (nodeTarget di frame HiveMQ, katup irigasi valve1).
-- Sensor node TIDAK di-seed di sini: hivemqBridge auto-register saat frame
-- "parameter" pertama dari device masuk (nodeId device belum diketahui pasti).
-- Idempotent: aman dijalankan berulang.
-- ============================================================================

INSERT INTO screenhouse_registry (screenhouse_id, owner_user_id, screenhouse_name, status)
VALUES (700, 7, 'Screenhouse GH01 (HiveMQ)', 'active')
ON CONFLICT (screenhouse_id) DO NOTHING;

INSERT INTO threshold_snapshots (
  screenhouse_id,
  min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus,
  min_potassium, max_potassium, min_soil_moisture, max_soil_moisture,
  min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph,
  min_conductivity, max_conductivity, min_air_temperature, max_air_temperature,
  min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity,
  updated_at
) VALUES (
  700,
  20, 45, 12, 32,
  15, 52, 50, 82,
  20.00, 35.00, 5.50, 7.00,
  200.00, 800.00, 22.00, 35.00,
  40.00, 85.00, 5000.00, 50000.00,
  NOW()
)
ON CONFLICT (screenhouse_id) DO NOTHING;

-- Sink node 255 = destinasi kontrol aktuator (valve1 = irigasi tray 1, valve2 = tray 2).
INSERT INTO sink_nodes (screenhouse_id, node_code, node_name, relay_channels, fan_status, irrigation_status, lamp_status, is_active)
VALUES (700, '255', 'GH01 Sink (node 255)', 3, false, false, false, true)
ON CONFLICT (node_code) DO NOTHING;
