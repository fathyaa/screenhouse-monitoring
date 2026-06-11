-- =========================================
-- MIGRATION 001 — Sink nodes + actuator logs
-- Pisahkan aktuator (relay/sink) dari data sensor per tray.
--
-- Jalankan pada DB monitoring yang SUDAH ADA (port 5433):
--   psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring \
--     -f database/monitoring/migrations/001_sink_nodes_actuators.sql
--
-- Aman dijalankan ulang: CREATE IF NOT EXISTS + IF NOT EXISTS pada kolom.
-- =========================================

BEGIN;

-- ─── 1. Sink node (1 per screenhouse, gateway + relay) ───
CREATE TABLE IF NOT EXISTS sink_nodes (
    id                SERIAL PRIMARY KEY,
    screenhouse_id    INTEGER NOT NULL UNIQUE REFERENCES screenhouse_registry(screenhouse_id),
    node_code         VARCHAR(50) NOT NULL UNIQUE,
    node_name         VARCHAR(100) DEFAULT 'Sink Node',
    relay_channels    INTEGER NOT NULL DEFAULT 3,
    fan_status        BOOLEAN DEFAULT false,
    irrigation_status BOOLEAN DEFAULT false,
    lamp_status       BOOLEAN DEFAULT false,
    is_active         BOOLEAN DEFAULT true,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── 2. Riwayat perubahan aktuator ───
CREATE TABLE IF NOT EXISTS actuator_logs (
    id                SERIAL PRIMARY KEY,
    sink_node_id      INTEGER NOT NULL REFERENCES sink_nodes(id),
    screenhouse_id    INTEGER NOT NULL REFERENCES screenhouse_registry(screenhouse_id),
    fan_status        BOOLEAN NOT NULL DEFAULT false,
    irrigation_status BOOLEAN NOT NULL DEFAULT false,
    lamp_status       BOOLEAN NOT NULL DEFAULT false,
    source            VARCHAR(20) DEFAULT 'manual',
    reason            TEXT,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_actuator_logs_sink_created
    ON actuator_logs (sink_node_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actuator_logs_screenhouse_created
    ON actuator_logs (screenhouse_id, created_at DESC);

-- ─── 3. Buat sink node untuk setiap screenhouse yang belum punya ───
INSERT INTO sink_nodes (screenhouse_id, node_code, node_name, relay_channels)
SELECT
    sr.screenhouse_id,
    'SH' || LPAD(sr.screenhouse_id::text, 2, '0') || '-SINK',
    'Sink Node',
    3
FROM screenhouse_registry sr
WHERE NOT EXISTS (
    SELECT 1 FROM sink_nodes sk WHERE sk.screenhouse_id = sr.screenhouse_id
);

-- ─── 4. Kolom sink_node_id di sensor_data (tray → lewat sink mana) ───
ALTER TABLE sensor_data
    ADD COLUMN IF NOT EXISTS sink_node_id INTEGER REFERENCES sink_nodes(id);

UPDATE sensor_data sd
SET sink_node_id = sk.id
FROM sensor_nodes sn
JOIN sink_nodes sk ON sk.screenhouse_id = sn.screenhouse_id
WHERE sd.sensor_node_id = sn.id
  AND sd.sink_node_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_sensor_data_sink_created
    ON sensor_data (sink_node_id, created_at DESC);

-- ─── 5. Migrasi status aktuator terakhir dari sensor_data → sink_nodes ───
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sensor_data' AND column_name = 'fan_status'
    ) THEN
        UPDATE sink_nodes sk
        SET
            fan_status = COALESCE(sub.fan_status, false),
            irrigation_status = COALESCE(sub.irrigation_status, false),
            lamp_status = COALESCE(sub.lamp_status, false),
            updated_at = NOW()
        FROM (
            SELECT DISTINCT ON (sn.screenhouse_id)
                sn.screenhouse_id,
                sd.fan_status,
                sd.irrigation_status,
                sd.lamp_status
            FROM sensor_data sd
            JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
            ORDER BY sn.screenhouse_id, sd.created_at DESC
        ) sub
        WHERE sk.screenhouse_id = sub.screenhouse_id;

        -- Seed log awal dari state sink saat migrasi
        INSERT INTO actuator_logs (
            sink_node_id, screenhouse_id,
            fan_status, irrigation_status, lamp_status, source
        )
        SELECT
            sk.id, sk.screenhouse_id,
            sk.fan_status, sk.irrigation_status, sk.lamp_status,
            'migration'
        FROM sink_nodes sk
        WHERE NOT EXISTS (
            SELECT 1 FROM actuator_logs al WHERE al.sink_node_id = sk.id
        );

        ALTER TABLE sensor_data DROP COLUMN fan_status;
        ALTER TABLE sensor_data DROP COLUMN irrigation_status;
        ALTER TABLE sensor_data DROP COLUMN lamp_status;
    END IF;
END $$;

COMMIT;
