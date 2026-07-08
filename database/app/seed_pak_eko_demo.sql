-- =========================================
-- APP DATABASE — DATA DEMO TAMBAHAN untuk Pak Eko (screenhouse_app)
-- Menambah 3 screenhouse baru (id 93, 94, 95) milik Pak Eko (user id 1) + riwayat
-- siklus semai lengkap (dengan analytics), untuk menguji tampilan:
--   - Riwayat Semai (list + detail + "Rekomendasi siklus berikutnya")
--   - Dashboard petani (kartu screenhouse dengan berbagai kondisi)
--   - Laporan Wilayah (data lintas kecamatan Cisaat/Kadudampit)
-- ID dipilih di atas MAX(id) yang sudah terpakai saat penulisan (screenhouses
-- s.d. 92) — TIDAK mengubah/menghapus data yang sudah ada.
--
-- Jalankan SETELAH database/app/seed.sql (atau kapan saja setelahnya, aman
-- dijalankan di database yang sudah terisi data lain):
--   PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d screenhouse_app \
--     -f database/app/seed_pak_eko_demo.sql
-- =========================================

BEGIN;

-- ─── 1. Screenhouse baru milik Pak Eko ───
-- 93 (Cisaat): campuran alert manual (nitrogen) + auto-handled (kelembapan udara)
-- 94 (Kadudampit): sehat, tanpa alert — riwayat 2 siklus selesai (Grade A & B)
-- 95 (Cisaat): semua alert aktif auto-handled — riwayat 1 siklus selesai (Grade C)
INSERT INTO screenhouses (
    id, name, province_id, regency_id, district_id, village_id,
    owner_user_id, address_detail, latitude, longitude, tray_count,
    varietas_id, seed_variety, seedling_start_date, tanggal_semai,
    estimasi_siap_tanam, status_estimasi, status
) VALUES
(93, 'Screenhouse Cisaat Timur', 1, 1, 1, 1, 1, 'Belakang balai desa',
 -6.9151, 106.9265, 1, 3, 'Inpari 32',
 CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '10 days',
 CURRENT_DATE + INTERVAL '13 days', 'on_track', 'active'),
(94, 'Screenhouse Kadudampit Asri', 1, 1, 2, 3, 1, 'Sebelah kebun kopi',
 -6.8875, 106.9522, 1, 2, 'IR64',
 CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '5 days',
 CURRENT_DATE + INTERVAL '17 days', 'on_track', 'active'),
(95, 'Screenhouse Sukamanah Barat', 1, 1, 1, 2, 1, 'Dekat masjid',
 -6.9203, 106.9298, 1, 1, 'Ciherang', NULL, NULL, NULL, NULL, 'active');

INSERT INTO thresholds (
    id, screenhouse_id, varietas_id,
    min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus,
    min_potassium, max_potassium, min_soil_moisture, max_soil_moisture,
    min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph,
    min_conductivity, max_conductivity, min_air_temperature, max_air_temperature,
    min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity
) VALUES
(93, 93, 3, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000),
(94, 94, 2, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000),
(95, 95, 1, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000);

-- ─── 2. Siklus semai ───

-- 93: siklus aktif, baru dimulai (belum ada rekap)
INSERT INTO semai_cycles (
    screenhouse_id, varietas_id, varietas_nama, tanggal_mulai, estimasi_siap,
    durasi_target_hari, status
) VALUES
(93, 3, 'Inpari 32', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '13 days', 23, 'active');

-- 94: siklus aktif + 2 siklus selesai (Grade A lalu Grade B)
INSERT INTO semai_cycles (
    screenhouse_id, varietas_id, varietas_nama, tanggal_mulai, estimasi_siap,
    durasi_target_hari, status
) VALUES
(94, 2, 'IR64', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '17 days', 22, 'active');

