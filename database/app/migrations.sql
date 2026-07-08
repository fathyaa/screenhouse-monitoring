-- =========================================
-- APP DB migrations — screenhouse_app (port 5434)
-- Untuk instalasi yang sudah jalan sebelum schema terbaru.
-- Idempotent: aman dijalankan berulang.
--
--   psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/migrations.sql
--
-- Fresh install cukup schema.sql + seed.sql (tidak wajib file ini).
-- =========================================

BEGIN;

-- ─── 1. Profil pembibitan screenhouse ───
ALTER TABLE screenhouses ADD COLUMN IF NOT EXISTS seed_variety VARCHAR(100);
ALTER TABLE screenhouses ADD COLUMN IF NOT EXISTS seedling_start_date DATE;

-- ─── 2. Varietas bibit + auto-threshold ───
CREATE TABLE IF NOT EXISTS varietas_bibit (
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

ALTER TABLE screenhouses
  ADD COLUMN IF NOT EXISTS varietas_id INTEGER REFERENCES varietas_bibit(id);

ALTER TABLE thresholds
  ADD COLUMN IF NOT EXISTS varietas_id INTEGER REFERENCES varietas_bibit(id),
  ADD COLUMN IF NOT EXISTS manual_override BOOLEAN NOT NULL DEFAULT false;

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

-- ─── 3. Estimasi siap tanam ───
ALTER TABLE screenhouses
  ADD COLUMN IF NOT EXISTS tanggal_semai DATE,
  ADD COLUMN IF NOT EXISTS estimasi_siap_tanam DATE,
  ADD COLUMN IF NOT EXISTS status_estimasi VARCHAR(30);

UPDATE screenhouses
SET tanggal_semai = seedling_start_date
WHERE tanggal_semai IS NULL AND seedling_start_date IS NOT NULL;

-- ─── 4. Bersihkan sufiks nama screenhouse (em dash) ───
UPDATE screenhouses
SET name = TRIM(SPLIT_PART(name, ' — ', 1))
WHERE name LIKE '% — %';

UPDATE screenhouses
SET name = TRIM(SPLIT_PART(name, ' - ', 1))
WHERE name LIKE '% - %';

-- ─── 5. Siklus semai ───
CREATE TABLE IF NOT EXISTS semai_cycles (
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

CREATE INDEX IF NOT EXISTS idx_semai_cycles_screenhouse ON semai_cycles(screenhouse_id);
CREATE INDEX IF NOT EXISTS idx_semai_cycles_status ON semai_cycles(screenhouse_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_semai_cycles_one_active
  ON semai_cycles(screenhouse_id)
  WHERE status = 'active';

INSERT INTO semai_cycles (
  screenhouse_id,
  varietas_id,
  varietas_nama,
  tanggal_mulai,
  estimasi_siap,
  durasi_target_hari,
  status
)
SELECT
  s.id,
  s.varietas_id,
  COALESCE(vb.nama, s.seed_variety),
  COALESCE(s.tanggal_semai, s.seedling_start_date),
  s.estimasi_siap_tanam,
  vb.durasi_pembibitan_hari,
  'active'
FROM screenhouses s
LEFT JOIN varietas_bibit vb ON vb.id = s.varietas_id
WHERE COALESCE(s.tanggal_semai, s.seedling_start_date) IS NOT NULL
  AND s.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM semai_cycles sc
    WHERE sc.screenhouse_id = s.id AND sc.status = 'active'
  );

-- ─── 6. districts.kode UNIQUE (selaras schema.sql) ───
DO $$
BEGIN
  ALTER TABLE districts ADD CONSTRAINT districts_kode_key UNIQUE (kode);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── 7. Preferensi notifikasi (satu flag akun, dipakai web & HP) ───
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_muted BOOLEAN NOT NULL DEFAULT false;

COMMIT;
