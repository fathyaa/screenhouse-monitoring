# Load Testing — Screenhouse Monitoring

Framework pengujian beban MQTT yang mensimulasikan **ribuan sensor IoT virtual** terhadap pipeline:

```
Sensor Simulator (MQTT publish)
        ↓
   Mosquitto Broker
        ↓
 monitoring-service (MQTT subscribe)
        ↓
   RabbitMQ (sensor-ingest queue)   ← opsional (USE_RABBITMQ=true)
        ↓
   PostgreSQL (sensor_data)
```

**Tool utama:** simulator MQTT custom (Node.js + `mqtt`).

---

## Prasyarat

1. Infrastructure Docker berjalan (`postgres`, `redis`, `mosquitto`, **rabbitmq**)
2. `monitoring-service` aktif (`USE_RABBITMQ=false` default; set `true` + jalankan `rabbitmq` untuk skenario antrian)
3. Node.js ≥ 18

```bash
cd docker && docker compose up -d
cd ../services/monitoring-service && node src/index.js
```

---

## Setup

```bash
cd load-test
npm install
cp .env.example .env    # sesuaikan jika perlu
npm run prepare
npm run seed:nodes      # LT-00001 … LT-05000 di DB monitoring
```

---

## Menjalankan Skenario

| ID | Nama | Sensor | Interval | Durasi |
|----|------|--------|----------|--------|
| S1 | Baseline | 100 | 5s | 5 min |
| S2 | Moderate Load | 500 | 3s | 5 min |
| S3 | Heavy Load | 1000 | 1s | 10 min |
| S4 | Stress Test | 5000 | 1s | 10 min |
| S5 | Spike Test | 100→1000→5000→100 | varies | 8 min |
| S6 | Endurance | 1000 | 5s | 1 jam |

```bash
# Satu skenario
npm run run -- S1

# Semua skenario + laporan otomatis
npm run run:all

# Subset
node runner/run-all.js --only=S1,S2,S3

# Generate laporan dari results/*.json
npm run report
```

---

## Metrik yang Dicatat

| Kategori | Metrik |
|----------|--------|
| MQTT Simulator | messages published, publish rate, publish errors |
| Backend (`/stats/ingest`) | received, processed, enqueued, failed, nacked, success/error rate, latency avg/P95/P99, memory |
| RabbitMQ Management API | queue depth, publish rate, consume/ack rate |
| PostgreSQL | insert count, insert rate |

**Validasi end-to-end:** setiap payload memuat `_loadtest.publishedAt` → backend menghitung latency publish→DB. Jumlah publish dibandingkan dengan baris `sensor_data` untuk node `LT-*`.

---

## Output

Hasil per skenario: `results/{scenario-id}-{timestamp}.json`

Laporan gabungan (Bab IV):

- `results/report.md` — tabel + analisis naratif
- `results/report.html` — tabel + grafik Chart.js (messages/s, latency, queue depth, memory)

### Contoh tabel

| Scenario | Virtual Sensors | Messages Sent | Messages Processed | Failed | Success Rate | Avg Latency | Throughput |
| -------- | --------------- | ------------- | ------------------ | ------ | ------------ | ----------- | ---------- |

---

## Struktur Folder

```
load-test/
├── config/scenarios.json      # definisi S1–S6
├── simulator/
│   ├── mqtt-simulator.js      # virtual sensor scheduler + MQTT pool
│   ├── payload-generator.js   # JSON telemetri realistis
│   └── sensor-registry.js     # LT-00001 … mapping
├── collectors/
│   ├── metrics-collector.js   # orchestrator
│   ├── backend-metrics.js     # polling /stats/ingest
│   ├── rabbitmq-metrics.js    # RabbitMQ Management API
│   └── database-metrics.js    # COUNT sensor_data
├── runner/
│   ├── run-scenario.js        # jalankan 1 skenario
│   └── run-all.js             # jalankan semua + report
├── reporter/
│   └── generate-report.js     # HTML + Markdown Bab IV
├── scripts/
│   ├── prepare.sh             # health check
│   └── seed-loadtest-nodes.js # seed 5000 node LT-*
└── results/                   # output JSON + report
```

---

## Interpretasi Hasil (Penelitian)

1. **Throughput backend** — lihat `processRatePerSec` pada S3/S4; bandingkan dengan `publishRatePerSec`.
2. **Reliabilitas** — `validation.missingPct` harus ≈ 0%; success rate ≥ 99%.
3. **Titik overload** — skenario pertama dengan P95 latency melonjak atau queue depth terus naik (S4/S5).
4. **Peran RabbitMQ** — pada S5, queue depth naik saat spike lalu turun saat cooldown tanpa missing data.
5. **Kapasitas maksimum** — skenario dengan error rate > 1% atau consumer tidak mampu menyusul antrian.

---

## Payload MQTT

Topic: `node/{nodeCode}/telemetry` (contoh: `node/LT-00042/telemetry`)

```json
{
  "node_id": "LT-00042",
  "destination_id": "LT-SINK",
  "nitrogen": 32,
  "phosphorus": 18,
  "potassium": 41,
  "soil_temperature": 28.4,
  "soil_moisture": 62.1,
  "soil_ph": 6.2,
  "conductivity": 450,
  "air_temperature": 29.1,
  "air_humidity": 72,
  "light_intensity": 18500,
  "_loadtest": { "runId": "S1-…", "seq": 1042, "publishedAt": 1719667200123 }
}
```

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `Node tidak ditemukan` | Jalankan `npm run seed:nodes` |
| Queue depth terus naik | Naikkan `RABBITMQ_PREFETCH` atau scale consumer |
| Missing data setelah cooldown | Perpanjang `cooldownSec` di `scenarios.json` |
| RabbitMQ mgmt 401 | Cek `RABBITMQ_USER/PASSWORD` di `.env` |
