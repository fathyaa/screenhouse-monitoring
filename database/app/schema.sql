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

-- ─── Varietas bibit (standar threshold pembibitan) ───
CREATE TABLE varietas_bibit (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(100) NOT NULL UNIQUE,
    nitrogen_min DECIMAL(10,2),
    nitrogen_max DECIMAL(10,2),
    phosphorus_min DECIMAL(10,2),
    phosphorus_max DECIMAL(10,2),
    potassium_min DECIMAL(10,2),
    potassium_max DECIMAL(10,2),
    moisture_min DECIMAL(10,2),
    moisture_max DECIMAL(10,2),
    soil_ph_min DECIMAL(4,2),
    soil_ph_max DECIMAL(4,2),
    durasi_pembibitan_hari INT,
    deskripsi TEXT,
    sumber_referensi VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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
    varietas_id    INTEGER REFERENCES varietas_bibit(id),
    seed_variety   VARCHAR(100),
    seedling_start_date DATE,
    tanggal_semai  DATE,
    estimasi_siap_tanam DATE,
    status_estimasi VARCHAR(30),
    status         VARCHAR(50) DEFAULT 'active',
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE semai_cycles (
    id SERIAL PRIMARY KEY,
    screenhouse_id INTEGER NOT NULL REFERENCES screenhouses(id) ON DELETE CASCADE,
    varietas_id INTEGER REFERENCES varietas_bibit(id),
    varietas_nama VARCHAR(100),
    tanggal_mulai DATE NOT NULL,
    tanggal_selesai DATE,
    estimasi_siap DATE,
    durasi_target_hari INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed')),
    grade CHAR(1) CHECK (grade IN ('A', 'B', 'C')),
    analytics JSONB,
    catatan TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_semai_cycles_screenhouse ON semai_cycles (screenhouse_id);
CREATE UNIQUE INDEX idx_semai_cycles_one_active ON semai_cycles (screenhouse_id)
    WHERE status = 'active';

CREATE TABLE thresholds (
    id                   SERIAL PRIMARY KEY,
    screenhouse_id       INTEGER NOT NULL UNIQUE REFERENCES screenhouses(id),
    varietas_id          INTEGER REFERENCES varietas_bibit(id),
    manual_override      BOOLEAN NOT NULL DEFAULT false,
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

-- ─── Seed varietas bibit (Jawa Barat) ───
INSERT INTO varietas_bibit (
  nama, nitrogen_min, nitrogen_max, phosphorus_min, phosphorus_max,
  potassium_min, potassium_max, moisture_min, moisture_max,
  soil_ph_min, soil_ph_max, durasi_pembibitan_hari, deskripsi, sumber_referensi
) VALUES
(
  'Ciherang', 22, 42, 12, 28, 18, 48, 55, 78, 5.8, 6.8, 25,
  'Varietas unggul nasional adaptif dataran rendah. Fase pembibitan 25 hari, kebutuhan N sedang-tinggi untuk pertumbuhan daun.',
  'Balitbangtan / BBPADI 2023'
),
(
  'IR64', 20, 40, 10, 26, 15, 45, 52, 75, 5.5, 6.5, 22,
  'Varietas popular dataran rendah, siklus pembibitan relatif cepat (21–25 hari).',
  'Balitbangtan / BBPADI 2023'
),
(
  'Inpari 32', 22, 44, 11, 28, 16, 46, 54, 76, 5.6, 6.7, 23,
  'Varietas INPARI tahan wereng, respons baik terhadap kelembapan stabil di fase semai.',
  'Balitbangtan / BBPADI 2023'
),
(
  'Mekongga', 21, 43, 10, 30, 17, 50, 56, 80, 5.7, 7.0, 26,
  'Varietas tahan cekaman, toleransi kelembapan lebih lebar untuk pembibitan di musim hujan.',
  'Balitbangtan / BBPADI 2023'
),
(
  'Situ Bagendit', 20, 45, 12, 32, 15, 52, 50, 82, 5.5, 7.0, 28,
  'Varietas lokal Jawa Barat, pembibitan lebih panjang (~28 hari), kebutuhan K lebih tinggi.',
  'Balitbangtan / BBPADI 2023 · adaptasi Jawa Barat'
)
ON CONFLICT (nama) DO NOTHING;

COMMIT;
