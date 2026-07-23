-- =========================================
-- APP DATABASE — DATA DEMO SEBARAN (screenhouse_app)
-- 10 screenhouse di Kabupaten Bandung (Jawa Barat), tersebar di 10 kecamatan,
-- milik 5 petani berbeda, dengan siklus semai aktif + riwayat (analytics) supaya:
--   - Peta operator terlihat "berisi" (10 titik koordinat berbeda)
--   - Laporan Wilayah masuk akal (campuran on_track / terlambat / perlu_evaluasi,
--     sebagian siap-tanam <=14 hari, 1 perangkat offline)
--   - Riwayat Semai & Detail Siklus petani punya data (Grade A/B/C)
--
-- Seed ini SELF-CONTAINED: ikut memasukkan baris wilayah (Jawa Barat → Kab. Bandung
-- → 10 kecamatan → 10 desa) via ON CONFLICT DO NOTHING, jadi aman dijalankan di
-- production yang tabel wilayahnya masih kosong. Untuk dropdown wilayah lengkap
-- (registrasi manual), impor wilayah penuh terpisah — lihat database/README.md.
--
-- Konvensi id (lihat CLAUDE.md — screenhouse_id disinkron manual ke monitoring DB):
--   users        : 901–905   (owner)
--   screenhouses : 901–910   (WAJIB sama dengan screenhouse_registry di monitoring DB)
--   thresholds / semai_cycles : SERIAL (biar bebas tabrakan)
-- Blok id dipilih jauh di atas MAX(id) load-test saat penulisan. Guard di bawah akan
-- membatalkan seed jika id sudah terpakai — sesuaikan blok id kalau itu terjadi.
--
-- Jalankan SETELAH database/app/seed.sql:
--   PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d screenhouse_app \
--     -f database/app/seed_demo_bandung.sql
-- Lalu pasangannya: database/monitoring/seed_demo_bandung.sql
-- =========================================

BEGIN;

-- ─── Guard: pastikan blok id belum terpakai ───
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE id BETWEEN 901 AND 905)
     OR EXISTS (SELECT 1 FROM screenhouses WHERE id BETWEEN 901 AND 910) THEN
    RAISE EXCEPTION 'Blok id users 901-905 / screenhouses 901-910 sudah terpakai. Sesuaikan blok id sebelum menjalankan seed ini.';
  END IF;
END $$;

-- ─── 0. Wilayah yang direferensikan (Jawa Barat → Kab. Bandung → 10 kecamatan → 10 desa) ───
-- ON CONFLICT DO NOTHING: aman dijalankan walau sebagian/seluruh wilayah sudah ada.
-- Insert berurutan mengikuti rantai FK: provinces → regencies → districts → villages.
INSERT INTO provinces (id, name, kode) VALUES
(1, 'Jawa Barat', '32')
ON CONFLICT DO NOTHING;

INSERT INTO regencies (id, province_id, name, kode) VALUES
(5, 1, 'Kabupaten Bandung', '32.04')
ON CONFLICT DO NOTHING;

INSERT INTO districts (id, regency_id, name, kode) VALUES
(6,  5, 'Bojongsoang', '32.04.08'),
(13, 5, 'Pangalengan', '32.04.15'),
(16, 5, 'Cicalengka',  '32.04.25'),
(19, 5, 'Rancaekek',   '32.04.28'),
(20, 5, 'Ciparay',     '32.04.29'),
(21, 5, 'Pacet',       '32.04.30'),
(23, 5, 'Baleendah',   '32.04.32'),
(24, 5, 'Majalaya',    '32.04.33'),
(28, 5, 'Soreang',     '32.04.37'),
(30, 5, 'Ciwidey',     '32.04.39')
ON CONFLICT DO NOTHING;

INSERT INTO villages (id, district_id, name, kode) VALUES
(26,  6,  'Bojongsoang',      '32.04.08.2002'),
(72,  13, 'Pangalengan',      '32.04.15.2001'),
(107, 16, 'Cicalengka Wetan', '32.04.25.2002'),
(136, 19, 'Rancaekek Wetan',  '32.04.28.2001'),
(149, 20, 'Ciparay',          '32.04.29.2001'),
(168, 21, 'Nagrak',           '32.04.30.2006'),
(184, 23, 'Baleendah',        '32.04.32.1001'),
(192, 24, 'Majalaya',         '32.04.33.2001'),
(234, 28, 'Soreang',          '32.04.37.2001'),
(255, 30, 'Ciwidey',          '32.04.39.2002')
ON CONFLICT DO NOTHING;

