-- Data historis 24 jam + reading live peta demo (di-include dari monitoring/seed.sql)
-- DB: screenhouse_monitoring

DELETE FROM alerts WHERE screenhouse_id IN (1, 2, 3);
DELETE FROM sensor_data WHERE sensor_node_id IN (
  SELECT id FROM sensor_nodes WHERE screenhouse_id IN (1, 2, 3)
);

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
    CASE
        WHEN EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) BETWEEN 6 AND 18
        THEN ROUND((8000 + EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) * 1200)::numeric, 0)
        ELSE ROUND(2500::numeric, 0)
    END,
    t.ts
FROM generate_series(23, 0, -1) AS h
CROSS JOIN LATERAL (
    SELECT (NOW() - (h || ' hours')::interval) AS ts
) t;

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
    CASE
        WHEN EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) BETWEEN 7 AND 17
        THEN ROUND((7500 + EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) * 1100)::numeric, 0)
        ELSE ROUND(2200::numeric, 0)
    END,
    t.ts
FROM generate_series(23, 0, -1) AS h
CROSS JOIN LATERAL (
    SELECT (NOW() - (h || ' hours')::interval - INTERVAL '15 minutes') AS ts
) t;

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
    CASE
        WHEN EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) BETWEEN 8 AND 16
        THEN ROUND((11000 + EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) * 800)::numeric, 0)
        ELSE ROUND(3000::numeric, 0)
    END,
    t.ts
FROM generate_series(23, 0, -1) AS h
CROSS JOIN LATERAL (
    SELECT (NOW() - (h || ' hours')::interval) AS ts
) t;

-- Status aktuator demo di sink node SH01 (bukan per tray)
UPDATE sink_nodes SET
    fan_status = true,
    irrigation_status = false,
    lamp_status = false,
    updated_at = NOW()
WHERE id = 1;

INSERT INTO actuator_logs (sink_node_id, screenhouse_id, fan_status, irrigation_status, lamp_status, source)
VALUES (1, 1, true, false, false, 'seed');

-- Screenhouse 3 — Tray A1 (SH03-T01)
INSERT INTO sensor_data (
    sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
    soil_temperature, soil_moisture, soil_ph, conductivity,
    air_temperature, air_humidity, light_intensity, created_at
)
SELECT
    sn.id, sk.id,
    (22 + (h % 5))::int,
    (13 + (h % 4))::int,
    (18 + (h % 3))::int,
    ROUND((25.5 + 3.0 * SIN((h - 7) * PI() / 12))::numeric, 1),
    ROUND((62.0 + 7 * SIN(h * PI() / 11))::numeric, 1),
    ROUND((6.15 + 0.09 * SIN(h * PI() / 8))::numeric, 2),
    ROUND((430.0 + h * 6)::numeric, 1),
    ROUND((26.5 + 3.5 * SIN((h - 6) * PI() / 12))::numeric, 1),
    ROUND((63.0 + 7 * COS(h * PI() / 10))::numeric, 1),
    CASE
        WHEN EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) BETWEEN 7 AND 17
        THEN ROUND((7800 + EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) * 1000)::numeric, 0)
        ELSE ROUND(2400::numeric, 0)
    END,
    t.ts
FROM generate_series(23, 0, -1) AS h
CROSS JOIN LATERAL (
    SELECT (NOW() - (h || ' hours')::interval) AS ts
) t
CROSS JOIN sensor_nodes sn
JOIN sink_nodes sk ON sk.screenhouse_id = sn.screenhouse_id
WHERE sn.node_code = 'SH03-T01';

INSERT INTO alerts (sensor_data_id, screenhouse_id, sensor_node_id, message, status)
SELECT sd.id, 1, sn.id, 'Kelembapan tanah di bawah batas minimum', 'active'
FROM sensor_data sd
JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
WHERE sn.node_code = 'SH01-T02'
  AND sd.soil_moisture < 52
ORDER BY sd.created_at DESC
LIMIT 1;

-- ─── Reading live untuk status peta operator (created_at = NOW()) ───
-- SH01-T01 → Sehat · SH02-T01 → Peringatan · SH03-T01 → Kritis

INSERT INTO sensor_data (
    sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
    soil_temperature, soil_moisture, soil_ph, conductivity,
    air_temperature, air_humidity, light_intensity, created_at
)
SELECT sn.id, sk.id, 30, 20, 30, 27.0, 65.0, 6.3, 450, 28.0, 70.0, 20000, NOW()
FROM sensor_nodes sn
JOIN sink_nodes sk ON sk.screenhouse_id = sn.screenhouse_id
WHERE sn.node_code = 'SH01-T01';

UPDATE sink_nodes SET fan_status = true, irrigation_status = false, lamp_status = false, updated_at = NOW()
WHERE node_code = 'SH01-SINK';

UPDATE alerts SET status = 'resolved'
WHERE status = 'active'
  AND screenhouse_id = (SELECT screenhouse_id FROM sensor_nodes WHERE node_code = 'SH02-T01');

WITH node AS (
    SELECT sn.id AS sensor_node_id, sn.screenhouse_id, sk.id AS sink_node_id
    FROM sensor_nodes sn
    JOIN sink_nodes sk ON sk.screenhouse_id = sn.screenhouse_id
    WHERE sn.node_code = 'SH02-T01'
),
reading AS (
    INSERT INTO sensor_data (
        sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
        soil_temperature, soil_moisture, soil_ph, conductivity,
        air_temperature, air_humidity, light_intensity, created_at
    )
    SELECT sensor_node_id, sink_node_id, 30, 20, 30, 27.0, 35.0, 6.3, 450, 29.0, 68.0, 18000, NOW()
    FROM node
    RETURNING id, sensor_node_id
)
INSERT INTO alerts (screenhouse_id, sensor_node_id, sensor_data_id, message, status, created_at)
SELECT n.screenhouse_id, r.sensor_node_id, r.id,
       'Kelembapan tanah di bawah batas minimum', 'active', NOW()
FROM reading r JOIN node n ON n.sensor_node_id = r.sensor_node_id;

UPDATE sink_nodes SET fan_status = true, irrigation_status = true, lamp_status = false, updated_at = NOW()
WHERE node_code = 'SH02-SINK';

UPDATE alerts SET status = 'resolved'
WHERE status = 'active'
  AND screenhouse_id = (SELECT screenhouse_id FROM sensor_nodes WHERE node_code = 'SH03-T01');

WITH node AS (
    SELECT sn.id AS sensor_node_id, sn.screenhouse_id, sk.id AS sink_node_id
    FROM sensor_nodes sn
    JOIN sink_nodes sk ON sk.screenhouse_id = sn.screenhouse_id
    WHERE sn.node_code = 'SH03-T01'
),
reading AS (
    INSERT INTO sensor_data (
        sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
        soil_temperature, soil_moisture, soil_ph, conductivity,
        air_temperature, air_humidity, light_intensity, created_at
    )
    SELECT sensor_node_id, sink_node_id, 30, 20, 30, 27.0, 62.0, 6.3, 450, 41.0, 55.0, 22000, NOW()
    FROM node
    RETURNING id, sensor_node_id
)
INSERT INTO alerts (screenhouse_id, sensor_node_id, sensor_data_id, message, status, created_at)
SELECT n.screenhouse_id, r.sensor_node_id, r.id,
       'Suhu udara melebihi batas maksimum', 'active', NOW()
FROM reading r JOIN node n ON n.sensor_node_id = r.sensor_node_id;

UPDATE sink_nodes SET fan_status = false, irrigation_status = false, lamp_status = false, updated_at = NOW()
WHERE node_code = 'SH03-SINK';
