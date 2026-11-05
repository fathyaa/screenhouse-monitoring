-- =============================================================================
-- Migrasi: bounded context KOLABORASI ROBOT (Monitoring DB)
--
-- Menampung data dari model kolaborasi robot–sistem monitoring melalui sink node
-- (proposal tesis Irfan Fahmi Ahmadi, Tabel 3.3):
--   telemetry/env    -> sensor_data (kolom baru nutrient, uv_index, idemp_key)
--   mission/command  -> robot_missions          (misi yang diterbitkan)
--   mission/status   -> robot_mission_events    (riwayat status) + ringkasan di robot_missions
--   mission/result   -> tray_inspections        (hasil penilaian mutu bibit per tray/kotak)
--   actuator/control -> actuation_events        (aktuasi lokal sink node, mis. pompa per kotak)
--
-- Setiap pesan membawa kunci idempotensi (house_id + mission_id/node_id + seq). Kolom
-- idemp_key ber-UNIQUE sehingga replay store-and-forward dari sink node tidak
-- menimbulkan duplikasi baris (INSERT ... ON CONFLICT DO NOTHING).
--
-- Aman dijalankan berulang (IF NOT EXISTS). Untuk instalasi baru, schema.sql sudah
-- memuat definisi yang sama.
-- =============================================================================
BEGIN;

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
