# Screenhouse Monitoring System

Sistem monitoring realtime screenhouse pembibitan padi.

## Stack

### Frontend

* React + Vite
* Tailwind CSS
* React Leaflet
* Socket.IO Client

### Backend

* Node.js
* Express.js
* PostgreSQL
* RabbitMQ
* MQTT
* Socket.IO

### Infrastructure

* PostgreSQL
* RabbitMQ (message broker antar service)
* Mosquitto MQTT Broker
* NGINX (load balancer)
* Docker Compose

---

# Arsitektur Sistem

Microservices dengan **bounded context** dan **2 database terpisah**:

- **App Service** — identity (users) + catalog (screenhouses, wilayah, thresholds). DB: `screenhouse_app`.
- **Monitoring Service** — ingest sensor (MQTT), alerting, realtime (WebSocket), stats. DB: `screenhouse_monitoring`.

App Service membaca data monitoring lewat HTTP (`MONITORING_SERVICE_URL`); Monitoring Service punya read-model tersinkron (`screenhouse_registry`, `threshold_snapshots`) yang di-sync dari App DB lewat event `config.*`.

Monitoring Service dipecah jadi **processing layer + service listener** yang berkomunikasi lewat RabbitMQ. Satu image, tujuh proses, dipilih lewat env `ROLE`:

```txt
Sensor Node (tray) ──radio WSN──► Sink Node (gateway)
                                      ↓ MQTT publish
                                 Mosquitto Broker
                                      ↓ subscribe
                            ROLE=collector          (tepat 1 — subscriber MQTT)
                                      ↓ q.ingest
                            ROLE=processing         (×N — resolusi node, validasi)
                                      ↓ sensor.raw
                            ROLE=persistence        (×N — INSERT sensor_data)
                                      ↓ sensor.persisted
              ┌───────────────────────┴───────────────────────┐
      ROLE=alert (1)                                  ROLE=realtime (×N)
        ↓ alert.created                                 ↓ Socket.IO
      ROLE=notifikasi (app-service, Web Push)     Frontend Dashboard
                                                        ↑
                              NGINX load balancer ──────┘
                                      ↓ /api
                            app-service ROLE=api (×N) ──→ screenhouse_app
```

Semua panah antar service melewati RabbitMQ (topic exchange `shms.events`). **Redis sudah dihapus** — sebelumnya ia murni message bus tanpa cache.

---

# Struktur Project

```txt
screenhouse-monitoring/
│
├── frontend/                 # React + Vite
│
├── services/
│   ├── app-service/          # identity + catalog (DB: screenhouse_app)
│   ├── monitoring-service/   # ingest + alerting + realtime (DB: screenhouse_monitoring)
│   └── _archive/             # microservices lama (referensi migrasi)
│
├── database/
│   ├── app/                  # schema.sql + seed.sql  (screenhouse_app)
│   ├── monitoring/           # schema.sql + seed.sql  (screenhouse_monitoring)
│   ├── scripts/              # import wilayah, sync registry, seed peta
│   └── README.md
│
├── docker/
│   ├── docker-compose.yaml
│   └── mosquitto/config/mosquitto.conf
│
└── README.md
```

---

# Requirement

Install terlebih dahulu:

* Node.js >= 20
* Docker Desktop
* PostgreSQL Client (opsional)
* Git

---

# Clone Repository

```bash
git clone https://github.com/USERNAME/screenhouse-monitoring.git

cd screenhouse-monitoring
```

---

# Setup Environment Variables

Buat file `.env` di masing-masing service. Perhatikan port DB **host** sesuai `docker/docker-compose.yaml`: App DB `5434`, Monitoring DB `5433`.

## services/app-service/.env

```env
PORT=8000

DB_HOST=localhost
DB_PORT=5434
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=screenhouse_app

JWT_SECRET=supersecret

# api = REST + proxy; notifikasi = listener Web Push (proses terpisah).
ROLE=api

RABBITMQ_URL=amqp://screenhouse:screenhouse@localhost:5672
RABBITMQ_EXCHANGE=shms.events

# Web Push (PWA notifikasi saat app tertutup) — generate dengan:
#   cd services/app-service && npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@screenhouse.local

# Baca data monitoring lewat HTTP + koneksi read-only stats
MONITORING_SERVICE_URL=http://localhost:3001
DB_MON_PORT=5433
DB_MON_NAME=screenhouse_monitoring
```

