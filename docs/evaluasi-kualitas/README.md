# Template Evaluasi Kualitas Perangkat Lunak

Folder ini berisi template pengukuran metrik kualitas sesuai arahan dosbing:
**fungsional, error, komposisi, availability, maintainability, security, reliability, portability, performance (latency & throughput)** — diukur **per Increment 1, 2, 3**.

## File

| File | Isi |
|------|-----|
| **`uat-matrix.xlsx`** | Matriks UAT (Excel) — **pakai ini**; ada dropdown PASS/FAIL/SKIP + sheet Ringkasan otomatis |
| `uat-matrix.csv` | Sumber data yang sama (CSV, untuk backup/script) |
| **`metrics-bar.xlsx`** | Metrik agregat per increment — **1 sheet = 1 bar chart** (Pass Rate, Error Rate, …) |
| `metrics-bar.csv` | Backup data bar chart |
| **`metrics-boxplot.xlsx`** | 10 run × 3 increment — **1 sheet = 1 metrik** + statistik + panduan box plot |
| `metrics-boxplot.csv` | Backup data box plot |
| `demo-grafik-metrik.html` | Preview grafik di browser (buka file ini) |
| **`mqtt-simulasi.sh`** | Simulasi sensor/alert/aktuator tanpa ESP32 (model tray + sink) — **sekali kirim** |
| **`live-simulasi.mjs`** | Simulasi **berkelanjutan** — random telemetry + alert setiap N menit (default 20) |
| **`live-simulasi.sh`** | Wrapper: `npm install` otomatis lalu jalankan live simulasi |

## Cara pakai

1. Buka **`uat-matrix.xlsx`** → isi **Hasil Aktual** dan **Status** (dropdown) per skenario.
2. Lihat sheet **Ringkasan** — pass rate & error rate terhitung otomatis.
3. Ukur latency/throughput 10× per increment → isi sheet di **`metrics-boxplot.xlsx`**.
4. Ringkas pass rate dll. → isi **`metrics-bar.xlsx`** (salin dari sheet Ringkasan UAT).
5. Buka **`demo-grafik-metrik.html`** di browser untuk preview semua grafik sekaligus.
6. Untuk Word/skripsi: export chart dari Excel (**1 metrik = 1 gambar**) atau dari demo HTML (icon kamera Plotly).

## Prinsip grafik (sesuai arahan dosbing)

**Ya — 1 metrik = 1 chart.** Jangan gabung pass rate + latency dalam satu grafik.

| Tipe | Metrik | Jumlah chart |
|------|--------|--------------|
| Bar | Pass rate, error rate, completeness, availability, security, reliability | **6 chart** |
| Box plot | Latency API, latency E2E, throughput | **3 chart** |

Pengecualian yang masih OK: **Pass Rate vs Error Rate** dalam 1 grouped bar (dua metrik terkait fungsional). Sisanya tetap terpisah.

## Simulasi monitoring hidup (tanpa hardware)

Agar peta operator, grafik, dan notifikasi petani terlihat berjalan:

```bash
# Prasyarat: docker compose up, monitoring-service + app-service + frontend jalan
# seed monitoring sudah di-import

cd docs/evaluasi-kualitas
chmod +x live-simulasi.sh
./live-simulasi.sh              # interval default 20 menit, loop terus

# Uji cepat
npm install
npm run sim:once                  # satu siklus, lalu stop
SIM_INTERVAL_SEC=120 npm run sim  # interval 2 menit
```

**Prasyarat:**
- `docker compose up` (Mosquitto, Redis, PostgreSQL)
- **monitoring-service** jalan (restart setelah update kode: `cd services/monitoring-service && npm start`)
- DB monitoring punya kode tray `SH01-T01` / `SH01-T02` (bukan `SH01-N01`). Jika masih legacy:

```bash
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring \
  -f database/monitoring/data/migrate_tray_node_codes.sql
```

**Yang terjadi otomatis:**
- Telemetry random ke semua tray (`SH01-T01`, `SH01-T02`, `SH02-T01`, `SH03-T01`)
- ~30% siklus sengaja di luar threshold → **alert aktif** + notifikasi Socket.IO ke petani
- Aktuator otomatis (kipas/irigasi) terpicu sesuai rules backend
- Peta operator refresh ~30 detik → marker hijau / kuning / merah / abu (offline)
- Dashboard petani & halaman detail **auto-update** (Socket.IO `sensor-update` + polling 30 detik)

**Sekali kirim manual** (alert spesifik): `./mqtt-simulasi.sh alert-panas`

## Rumus cepat (Excel/Sheets)

```
Pass Rate Inc 1 = COUNTIF(status_range;"PASS") / COUNTIF(increment_range;1) * 100
Error Rate      = COUNTIF(status_range;"FAIL") / total_skenario * 100
Median latency  = MEDIAN(filter latency where increment=1)
```

## Catatan

- Angka di CSV saat ini **contoh ilustrasi**, bukan hasil uji nyata — ganti setelah pengujian.
- `_archive/` dan service lama **jangan** dimasukkan scope evaluasi.
