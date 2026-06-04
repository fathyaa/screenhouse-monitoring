-- App DB schema (screenhouse_app)
-- Identity + catalog: users, wilayah, screenhouses, thresholds

BEGIN;

CREATE TABLE IF NOT EXISTS provinces (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    kode VARCHAR(2) UNIQUE
);

CREATE TABLE IF NOT EXISTS regencies (
    id SERIAL PRIMARY KEY,
    province_id INTEGER NOT NULL REFERENCES provinces(id),
    name VARCHAR(255) NOT NULL,
    kode VARCHAR(5) UNIQUE
);

CREATE TABLE IF NOT EXISTS districts (
    id SERIAL PRIMARY KEY,
    regency_id INTEGER NOT NULL REFERENCES regencies(id),
    name VARCHAR(255) NOT NULL,
    kode VARCHAR(8)
);

CREATE TABLE IF NOT EXISTS villages (
    id SERIAL PRIMARY KEY,
    district_id INTEGER NOT NULL REFERENCES districts(id),
    name VARCHAR(255) NOT NULL,
    kode VARCHAR(13) UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(30) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'petani',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS screenhouses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    province_id INTEGER NOT NULL REFERENCES provinces(id),
    regency_id INTEGER NOT NULL REFERENCES regencies(id),
    district_id INTEGER NOT NULL REFERENCES districts(id),
    village_id INTEGER NOT NULL REFERENCES villages(id),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    address_detail TEXT,
    owner_user_id INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS thresholds (
    id SERIAL PRIMARY KEY,
    screenhouse_id INTEGER NOT NULL UNIQUE REFERENCES screenhouses(id),
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
