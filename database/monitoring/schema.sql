-- =========================================
-- MONITORING DATABASE — screenhouse_monitoring (port 5433)
-- Bounded context: Ingest + Alerting + read-model tersinkron
--   screenhouse_registry + threshold_snapshots (sync dari App DB),
--   sensor_nodes (tray), sink_nodes (gateway+relay), sensor_data, actuator_logs, alerts
--
-- Jalankan dari root project:
--   psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/schema.sql
--
-- Catatan: screenhouse_registry & threshold_snapshots TIDAK punya FK ke App DB
-- (cross-database). Diisi via seed / `npm run sync:registry` / `npm run seed:map`.
-- =========================================

BEGIN;

-- ─── Read-model tersinkron dari App DB (screenhouse_app) ───
CREATE TABLE screenhouse_registry (
    screenhouse_id   INTEGER PRIMARY KEY,
    owner_user_id    INTEGER,
    screenhouse_name VARCHAR(255),
    status           VARCHAR(50) DEFAULT 'active',
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE threshold_snapshots (
    screenhouse_id       INTEGER PRIMARY KEY REFERENCES screenhouse_registry(screenhouse_id),
    min_nitrogen         INTEGER,
    max_nitrogen         INTEGER,
    min_phosphorus       INTEGER,
    max_phosphorus       INTEGER,
    min_potassium        INTEGER,
    max_potassium        INTEGER,
    min_soil_moisture    INTEGER,
    max_soil_moisture    INTEGER,
    min_soil_temperature NUMERIC(5,2),
    max_soil_temperature NUMERIC(5,2),
    min_soil_ph          NUMERIC(4,2),
    max_soil_ph          NUMERIC(4,2),
    min_conductivity     NUMERIC(10,2),
    max_conductivity     NUMERIC(10,2),
    min_air_temperature  NUMERIC(5,2),
    max_air_temperature  NUMERIC(5,2),
    min_air_humidity     NUMERIC(5,2),
    max_air_humidity     NUMERIC(5,2),
    min_light_intensity  NUMERIC(10,2),
    max_light_intensity  NUMERIC(10,2),
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── Sink node: 1 per screenhouse (gateway WSN + relay aktuator) ───
CREATE TABLE sink_nodes (
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

-- ─── Sensor node: 1 per tray bibit ───
CREATE TABLE sensor_nodes (
    id                    SERIAL PRIMARY KEY,
    screenhouse_id        INTEGER REFERENCES screenhouse_registry(screenhouse_id),
    node_code             VARCHAR(50) NOT NULL UNIQUE,
    node_name             VARCHAR(100),
    location              VARCHAR(255),
    send_interval_seconds INTEGER DEFAULT 60,
    is_active             BOOLEAN DEFAULT true,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sensor_data (
    id               SERIAL PRIMARY KEY,
    sensor_node_id   INTEGER REFERENCES sensor_nodes(id),
    sink_node_id     INTEGER REFERENCES sink_nodes(id),
    nitrogen         INTEGER,
    phosphorus       INTEGER,
    potassium        INTEGER,
    soil_temperature NUMERIC(5,2),
    soil_moisture    NUMERIC(5,2),
    soil_ph          NUMERIC(4,2),
    conductivity     NUMERIC(10,2),
    air_temperature  NUMERIC(5,2),
    air_humidity     NUMERIC(5,2),
    light_intensity  NUMERIC(10,2),
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sensor_data_node_created ON sensor_data (sensor_node_id, created_at DESC);
CREATE INDEX idx_sensor_data_sink_created ON sensor_data (sink_node_id, created_at DESC);

-- ─── Riwayat perubahan aktuator (per sink node) ───
CREATE TABLE actuator_logs (
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

CREATE INDEX idx_actuator_logs_sink_created ON actuator_logs (sink_node_id, created_at DESC);
CREATE INDEX idx_actuator_logs_screenhouse_created ON actuator_logs (screenhouse_id, created_at DESC);

-- ─── Alerting ───
CREATE TABLE alerts (
    id             SERIAL PRIMARY KEY,
    screenhouse_id INTEGER NOT NULL REFERENCES screenhouse_registry(screenhouse_id),
    sensor_node_id INTEGER REFERENCES sensor_nodes(id),
    sensor_data_id INTEGER REFERENCES sensor_data(id),
    message        TEXT NOT NULL,
    status         VARCHAR(50) DEFAULT 'active',
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Satu alert active per parameter + node (cegah notifikasi menumpuk antar siklus sensor)
CREATE UNIQUE INDEX idx_alerts_active_dedup
    ON alerts (screenhouse_id, sensor_node_id, message)
    WHERE status = 'active';

COMMIT;