INSERT INTO semai_cycles (
    screenhouse_id, varietas_id, varietas_nama, tanggal_mulai, tanggal_selesai,
    estimasi_siap, durasi_target_hari, status, grade, analytics, catatan
) VALUES
(94, 2, 'IR64', CURRENT_DATE - INTERVAL '75 days', CURRENT_DATE - INTERVAL '54 days',
 CURRENT_DATE - INTERVAL '53 days', 22, 'completed', 'A',
 '{
    "durasi": {"target_hari": 22, "aktual_hari": 21, "selisih_hari": -1, "label": "Lebih cepat 1 hari"},
    "uptime": {"pct": 98.1, "online_hours": 494, "total_hours": 504, "offline_pct": 1.9},
    "stability": [
      {"key": "soil_moisture", "label": "Kelembapan Tanah", "icon": "💧", "pct": 92, "quality": "Sangat Baik", "stress_readings": 3},
      {"key": "air_temperature", "label": "Suhu Udara", "icon": "🌡️", "pct": 90, "quality": "Sangat Baik", "stress_readings": 4},
      {"key": "air_humidity", "label": "Kelembapan Udara", "icon": "💨", "pct": 94, "quality": "Sangat Baik", "stress_readings": 2},
      {"key": "soil_temperature", "label": "Suhu Tanah", "icon": "🌱", "pct": 89, "quality": "Baik", "stress_readings": 5},
      {"key": "nitrogen", "label": "Nitrogen", "icon": "🧪", "pct": 86, "quality": "Baik", "stress_readings": 6}
    ],
    "stress": {
      "total_minutes": 90,
      "total_label": "1 Jam 30 Menit",
      "breakdown": [
        {"key": "air_temperature", "label": "Suhu Udara", "minutes": 90, "label_duration": "1 Jam 30 Menit", "note": "sering terlalu tinggi"}
      ],
      "summary": "Selama 21 hari siklus berjalan, tanaman mengalami stres akumulatif selama 1 Jam 30 Menit."
    },
    "actuators": [
      {"key": "fan", "label": "Kipas", "auto_activations": 6, "summary": "Kipas otomatis menyala sebanyak 6 kali selama siklus ini."}
    ],
    "grade": {"letter": "A", "title": "Premium", "summary": "Bibit dinilai sangat sehat dan minim risiko gagal tumbuh saat dipindah ke sawah terbuka."},
    "computed_at": "2026-05-01T03:00:00.000Z"
  }'::jsonb,
  'Panen bibit lancar, langsung dipindah ke sawah tanpa kendala.');

INSERT INTO semai_cycles (
    screenhouse_id, varietas_id, varietas_nama, tanggal_mulai, tanggal_selesai,
    estimasi_siap, durasi_target_hari, status, grade, analytics, catatan
) VALUES
(94, 2, 'IR64', CURRENT_DATE - INTERVAL '40 days', CURRENT_DATE - INTERVAL '17 days',
 CURRENT_DATE - INTERVAL '18 days', 22, 'completed', 'B',
 '{
    "durasi": {"target_hari": 22, "aktual_hari": 23, "selisih_hari": 1, "label": "Terlambat 1 hari"},
    "uptime": {"pct": 93.5, "online_hours": 516, "total_hours": 552, "offline_pct": 6.5},
    "stability": [
      {"key": "soil_moisture", "label": "Kelembapan Tanah", "icon": "💧", "pct": 80, "quality": "Baik", "stress_readings": 11},
      {"key": "air_temperature", "label": "Suhu Udara", "icon": "🌡️", "pct": 74, "quality": "Perlu Perhatian", "stress_readings": 18},
      {"key": "air_humidity", "label": "Kelembapan Udara", "icon": "💨", "pct": 85, "quality": "Baik", "stress_readings": 9},
      {"key": "soil_temperature", "label": "Suhu Tanah", "icon": "🌱", "pct": 77, "quality": "Baik", "stress_readings": 14},
      {"key": "nitrogen", "label": "Nitrogen", "icon": "🧪", "pct": 70, "quality": "Perlu Perhatian", "stress_readings": 20}
    ],
    "stress": {
      "total_minutes": 600,
      "total_label": "10 Jam",
      "breakdown": [
        {"key": "air_temperature", "label": "Suhu Udara", "minutes": 360, "label_duration": "6 Jam", "note": "sering terlalu tinggi"},
        {"key": "nitrogen", "label": "Nitrogen", "minutes": 240, "label_duration": "4 Jam", "note": "sering terlalu rendah"}
      ],
      "summary": "Selama 23 hari siklus berjalan, tanaman mengalami stres akumulatif selama 10 Jam."
    },
    "actuators": [
      {"key": "fan", "label": "Kipas", "auto_activations": 14, "summary": "Kipas otomatis menyala sebanyak 14 kali selama siklus ini."},
      {"key": "irrigation", "label": "Irigasi", "auto_activations": 3, "summary": "Irigasi otomatis aktif 3 kali selama siklus ini."}
    ],
    "grade": {"letter": "B", "title": "Standar", "summary": "Bibit cukup baik namun perlu perhatian ekstra di awal penanaman sawah."},
    "computed_at": "2026-06-05T03:00:00.000Z"
  }'::jsonb,
  NULL);

