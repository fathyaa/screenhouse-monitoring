-- =========================================
-- MONITORING DATABASE — PENYETELAN LAPORAN WILAYAH (demo)
-- Tujuan (untuk tampilan laporan operator yang "sehat" saat demo/skripsi):
--   1) Kesiapan tepat waktu > 90%  → isi data sensor SEHAT 7 hari untuk screenhouse
--      aktif 1–33 & 93–95, sehingga skor kondisi tinggi → estimasi = on_track.
--      (905 & 909 sengaja TIDAK diisi: tetap jadi contoh "terlambat" & "offline".)
--   2) Parameter alert terbanyak = satu parameter jelas (bukan "Lainnya") → hapus
--      alert offline "tidak mengirim data" yang selama ini mendominasi bucket "Lainnya".
--
-- Catatan: laporan menghitung ulang estimasi dari data sensor 7 hari (persist:true),
-- jadi yang menentukan on_track adalah DATA, bukan kolom status_estimasi.
-- Data seed cepat "basi" (ambang offline 15 menit) → untuk MEMPERTAHANKAN kondisi ini
-- saat demo berjalan, jalankan simulator live-simulasi.mjs (mencakup semua 47 screenhouse).
--
-- Jalankan:
--   PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring \
--     -f database/monitoring/seed_demo_report_boost.sql
-- Aman diulang (idempoten secara praktis: hanya menambah reading & menghapus alert offline).
-- =========================================

BEGIN;

-- ─── 1. Data sensor SEHAT 7 hari (hourly) untuk house aktif 1–33 & 93–95 ───
-- Nilai berada di tengah rentang aman → skor kondisi ~100 → estimasi on_track.
INSERT INTO sensor_data (
    sensor_node_id, sink_node_id, nitrogen, phosphorus, potassium,
    soil_temperature, soil_moisture, soil_ph, conductivity,
    air_temperature, air_humidity, light_intensity, created_at
)
SELECT
    sn.id, sk.id,
    30 + (h % 4),                                                   -- nitrogen  30–33
    18 + (h % 3),                                                   -- phosphorus 18–20
    28 + (h % 5),                                                   -- potassium 28–32
    ROUND((26.0 + 2.0 * SIN(h * PI() / 12))::numeric, 1),           -- soil_temp 24–28
    ROUND((64.0 + 4 * SIN(h * PI() / 10))::numeric, 1),             -- soil_moist 60–68
    6.3,                                                            -- soil_ph
    ROUND((480 + (h % 24) * 3)::numeric, 1),                        -- conductivity
    ROUND((27.0 + 3 * SIN(h * PI() / 12))::numeric, 1),             -- air_temp
    ROUND((65.0 + 6 * COS(h * PI() / 10))::numeric, 1),             -- air_humidity
    CASE
        WHEN EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) BETWEEN 6 AND 18
        THEN ROUND((9000 + EXTRACT(HOUR FROM (t.ts AT TIME ZONE 'Asia/Jakarta')) * 1200)::numeric, 0)
        ELSE ROUND(2600::numeric, 0)
    END,
    t.ts
FROM sensor_nodes sn
JOIN sink_nodes sk ON sk.screenhouse_id = sn.screenhouse_id
JOIN screenhouse_registry sr ON sr.screenhouse_id = sn.screenhouse_id AND sr.status = 'active'
CROSS JOIN LATERAL generate_series(167, 0, -1) AS h
CROSS JOIN LATERAL (SELECT (NOW() - (h || ' hours')::interval) AS ts) t
WHERE sn.is_active = true
  AND (sn.screenhouse_id BETWEEN 1 AND 33 OR sn.screenhouse_id BETWEEN 93 AND 95);

-- ─── 2. Hapus alert offline "tidak mengirim data" (biang bucket "Lainnya") ───
-- Node yang benar-benar masih offline (mis. 909) akan memunculkan lagi 1 alert
-- setelah ~15 menit — jumlahnya kecil dan tidak menggeser parameter juara.
DELETE FROM alerts WHERE message ILIKE '%tidak mengirim data%';

-- ─── 3. Reset sequence ───
SELECT setval('sensor_data_id_seq', (SELECT MAX(id) FROM sensor_data));

COMMIT;