---

## frontend/.env

```env
VITE_API_URL=http://localhost:8000
VITE_MONITORING_URL=http://localhost:3001
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

(`VITE_VAPID_PUBLIC_KEY` harus sama dengan `VAPID_PUBLIC_KEY` di app-service.)

---

## services/monitoring-service/.env

```env
PORT=3001

MQTT_BROKER_URL=mqtt://localhost:1883

DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=screenhouse_monitoring

JWT_SECRET=supersecret

# Peran proses ini. Pilihan: collector, processing, persistence, alert,
# realtime, scheduler, api. Lihat "Satu artefak, banyak role" di CLAUDE.md.
ROLE=api

# RabbitMQ wajib — ia satu-satunya jalur komunikasi antar service.
RABBITMQ_URL=amqp://screenhouse:screenhouse@localhost:5672
RABBITMQ_EXCHANGE=shms.events
RABBITMQ_PREFETCH=20
```

---

# Install Dependency

```bash
cd frontend && npm install && cd ..
cd services/app-service && npm install && cd ../..
cd services/monitoring-service && npm install && cd ../..
```

---

# Menjalankan Infrastructure Docker

Jalankan dari folder `docker/`:

```bash
cd docker && docker compose up -d && cd ..
```

Container yang akan berjalan:

Infrastruktur:

* `screenhouse-postgres-app` — PostgreSQL App DB (host port 5434)
* `screenhouse-postgres-monitoring` — PostgreSQL Monitoring DB (host port 5433)
* `screenhouse-mqtt` — Mosquitto MQTT Broker (1883 / 9001)
* `screenhouse-rabbitmq` — RabbitMQ, bus antar service (5672 / management 15672)

Service:

* `screenhouse-collector` — subscriber MQTT → `q.ingest` (tepat 1)
* `processing`, `persistence` — consumer yang boleh ditambah replica
* `screenhouse-alert` — evaluasi ambang (tepat 1)
* `screenhouse-scheduler` — deteksi node offline (tepat 1)
* `realtime` — gateway Socket.IO (boleh ×N)
* `monitoring-api`, `app-service` — HTTP (boleh ×N)
* `screenhouse-notifikasi` — listener Web Push
* `screenhouse-lb` — NGINX load balancer + SPA (host port 8082)

Buka UI manajemen RabbitMQ di [localhost:15672](http://localhost:15672) (`screenhouse` / `screenhouse`) untuk melihat queue depth dan laju pesan — ini sumber angka agregat yang benar setelah arsitektur dipecah, karena counter di tiap proses hanya menghitung dirinya sendiri.

---

# Setup Database

Dua container Postgres dijalankan oleh Docker (lihat `docker/docker-compose.yaml`): `screenhouse_app` di host port **5434** dan `screenhouse_monitoring` di host port **5433**. Database sudah dibuat otomatis oleh container, tinggal import schema + seed dari **root project**:

```bash
# App DB (identity + catalog)
psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/schema.sql
psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/seed.sql

# Monitoring DB (ingest + alerting)
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/schema.sql
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/seed.sql
```

Wilayah Indonesia lengkap + 30+ screenhouse peta + sync registry — lihat [`database/README.md`](database/README.md).

Password demo: `123456`

---

# Menjalankan Services

## App Service

```bash
cd services/app-service
node src/index.js
```

---

## Monitoring Service

Tiap role adalah proses sendiri. Untuk jalan lengkap di lokal, buka tujuh terminal (atau pakai Docker Compose, jauh lebih praktis):

```bash
cd services/monitoring-service
ROLE=collector   node src/index.js
ROLE=processing  node src/index.js
ROLE=persistence node src/index.js
ROLE=alert       node src/index.js
ROLE=realtime    node src/index.js
ROLE=scheduler   node src/index.js
ROLE=api         node src/index.js
```

Lewat Docker, sekaligus menaikkan replica consumer:

```bash
cd docker
docker compose up -d
docker compose up -d --scale persistence=4 --scale processing=3
```

**Jangan menaikkan replica `collector`, `alert`, atau `scheduler`** — alasannya ada di CLAUDE.md dan di komentar masing-masing service di `docker-compose.yaml`.

---

# Menjalankan Frontend

```bash
cd frontend
npm run dev
```

Frontend akan berjalan di:

```txt
http://localhost:5173
```

---

# MQTT — Telemetry & Aktuator

## Alur singkat

```txt
Tray (sensor node) → Sink node → MQTT cloud
Petani toggle / Alert otomatis
    → monitoring-service publish command ke sink node
    → Sink nyalakan relay
    → Sink publish telemetry balik
    → monitoring-service simpan sensor_data (tray) + actuator_logs (sink)
