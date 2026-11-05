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
    nutrient         NUMERIC(8,2),   -- kandungan nutrisi (WSN kolaborasi robot, field sn)
    uv_index         NUMERIC(6,2),   -- indeks UV (WSN kolaborasi robot, field uv)
    idemp_key        VARCHAR(160),   -- kunci idempotensi store-and-forward (opsional)
    -- Diisi dari timestamp payload perangkat bila valid, jika tidak fallback ke
    -- waktu terima server (CURRENT_TIMESTAMP). Lihat saveSensorReading.
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
    resolve_note   VARCHAR(255),
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at    TIMESTAMP WITH TIME ZONE
);

-- Satu alert active per parameter + node (cegah notifikasi menumpuk antar siklus sensor)
CREATE UNIQUE INDEX idx_alerts_active_dedup
    ON alerts (screenhouse_id, sensor_node_id, message)
    WHERE status = 'active';

-- =============================================================================
-- Bounded context kolaborasi robot (misi, status, hasil inspeksi, aktuasi lokal).
-- Isi sama dengan migrations_kolaborasi.sql (dipakai untuk DB yang sudah berjalan);
-- ditulis langsung di sini agar schema.sql bisa dijalankan dari stdin/docker exec.
-- =============================================================================
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS nutrient  NUMERIC(8,2);
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS uv_index  NUMERIC(6,2);
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS idemp_key VARCHAR(160);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sensor_data_idemp
    ON sensor_data (idemp_key) WHERE idemp_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS robot_missions (
    id              SERIAL PRIMARY KEY,
    mission_code    VARCHAR(64) NOT NULL UNIQUE,          -- m_id
    screenhouse_id  INTEGER REFERENCES screenhouse_registry(screenhouse_id),
    house_code      VARCHAR(32),                          -- h_id (prefix kode sink: <h_id>-SINK)
    robot_code      VARCHAR(32),                          -- r_id
    cmd             VARCHAR(32) DEFAULT 'INSPECT',
    trays           INTEGER[] NOT NULL DEFAULT '{}',
    crit_lvl        INTEGER DEFAULT 1,
    source          VARCHAR(20) DEFAULT 'mqtt',           -- api | mqtt (diterbitkan pihak lain)
    requested_by    INTEGER,                              -- user id (bila lewat API)
    status          VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    progress_pct    INTEGER DEFAULT 0,
    current_tray    INTEGER,
    battery         INTEGER,
    last_seq        INTEGER,
    issued_at       TIMESTAMP WITH TIME ZONE,
    accepted_at     TIMESTAMP WITH TIME ZONE,
    completed_at    TIMESTAMP WITH TIME ZONE,
    last_event_at   TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_robot_missions_sh_created
    ON robot_missions (screenhouse_id, created_at DESC);

CREATE TABLE IF NOT EXISTS robot_mission_events (
    id            SERIAL PRIMARY KEY,
    mission_id    INTEGER NOT NULL REFERENCES robot_missions(id) ON DELETE CASCADE,
    idemp_key     VARCHAR(160) NOT NULL UNIQUE,
    status        VARCHAR(20) NOT NULL,
    progress_pct  INTEGER,
    current_tray  INTEGER,
    battery       INTEGER,
    seq           INTEGER,
    event_ts      TIMESTAMP WITH TIME ZONE,               -- waktu kejadian di robot
    received_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mission_events_mission
    ON robot_mission_events (mission_id, seq);

CREATE TABLE IF NOT EXISTS tray_inspections (
    id               SERIAL PRIMARY KEY,
    mission_id       INTEGER NOT NULL REFERENCES robot_missions(id) ON DELETE CASCADE,
    screenhouse_id   INTEGER REFERENCES screenhouse_registry(screenhouse_id),
    sensor_node_id   INTEGER REFERENCES sensor_nodes(id),  -- node WSN tray yang sama (bila ada)
    tray_no          INTEGER NOT NULL,
    label            VARCHAR(20) NOT NULL,                 -- BAGUS | TIDAK_BAGUS
    confidence       NUMERIC(5,3),
    plant_height_cm  NUMERIC(6,2),
    anomaly          INTEGER DEFAULT 0,
    seq              INTEGER,
    idemp_key        VARCHAR(160) NOT NULL UNIQUE,
    event_ts         TIMESTAMP WITH TIME ZONE,
    received_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tray_inspections_sh_tray
    ON tray_inspections (screenhouse_id, tray_no, event_ts DESC);

CREATE TABLE IF NOT EXISTS actuation_events (
    id              SERIAL PRIMARY KEY,
    screenhouse_id  INTEGER REFERENCES screenhouse_registry(screenhouse_id),
    house_code      VARCHAR(32),
    actuator_code   VARCHAR(32) NOT NULL,                  -- act_id, mis. PUMP_3
    action          VARCHAR(8) NOT NULL,                   -- ON | OFF
    duration_s      INTEGER,
    trigger         VARCHAR(64),
    seq             INTEGER,
    idemp_key       VARCHAR(160) NOT NULL UNIQUE,
    event_ts        TIMESTAMP WITH TIME ZONE,
    received_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_actuation_events_sh
    ON actuation_events (screenhouse_id, event_ts DESC);

COMMIT;
