-- Monitoring DB schema (screenhouse_monitoring)
-- Telemetry + alerting (no FK to App DB)

BEGIN;

CREATE TABLE IF NOT EXISTS screenhouse_registry (
    screenhouse_id INTEGER PRIMARY KEY,
    owner_user_id INTEGER,
    screenhouse_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS threshold_snapshots (
    screenhouse_id INTEGER PRIMARY KEY,
    min_nitrogen INTEGER,
    max_nitrogen INTEGER,
    min_phosphorus INTEGER,
    max_phosphorus INTEGER,
    min_potassium INTEGER,
    max_potassium INTEGER,
    min_soil_moisture INTEGER,
    max_soil_moisture INTEGER,
    min_soil_temperature NUMERIC(5,2),
    max_soil_temperature NUMERIC(5,2),
    min_soil_ph NUMERIC(4,2),
    max_soil_ph NUMERIC(4,2),
    min_conductivity NUMERIC(10,2),
    max_conductivity NUMERIC(10,2),
    min_air_temperature NUMERIC(5,2),
    max_air_temperature NUMERIC(5,2),
    min_air_humidity NUMERIC(5,2),
    max_air_humidity NUMERIC(5,2),
    min_light_intensity NUMERIC(10,2),
    max_light_intensity NUMERIC(10,2),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sensor_nodes (
    id SERIAL PRIMARY KEY,
    screenhouse_id INTEGER,
    node_code VARCHAR(50) NOT NULL UNIQUE,
    node_name VARCHAR(100),
    location VARCHAR(255),
    send_interval_seconds INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sensor_data (
    id SERIAL PRIMARY KEY,
    sensor_node_id INTEGER REFERENCES sensor_nodes(id),
    nitrogen INTEGER,
    phosphorus INTEGER,
    potassium INTEGER,
    soil_temperature NUMERIC(5,2),
    soil_moisture NUMERIC(5,2),
    soil_ph NUMERIC(4,2),
    conductivity NUMERIC(10,2),
    air_temperature NUMERIC(5,2),
    air_humidity NUMERIC(5,2),
    light_intensity NUMERIC(10,2),
    fan_status BOOLEAN DEFAULT FALSE,
    irrigation_status BOOLEAN DEFAULT FALSE,
    lamp_status BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sensor_data_node_created
    ON sensor_data (sensor_node_id, created_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    screenhouse_id INTEGER NOT NULL,
    sensor_node_id INTEGER REFERENCES sensor_nodes(id),
    sensor_data_id INTEGER REFERENCES sensor_data(id),
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