```

## Topic MQTT

| Arah | Topic | Keterangan |
| ---- | ----- | ---------- |
| Server → Sink | `screenhouse/{id}/sink/{sink_code}/command` | Perintah ON/OFF relay |
| Server → Sink (broadcast) | `screenhouse/{id}/actuator` | Sama + `node_id` / `destination_id` |
| Sink → Server | `screenhouse/{id}/sink/{sink_code}/sensor` | Telemetry tray atau status relay |
| Legacy | `screenhouse/{id}/node/{code}/sensor` | Masih didukung |

| Field payload | DB |
| ------------- | -- |
| `node_id` | `sensor_nodes.node_code` (tray pengirim) |
| `destination_id` | `sink_nodes.node_code` (sink penerima) |

## Payload command (server → sink)

```json
{
  "node_id": "SH01-SINK",
  "destination_id": "SH01-SINK",
  "fan_status": true,
  "irrigation_status": false,
  "lamp_status": false,
  "source": "manual",
  "reason": null
}
```

## Payload telemetry tray (sink → server)

```json
{
  "node_id": "SH01-T01",
  "destination_id": "SH01-SINK",
  "nitrogen": 24,
  "soil_moisture": 68,
  "soil_temperature": 26.5
}
```

Status relay disimpan di `sink_nodes` + `actuator_logs`, **bukan** di `sensor_data`.

Fresh install: `database/monitoring/schema.sql` + `seed.sql` (lihat [`database/monitoring/README.md`](database/monitoring/README.md)).

Setelah menerima command, sink **wajib publish ulang** status relay ke topic sensor.

## Otomatis dari alert

| Kondisi | Aktuator |
| ------- | -------- |
| Kelembapan tanah rendah | Irigasi ON |
| Kelembapan tanah tinggi | Irigasi OFF |
| Suhu / kelembapan udara tinggi | Kipas ON |
| Suhu tanah rendah | Lampu ON |
| Intensitas cahaya rendah | Lampu ON |

## Contoh firmware ESP32

Sketch lengkap ada di [`docs/hardware/esp32-actuator-mqtt.ino`](docs/hardware/esp32-actuator-mqtt.ino).

Ringkasannya: subscribe topic `command`, apply relay, publish ke topic `sensor`.

## Tes tanpa hardware

**Dengarkan command dari web (topic sink — terbaru):**

```bash
mosquitto_sub -h localhost -t 'screenhouse/+/sink/+/command' -v
```

Toggle irigasi/kipas/lampu dari dashboard petani — pesan harus muncul di terminal.

**Publish telemetry tray (via sink — format terbaru):**

```bash
mosquitto_pub -h localhost \
  -t screenhouse/1/sink/SH01-SINK/sensor \
  -m '{
    "node_id": "SH01-T01",
    "destination_id": "SH01-SINK",
    "nitrogen": 30,
    "phosphorus": 20,
    "potassium": 30,
    "soil_moisture": 65,
    "soil_temperature": 27.0,
    "soil_ph": 6.3,
    "conductivity": 450,
    "air_temperature": 28,
    "air_humidity": 70,
    "light_intensity": 20000
  }'