-- Selaraskan sequence wilayah agar insert berikutnya tidak menabrak id yang baru dimasukkan.
SELECT setval('provinces_id_seq', (SELECT MAX(id) FROM provinces));
SELECT setval('regencies_id_seq', (SELECT MAX(id) FROM regencies));
SELECT setval('districts_id_seq', (SELECT MAX(id) FROM districts));
SELECT setval('villages_id_seq',  (SELECT MAX(id) FROM villages));

-- ─── 1. Petani pemilik (password semua: 123456) ───
INSERT INTO users (id, name, phone_number, password, role, status) VALUES
(901, 'Ujang Suryana',   '081234500901', '$2b$10$CpSrK0m24PkChDP3crnSjuarCH3OFl9m2tr3f.fPmD7J7GO3c4biS', 'petani', 'approved'),
(902, 'Icih Kurniasih',  '081234500902', '$2b$10$CpSrK0m24PkChDP3crnSjuarCH3OFl9m2tr3f.fPmD7J7GO3c4biS', 'petani', 'approved'),
(903, 'Dadang Hermawan', '081234500903', '$2b$10$CpSrK0m24PkChDP3crnSjuarCH3OFl9m2tr3f.fPmD7J7GO3c4biS', 'petani', 'approved'),
(904, 'Asep Saepudin',   '081234500904', '$2b$10$CpSrK0m24PkChDP3crnSjuarCH3OFl9m2tr3f.fPmD7J7GO3c4biS', 'petani', 'approved'),
(905, 'Euis Rohaeti',    '081234500905', '$2b$10$CpSrK0m24PkChDP3crnSjuarCH3OFl9m2tr3f.fPmD7J7GO3c4biS', 'petani', 'approved');

-- ─── 2. Screenhouse (province_id=1 Jawa Barat, regency_id=5 Kab. Bandung) ───
-- district_id/village_id sudah diverifikasi ada di DB. Koordinat = titik nyata tiap kecamatan.
-- varietas_id: 1 Ciherang(25h), 2 IR64(22h), 3 Inpari 32(23h), 4 Mekongga(26h), 5 Situ Bagendit(28h)
INSERT INTO screenhouses (
    id, name, province_id, regency_id, district_id, village_id,
    owner_user_id, address_detail, latitude, longitude, tray_count,
    varietas_id, seed_variety, seedling_start_date, tanggal_semai,
    estimasi_siap_tanam, status_estimasi, status
) VALUES
-- Cicalengka — sehat, hampir siap tanam (~10 hari)
(901, 'Screenhouse Tani Makmur',    1, 5, 16, 107, 901, 'Kp. Wetan, dekat saung tani',
 -6.9860, 107.8330, 2, 1, 'Ciherang',
 CURRENT_DATE - 15, CURRENT_DATE - 15, CURRENT_DATE + 10, 'on_track', 'active'),
-- Rancaekek — sehat, siap ~14 hari
(902, 'Rumah Bibit Sukatani',       1, 5, 19, 136, 901, 'Belakang balai desa',
 -6.9640, 107.7600, 1, 2, 'IR64',
 CURRENT_DATE - 8,  CURRENT_DATE - 8,  CURRENT_DATE + 14, 'on_track', 'active'),
-- Ciparay — sehat, baru mulai
(903, 'Screenhouse Sri Rejeki',     1, 5, 20, 149, 901, 'Pinggir sawah blok C',
 -7.0060, 107.7000, 3, 3, 'Inpari 32',
 CURRENT_DATE - 3,  CURRENT_DATE - 3,  CURRENT_DATE + 20, 'on_track', 'active'),
-- Majalaya — sehat, siap ~6 hari
(904, 'Screenhouse Mekar Sari',     1, 5, 24, 192, 902, 'Sebelah kios pupuk',
 -7.0580, 107.7600, 2, 4, 'Mekongga',
 CURRENT_DATE - 20, CURRENT_DATE - 20, CURRENT_DATE + 6,  'on_track', 'active'),
-- Soreang — perlu perhatian (kondisi tanah kurang), estimasi mundur
(905, 'Rumah Bibit Karya Tani',     1, 5, 28, 234, 902, 'Dekat lapang desa',
 -7.0280, 107.5180, 2, 1, 'Ciherang',
 CURRENT_DATE - 5,  CURRENT_DATE - 5,  CURRENT_DATE + 20, 'terlambat', 'active'),
