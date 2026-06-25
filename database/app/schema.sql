-- =========================================
-- APP DATABASE — screenhouse_app (port 5434)
-- Bounded context: Identity + Catalog
--   users, wilayah (provinces/regencies/districts/villages),
--   screenhouses (tray_count), thresholds, push_subscriptions
--
-- Jalankan dari root project:
--   psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/schema.sql
-- =========================================

BEGIN;

-- ─── Wilayah (idn-area-data) ───
CREATE TABLE provinces (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(255) NOT NULL,
    kode  VARCHAR(2) UNIQUE
);

CREATE TABLE regencies (
    id           SERIAL PRIMARY KEY,
    province_id  INTEGER NOT NULL REFERENCES provinces(id),
    name         VARCHAR(255) NOT NULL,
    kode         VARCHAR(5) UNIQUE
);

CREATE TABLE districts (
    id          SERIAL PRIMARY KEY,
    regency_id  INTEGER NOT NULL REFERENCES regencies(id),
    name        VARCHAR(255) NOT NULL,
    kode        VARCHAR(8) UNIQUE
);

CREATE TABLE villages (
    id           SERIAL PRIMARY KEY,
    district_id  INTEGER NOT NULL REFERENCES districts(id),
    name         VARCHAR(255) NOT NULL,
    kode         VARCHAR(13) UNIQUE
);

-- ─── Identity ───
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    phone_number  VARCHAR(30) NOT NULL UNIQUE,
    password      TEXT NOT NULL,
    role          VARCHAR(50) NOT NULL DEFAULT 'petani',
    status        VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Catalog ───
CREATE TABLE screenhouses (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    province_id    INTEGER NOT NULL REFERENCES provinces(id),
    regency_id     INTEGER NOT NULL REFERENCES regencies(id),
    district_id    INTEGER NOT NULL REFERENCES districts(id),
    village_id     INTEGER NOT NULL REFERENCES villages(id),
    owner_user_id  INTEGER REFERENCES users(id),
    address_detail TEXT,
    latitude       DOUBLE PRECISION,
    longitude      DOUBLE PRECISION,
    tray_count     INTEGER NOT NULL DEFAULT 1 CHECK (tray_count >= 1 AND tray_count <= 20),
    status         VARCHAR(50) DEFAULT 'active',
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE thresholds (
    id                   SERIAL PRIMARY KEY,
    screenhouse_id       INTEGER NOT NULL UNIQUE REFERENCES screenhouses(id),
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
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_screenhouses_owner ON screenhouses (owner_user_id);

-- ─── Web Push (PWA notifikasi saat app tertutup) ───
CREATE TABLE push_subscriptions (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint    TEXT NOT NULL,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    user_agent  TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);

COMMIT;