```

**Simulasi balasan relay dari sink (setelah toggle web):**

```bash
mosquitto_pub -h localhost \
  -t screenhouse/1/sink/SH01-SINK/sensor \
  -m '{
    "node_id": "SH01-SINK",
    "destination_id": "SH01-SINK",
    "fan_status": true,
    "irrigation_status": false,
    "lamp_status": false
  }'
```

Script lengkap (alert, loop 10×, dll.): [`docs/evaluasi-kualitas/mqtt-simulasi.sh`](docs/evaluasi-kualitas/mqtt-simulasi.sh)

Kode node demo inti: tray `SH01-T01`, sink `SH01-SINK`. Topic alternatif `screenhouse/{id}/node/{code}/sensor` masih didukung backend, tetapi simulasi dan seed memakai model tray + sink di atas.

---

# Login Dummy User

## Operator

```txt
Nomor HP: 089999999999
Password: 123456
```

---

## Petani

```txt
Nomor HP: 081111111111
Password: 123456
```

---

# Services Port

| Service                       | Port |
| ----------------------------- | ---- |
| Frontend                      | 5173 |
| Monitoring Service            | 3001 |
| App Service                   | 8000 |
| PostgreSQL App (host)         | 5434 |
| PostgreSQL Monitoring (host)  | 5433 |
| MQTT                          | 1883 |
| RabbitMQ                      | 5672 |
| RabbitMQ Management           | 15672 |

---

# Features

## Petani

* Login
* Monitoring sensor realtime
* Receive alert (WebSocket + toast saat app terbuka)
* **PWA**: install ke home screen
* **Push notification** saat app ditutup (Web Push)
* Kontrol aktuator manual (kipas, irigasi, lampu)
* Melihat data screenhouse milik sendiri

## Operator

* Monitoring semua screenhouse
* Monitoring peta screenhouse
* Monitoring status device
* Approval user petani

## System

* MQTT realtime ingestion
* RabbitMQ event bus (exchange `shms.events`)
* WebSocket realtime frontend
* Alert automation + aktuator otomatis
* Realtime map dashboard

---

# PWA & Push Notification

Aplikasi petani bisa **diinstall ke home screen** dan menerima **notifikasi push** walau browser ditutup.

## Cara install (petani)

1. Buka app di **Chrome Android** atau **Safari iOS**
2. Login sebagai petani
3. Banner bawah layar → **Install app** (Android) atau ikuti petunjuk **Add to Home Screen** (iOS)
4. Tap **Aktifkan notifikasi** → izinkan notifikasi browser

## Setup server (sekali)

```bash
cd services/app-service
npx web-push generate-vapid-keys
```

Salin public/private key ke:

* `services/app-service/.env` → `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
* `frontend/.env` → `VITE_VAPID_PUBLIC_KEY` (public key saja)

Tabel `push_subscriptions` sudah ada di `database/app/schema.sql` (fresh install tidak perlu migrasi terpisah).

Restart container **notifikasi** (listener Web Push berlangganan `alert.created` di RabbitMQ).

## Cara kerja

| Kondisi app | Mekanisme notifikasi |
| ----------- | -------------------- |
| Terbuka | Socket.IO + toast + suara |
| Tertutup / background | **Web Push** via service worker |

Service worker custom: `frontend/src/pwa/sw.js` (push handler + notification click → buka `/petani/peringatan`).

## Catatan platform

* **HTTPS wajib** untuk push di production (localhost OK untuk dev)
* **iOS**: push hanya bekerja setelah app di-Add to Home Screen (iOS 16.4+)
* **Android Chrome**: install + push didukung penuh

---

# Notes

* Sistem masih tahap development.
* Threshold per screenhouse via halaman admin/kelola-threshold.
* Device WSN: **Sensor Node** (1 tray) + **Sink Node** (1 gateway/screenhouse) = publisher MQTT; lihat `docs/hardware/` dan `database/monitoring/README.md`.
* Kontrol aktuator: manual (petani via web) + otomatis saat alert threshold.
* PWA + Web Push untuk petani — butuh VAPID keys di app-service.

### Migrasi DB (instalasi yang sudah jalan)

Jalankan sekali jika database dibuat sebelum perubahan schema terbaru:

```bash
psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/migrations.sql
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/migrations.sql
```