-- Ciwidey — sehat
(906, 'Screenhouse Sumber Rejeki',  1, 5, 30, 255, 903, 'Kebun dataran tinggi',
 -7.1080, 107.4540, 1, 5, 'Situ Bagendit',
 CURRENT_DATE - 10, CURRENT_DATE - 10, CURRENT_DATE + 18, 'on_track', 'active'),
-- Pacet — sehat, siap ~10 hari
(907, 'Screenhouse Harapan Jaya',   1, 5, 21, 168, 903, 'Blok Nagrak',
 -7.0600, 107.7200, 2, 2, 'IR64',
 CURRENT_DATE - 12, CURRENT_DATE - 12, CURRENT_DATE + 10, 'on_track', 'active'),
-- Pangalengan — sehat, siap ~8 hari
(908, 'Rumah Bibit Barokah',        1, 5, 13, 72,  904, 'Perkebunan atas',
 -7.1700, 107.5750, 3, 4, 'Mekongga',
 CURRENT_DATE - 18, CURRENT_DATE - 18, CURRENT_DATE + 8,  'on_track', 'active'),
-- Baleendah — PERANGKAT OFFLINE (sensor tidak mengirim data)
(909, 'Screenhouse Cahaya Tani',    1, 5, 23, 184, 904, 'Dekat tanggul sungai',
 -6.9990, 107.6280, 1, 3, 'Inpari 32',
 CURRENT_DATE - 9,  CURRENT_DATE - 9,  CURRENT_DATE + 14, 'perlu_evaluasi', 'active'),
-- Bojongsoang — sedang jeda tanam (belum ada siklus aktif)
(910, 'Screenhouse Mitra Sejahtera',1, 5, 6,  26,  905, 'Sawah dekat jalan raya',
 -6.9750, 107.6380, 2, 1, 'Ciherang',
 NULL, NULL, NULL, NULL, 'active');

-- ─── 3. Threshold per screenhouse (rentang aman standar) ───
INSERT INTO thresholds (
    screenhouse_id, varietas_id,
    min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus,
    min_potassium, max_potassium, min_soil_moisture, max_soil_moisture,
    min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph,
    min_conductivity, max_conductivity, min_air_temperature, max_air_temperature,
    min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity
)
SELECT id, varietas_id,
    20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0,
    200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses WHERE id BETWEEN 901 AND 910;

-- ─── 4a. Siklus semai AKTIF (untuk 901–909 yang sedang menyemai) ───
INSERT INTO semai_cycles (
    screenhouse_id, varietas_id, varietas_nama, tanggal_mulai, estimasi_siap,
    durasi_target_hari, status
)
SELECT s.id, s.varietas_id, vb.nama, s.tanggal_semai, s.estimasi_siap_tanam,
       vb.durasi_pembibitan_hari, 'active'
FROM screenhouses s
JOIN varietas_bibit vb ON vb.id = s.varietas_id
WHERE s.id BETWEEN 901 AND 909 AND s.tanggal_semai IS NOT NULL;

-- ─── 4b. Siklus semai SELESAI (riwayat + bahan laporan) ───
-- 901 — Grade A (Premium)
INSERT INTO semai_cycles (
    screenhouse_id, varietas_id, varietas_nama, tanggal_mulai, tanggal_selesai,
    estimasi_siap, durasi_target_hari, status, grade, analytics, catatan
) VALUES
(901, 1, 'Ciherang', CURRENT_DATE - 70, CURRENT_DATE - 45, CURRENT_DATE - 46, 25, 'completed', 'A',
 '{
    "durasi": {"target_hari": 25, "aktual_hari": 24, "selisih_hari": -1, "label": "Lebih cepat 1 hari"},
    "uptime": {"pct": 97.5, "online_hours": 585, "total_hours": 600, "offline_pct": 2.5},
    "stability": [
      {"key": "soil_moisture", "label": "Kelembapan Tanah", "icon": "💧", "pct": 93, "quality": "Sangat Baik", "stress_readings": 3},
      {"key": "air_temperature", "label": "Suhu Udara", "icon": "🌡️", "pct": 91, "quality": "Sangat Baik", "stress_readings": 4},
      {"key": "nitrogen", "label": "Nitrogen", "icon": "🧪", "pct": 88, "quality": "Baik", "stress_readings": 5}
    ],
    "stress": {"total_minutes": 75, "total_label": "1 Jam 15 Menit",
      "breakdown": [{"key": "air_temperature", "label": "Suhu Udara", "minutes": 75, "label_duration": "1 Jam 15 Menit", "note": "sesekali terlalu tinggi"}],
      "summary": "Selama 24 hari siklus berjalan, tanaman mengalami stres akumulatif selama 1 Jam 15 Menit."},
    "actuators": [{"key": "fan", "label": "Kipas", "auto_activations": 5, "summary": "Kipas otomatis menyala sebanyak 5 kali selama siklus ini."}],
    "grade": {"letter": "A", "title": "Premium", "summary": "Bibit dinilai sangat sehat dan minim risiko gagal tumbuh saat dipindah ke sawah terbuka."},
    "computed_at": "2026-06-06T03:00:00.000Z"
  }'::jsonb,
  'Bibit seragam dan hijau, langsung dipindah ke sawah.'),