-- 95: 1 siklus selesai Grade C — kondisi kurang stabil (uji rekomendasi & keandalan alat)
INSERT INTO semai_cycles (
    screenhouse_id, varietas_id, varietas_nama, tanggal_mulai, tanggal_selesai,
    estimasi_siap, durasi_target_hari, status, grade, analytics, catatan
) VALUES
(95, 1, 'Ciherang', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '3 days',
 CURRENT_DATE - INTERVAL '5 days', 25, 'completed', 'C',
 '{
    "durasi": {"target_hari": 25, "aktual_hari": 27, "selisih_hari": 2, "label": "Terlambat 2 hari"},
    "uptime": {"pct": 79.4, "online_hours": 514, "total_hours": 648, "offline_pct": 20.6},
    "stability": [
      {"key": "soil_moisture", "label": "Kelembapan Tanah", "icon": "💧", "pct": 68, "quality": "Perlu Perhatian", "stress_readings": 34},
      {"key": "air_temperature", "label": "Suhu Udara", "icon": "🌡️", "pct": 55, "quality": "Perlu Perhatian", "stress_readings": 48},
      {"key": "air_humidity", "label": "Kelembapan Udara", "icon": "💨", "pct": 72, "quality": "Perlu Perhatian", "stress_readings": 30},
      {"key": "soil_temperature", "label": "Suhu Tanah", "icon": "🌱", "pct": 60, "quality": "Perlu Perhatian", "stress_readings": 40},
      {"key": "nitrogen", "label": "Nitrogen", "icon": "🧪", "pct": 65, "quality": "Perlu Perhatian", "stress_readings": 36}
    ],
    "stress": {
      "total_minutes": 1800,
      "total_label": "30 Jam",
      "breakdown": [
        {"key": "air_temperature", "label": "Suhu Udara", "minutes": 1080, "label_duration": "18 Jam", "note": "sering terlalu tinggi"},
        {"key": "soil_moisture", "label": "Kelembapan Tanah", "minutes": 720, "label_duration": "12 Jam", "note": "sering terlalu rendah"}
      ],
      "summary": "Selama 27 hari siklus berjalan, tanaman mengalami stres akumulatif selama 30 Jam."
    },
    "actuators": [
      {"key": "fan", "label": "Kipas", "auto_activations": 22, "summary": "Kipas otomatis menyala sebanyak 22 kali selama siklus ini."}
    ],
    "grade": {"letter": "C", "title": "Perlu Evaluasi", "summary": "Ada risiko pertumbuhan bibit kerdil atau terserang penyakit akibat kondisi lingkungan yang buruk selama di screenhouse."},
    "computed_at": "2026-06-20T03:00:00.000Z"
  }'::jsonb,
  'Perlu cek ventilasi, suhu sering tinggi siang hari.');

-- ─── 3. Reset sequences ───
SELECT setval('screenhouses_id_seq', (SELECT COALESCE(MAX(id), 1) FROM screenhouses));
SELECT setval('thresholds_id_seq',   (SELECT COALESCE(MAX(id), 1) FROM thresholds));
SELECT setval('semai_cycles_id_seq', (SELECT COALESCE(MAX(id), 1) FROM semai_cycles));

COMMIT;
