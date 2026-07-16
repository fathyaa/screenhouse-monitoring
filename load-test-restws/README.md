# Load tests (k6)

## Services

**Harus jalan:**

- `docker compose up -d` (Postgres app + monitoring, Redis)
- `app-service` (port 8000)
- `monitoring-service` (port 3001)

**Sebaiknya dimatikan** (agar metrik murni dari 555 VU, bukan noise tambahan):

- `npm run simulate` di `services/monitoring-service` — menulis sensor ke DB + Redis setiap 20 menit
- Publisher MQTT / firmware ESP32 lain
- Frontend Vite (`npm run dev`) — tidak dipakai k6; boleh tetap jalan tapi tidak perlu

**Opsional tetap jalan:** Mosquitto, RabbitMQ (khususnya jika `USE_RABBITMQ=true` untuk uji ingest + dashboard bersamaan).

## Data uji

Seed minimal 555 akun petani:

```bash
cd database/scripts
STRESS_FARMER_COUNT=555 STRESS_SH_COUNT=60 npm run seed:stress
```

Telepon: `081300000001` … `081300000555` · password: `123456`

## Menjalankan

```bash
brew install k6   # atau https://k6.io/docs/get-started/installation/
k6 run load-tests/k6-bibitlive-dashboard.js
```

Jalankan k6 dari mesin lain jika memungkinkan, agar CPU lokal tidak ikut membebani backend.

## Uji bertahap (throughput & latency vs beban) — untuk grafik laporan

Metodologi yang diminta pembimbing: naikkan beban **bertahap dari kecil ke besar**,
ukur **throughput** (req/detik yang tertangani) dan **latency** (p50/p95/p99), lalu
plot vs tingkat beban. Titik di mana throughput mendatar tapi latency melonjak =
kapasitas maksimum. Ada dua track terpisah:

- **REST** — variabel beban = jumlah user serentak (VU).
- **WebSocket** — variabel beban = jumlah koneksi realtime konkuren.

```bash
./run-stepped.sh            # kedua track, satu run k6 per level (10→400 REST, 10→800 WS)
./run-stepped.sh rest       # hanya REST
./run-stepped.sh ws         # hanya WebSocket
REST_LEVELS="10 50 100 200" ./run-stepped.sh rest   # level custom
```

Tiap level menghasilkan `step-<track>-<level>-*.json` (satu titik kurva). Ulangi
beberapa kali per level kalau mau menghaluskan variansi — build-report merata-ratakan
run dengan level yang sama.

Lalu bangun laporan HTML self-contained (buka langsung di browser):

```bash
python3 build-report.py            # dari data step-*.json
python3 build-report.py --demo     # data contoh, untuk lihat bentuk grafiknya dulu
```

Hasil: `laporan-beban-restws.html` — throughput vs beban, latensi p50/p95/p99 vs
beban, dan request/koneksi gagal vs beban (REST & WebSocket berdampingan, tiap
grafik satu sumbu — throughput dan latency sengaja tidak digabung dual-axis).