-- 904 — Grade B (Standar)
(904, 4, 'Mekongga', CURRENT_DATE - 66, CURRENT_DATE - 40, CURRENT_DATE - 41, 26, 'completed', 'B',
 '{
    "durasi": {"target_hari": 26, "aktual_hari": 27, "selisih_hari": 1, "label": "Terlambat 1 hari"},
    "uptime": {"pct": 94.0, "online_hours": 610, "total_hours": 648, "offline_pct": 6.0},
    "stability": [
      {"key": "soil_moisture", "label": "Kelembapan Tanah", "icon": "💧", "pct": 82, "quality": "Baik", "stress_readings": 10},
      {"key": "air_temperature", "label": "Suhu Udara", "icon": "🌡️", "pct": 76, "quality": "Perlu Perhatian", "stress_readings": 16},
      {"key": "nitrogen", "label": "Nitrogen", "icon": "🧪", "pct": 73, "quality": "Perlu Perhatian", "stress_readings": 18}
    ],
    "stress": {"total_minutes": 540, "total_label": "9 Jam",
      "breakdown": [
        {"key": "air_temperature", "label": "Suhu Udara", "minutes": 360, "label_duration": "6 Jam", "note": "sering terlalu tinggi"},
        {"key": "nitrogen", "label": "Nitrogen", "minutes": 180, "label_duration": "3 Jam", "note": "sering terlalu rendah"}],
      "summary": "Selama 27 hari siklus berjalan, tanaman mengalami stres akumulatif selama 9 Jam."},
    "actuators": [
      {"key": "fan", "label": "Kipas", "auto_activations": 13, "summary": "Kipas otomatis menyala sebanyak 13 kali selama siklus ini."},
      {"key": "irrigation", "label": "Irigasi", "auto_activations": 4, "summary": "Irigasi otomatis aktif 4 kali selama siklus ini."}],
    "grade": {"letter": "B", "title": "Standar", "summary": "Bibit cukup baik namun perlu perhatian ekstra di awal penanaman sawah."},
    "computed_at": "2026-06-11T03:00:00.000Z"
  }'::jsonb, NULL),
-- 906 — Grade C (Perlu Evaluasi)
(906, 5, 'Situ Bagendit', CURRENT_DATE - 60, CURRENT_DATE - 30, CURRENT_DATE - 32, 28, 'completed', 'C',
 '{
    "durasi": {"target_hari": 28, "aktual_hari": 30, "selisih_hari": 2, "label": "Terlambat 2 hari"},
    "uptime": {"pct": 81.0, "online_hours": 583, "total_hours": 720, "offline_pct": 19.0},
    "stability": [
      {"key": "soil_moisture", "label": "Kelembapan Tanah", "icon": "💧", "pct": 66, "quality": "Perlu Perhatian", "stress_readings": 33},
      {"key": "air_temperature", "label": "Suhu Udara", "icon": "🌡️", "pct": 58, "quality": "Perlu Perhatian", "stress_readings": 45},
      {"key": "nitrogen", "label": "Nitrogen", "icon": "🧪", "pct": 62, "quality": "Perlu Perhatian", "stress_readings": 38}
    ],
    "stress": {"total_minutes": 1620, "total_label": "27 Jam",
      "breakdown": [
        {"key": "air_temperature", "label": "Suhu Udara", "minutes": 960, "label_duration": "16 Jam", "note": "sering terlalu tinggi"},
        {"key": "soil_moisture", "label": "Kelembapan Tanah", "minutes": 660, "label_duration": "11 Jam", "note": "sering terlalu rendah"}],
      "summary": "Selama 30 hari siklus berjalan, tanaman mengalami stres akumulatif selama 27 Jam."},
    "actuators": [{"key": "fan", "label": "Kipas", "auto_activations": 20, "summary": "Kipas otomatis menyala sebanyak 20 kali selama siklus ini."}],
    "grade": {"letter": "C", "title": "Perlu Evaluasi", "summary": "Ada risiko pertumbuhan bibit kerdil akibat kondisi lingkungan yang buruk selama di screenhouse."},
    "computed_at": "2026-06-21T03:00:00.000Z"
  }'::jsonb, 'Ventilasi kurang, suhu siang sering tinggi. Perlu tambah kipas.'),
