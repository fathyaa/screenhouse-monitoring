-- Varietas bibit + auto-threshold · idempotent
BEGIN;

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

COMMIT;
