-- Data historis 24 jam untuk grafik demo (di-include dari monitoring/seed.sql)
-- DB: screenhouse_monitoring

DELETE FROM alerts WHERE screenhouse_id IN (1, 2);
DELETE FROM sensor_data WHERE sensor_node_id IN (1, 2, 3);

-- Screenhouse 1 — Tray A1 (SH01-T01)
INSERT INTO sensor_data (
    sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
    soil_temperature, soil_moisture, soil_ph, conductivity,
    air_temperature, air_humidity, light_intensity, created_at
)
SELECT
    1, 1,
    GREATEST(18, LEAST(28, 24 - ((h - 12) * (h - 12)) / 20))::int,
    (13 + (h % 4))::int,
    (16 + (h % 3))::int,
    ROUND((25.0 + 3.5 * SIN((h - 6) * PI() / 12))::numeric, 1),
    CASE
        WHEN h BETWEEN 11 AND 15 THEN ROUND((54.0 - (h - 11) * 1.2)::numeric, 1)
        WHEN h BETWEEN 7 AND 9 THEN ROUND((72.0 + (9 - h) * 2.5)::numeric, 1)
        ELSE ROUND((66.0 + 4 * SIN(h * PI() / 8))::numeric, 1)
    END,
    ROUND((6.1 + 0.08 * SIN(h * PI() / 6))::numeric, 2),
    ROUND((420.0 + h * 8)::numeric, 1),
    ROUND((26.0 + 4.0 * SIN((h - 5) * PI() / 12))::numeric, 1),
    ROUND((62.0 + 8 * COS(h * PI() / 10))::numeric, 1),
    CASE WHEN h BETWEEN 6 AND 18 THEN ROUND((8000 + h * 1200)::numeric, 0) ELSE ROUND(2500::numeric, 0) END,
    NOW() - (h || ' hours')::interval
FROM generate_series(23, 0, -1) AS h;

-- Screenhouse 1 — Tray B1 (SH01-T02): sedikit lebih kering siang hari
INSERT INTO sensor_data (
    sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
    soil_temperature, soil_moisture, soil_ph, conductivity,
    air_temperature, air_humidity, light_intensity, created_at
)
SELECT
    2, 1,
    GREATEST(17, LEAST(26, 22 - ((h - 13) * (h - 13)) / 18))::int,
    (12 + (h % 5))::int,
    (15 + (h % 4))::int,
    ROUND((25.5 + 3.0 * SIN((h - 5) * PI() / 12))::numeric, 1),
    CASE
        WHEN h BETWEEN 12 AND 16 THEN ROUND((48.0 - (h - 12) * 1.5)::numeric, 1)
        WHEN h BETWEEN 8 AND 10 THEN ROUND((70.0 + (10 - h) * 2)::numeric, 1)
        ELSE ROUND((63.0 + 5 * SIN((h + 2) * PI() / 9))::numeric, 1)
    END,
    ROUND((6.0 + 0.1 * COS(h * PI() / 7))::numeric, 2),
    ROUND((400.0 + h * 7)::numeric, 1),
    ROUND((27.0 + 3.5 * SIN((h - 4) * PI() / 12))::numeric, 1),
    ROUND((60.0 + 9 * COS(h * PI() / 11))::numeric, 1),
    CASE WHEN h BETWEEN 7 AND 17 THEN ROUND((7500 + h * 1100)::numeric, 0) ELSE ROUND(2200::numeric, 0) END,
    NOW() - (h || ' hours')::interval - INTERVAL '15 minutes'
FROM generate_series(23, 0, -1) AS h;

-- Screenhouse 2 — Tray A1
INSERT INTO sensor_data (
    sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
    soil_temperature, soil_moisture, soil_ph, conductivity,
    air_temperature, air_humidity, light_intensity, created_at
)
SELECT
    3, 2,
    (21 + (h % 6))::int,
    (14 + (h % 3))::int,
    (17 + (h % 4))::int,
    ROUND((26.0 + 2.5 * SIN(h * PI() / 12))::numeric, 1),
    ROUND((64.0 + 6 * SIN(h * PI() / 10))::numeric, 1),
    6.25,
    455,
    ROUND((27.5 + 2 * SIN(h * PI() / 8))::numeric, 1),
    ROUND((65.0 + 5 * COS(h * PI() / 9))::numeric, 1),
    CASE WHEN h BETWEEN 8 AND 16 THEN 11000 + h * 800 ELSE 3000 END,
    NOW() - (h || ' hours')::interval
FROM generate_series(23, 0, -1) AS h;

-- Status aktuator demo di sink node SH01 (bukan per tray)
UPDATE sink_nodes SET
    fan_status = true,
    irrigation_status = false,
    lamp_status = false,
    updated_at = NOW()
WHERE id = 1;

INSERT INTO actuator_logs (sink_node_id, screenhouse_id, fan_status, irrigation_status, lamp_status, source)
VALUES (1, 1, true, false, false, 'seed');

INSERT INTO alerts (sensor_data_id, screenhouse_id, sensor_node_id, message, status)
SELECT id, 1, 2, 'Kelembapan tanah di bawah batas minimum', 'active'
FROM sensor_data
WHERE sensor_node_id = 2
  AND soil_moisture < 52
ORDER BY created_at DESC
LIMIT 1;