-- 907 — Grade B (Standar)
(907, 2, 'IR64', CURRENT_DATE - 50, CURRENT_DATE - 27, CURRENT_DATE - 28, 22, 'completed', 'B',
 '{
    "durasi": {"target_hari": 22, "aktual_hari": 23, "selisih_hari": 1, "label": "Terlambat 1 hari"},
    "uptime": {"pct": 95.2, "online_hours": 525, "total_hours": 552, "offline_pct": 4.8},
    "stability": [
      {"key": "soil_moisture", "label": "Kelembapan Tanah", "icon": "💧", "pct": 84, "quality": "Baik", "stress_readings": 8},
      {"key": "air_temperature", "label": "Suhu Udara", "icon": "🌡️", "pct": 78, "quality": "Baik", "stress_readings": 12},
      {"key": "nitrogen", "label": "Nitrogen", "icon": "🧪", "pct": 80, "quality": "Baik", "stress_readings": 10}
    ],
    "stress": {"total_minutes": 420, "total_label": "7 Jam",
      "breakdown": [{"key": "air_temperature", "label": "Suhu Udara", "minutes": 420, "label_duration": "7 Jam", "note": "sering terlalu tinggi"}],
      "summary": "Selama 23 hari siklus berjalan, tanaman mengalami stres akumulatif selama 7 Jam."},
    "actuators": [{"key": "fan", "label": "Kipas", "auto_activations": 11, "summary": "Kipas otomatis menyala sebanyak 11 kali selama siklus ini."}],
    "grade": {"letter": "B", "title": "Standar", "summary": "Bibit cukup baik namun perlu perhatian ekstra di awal penanaman sawah."},
    "computed_at": "2026-06-24T03:00:00.000Z"
  }'::jsonb, NULL),
-- 910 — Grade B (satu-satunya siklus, sedang jeda)
(910, 1, 'Ciherang', CURRENT_DATE - 55, CURRENT_DATE - 30, CURRENT_DATE - 31, 25, 'completed', 'B',
 '{
    "durasi": {"target_hari": 25, "aktual_hari": 25, "selisih_hari": 0, "label": "Tepat waktu"},
    "uptime": {"pct": 96.0, "online_hours": 576, "total_hours": 600, "offline_pct": 4.0},
    "stability": [
      {"key": "soil_moisture", "label": "Kelembapan Tanah", "icon": "💧", "pct": 85, "quality": "Baik", "stress_readings": 7},
      {"key": "air_temperature", "label": "Suhu Udara", "icon": "🌡️", "pct": 79, "quality": "Baik", "stress_readings": 11},
      {"key": "nitrogen", "label": "Nitrogen", "icon": "🧪", "pct": 82, "quality": "Baik", "stress_readings": 9}
    ],
    "stress": {"total_minutes": 360, "total_label": "6 Jam",
      "breakdown": [{"key": "air_temperature", "label": "Suhu Udara", "minutes": 360, "label_duration": "6 Jam", "note": "sesekali terlalu tinggi"}],
      "summary": "Selama 25 hari siklus berjalan, tanaman mengalami stres akumulatif selama 6 Jam."},
    "actuators": [{"key": "fan", "label": "Kipas", "auto_activations": 10, "summary": "Kipas otomatis menyala sebanyak 10 kali selama siklus ini."}],
    "grade": {"letter": "B", "title": "Standar", "summary": "Bibit cukup baik namun perlu perhatian ekstra di awal penanaman sawah."},
    "computed_at": "2026-06-19T03:00:00.000Z"
  }'::jsonb, 'Menunggu jadwal semai berikutnya.');

-- ─── 5. Reset sequences ───
SELECT setval('users_id_seq',        (SELECT MAX(id) FROM users));
SELECT setval('screenhouses_id_seq', (SELECT MAX(id) FROM screenhouses));
SELECT setval('thresholds_id_seq',   (SELECT MAX(id) FROM thresholds));
SELECT setval('semai_cycles_id_seq', (SELECT MAX(id) FROM semai_cycles));

COMMIT;
