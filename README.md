# Screenhouse Monitoring System

Sistem monitoring realtime screenhouse pembibitan padi untuk MCtan.

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
* Redis
* MQTT
* Socket.IO

### Infrastructure

* PostgreSQL
* Redis
* Mosquitto MQTT Broker
* Docker Compose

---

# Arsitektur Sistem

Microservices dengan **bounded context** dan **2 database terpisah**:

- **App Service** — identity (users) + catalog (screenhouses, wilayah, thresholds). DB: `screenhouse_app`.
- **Monitoring Service** — ingest sensor (MQTT), alerting, realtime (WebSocket), stats. DB: `screenhouse_monitoring`.

App Service membaca data monitoring lewat HTTP (`MONITORING_SERVICE_URL`); Monitoring Service punya read-model tersinkron (`screenhouse_registry`, `threshold_snapshots`) yang di-sync dari App DB.

```txt
Sensor ESP32
    ↓ MQTT
Mosquitto Broker
    ↓
Monitoring Service ──→ screenhouse_monitoring (sensor_data, alerts)
    ↓ Redis event bus + WebSocket
Frontend Dashboard ←── App Service ──→ screenhouse_app (users, screenhouses, thresholds)
```

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

REDIS_HOST=localhost
REDIS_PORT=6379

# Baca data monitoring lewat HTTP + koneksi read-only stats
MONITORING_SERVICE_URL=http://localhost:3001
DB_MON_PORT=5433
DB_MON_NAME=screenhouse_monitoring
```

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

REDIS_HOST=localhost
REDIS_PORT=6379
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

* `screenhouse-postgres-app` — PostgreSQL App DB (host port 5434)
* `screenhouse-postgres-monitoring` — PostgreSQL Monitoring DB (host port 5433)
* `screenhouse-redis` — Redis (6379)
* `screenhouse-mqtt` — Mosquitto MQTT Broker (1883 / 9001)

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

```bash
cd services/monitoring-service
node src/index.js
```

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

# MQTT Testing

## Publish Dummy Sensor Data

```bash
mosquitto_pub \
-h localhost \
-t screenhouse/1/node/SH01-N01/sensor \
-m '{
  "node_code": "SH01-N01",
  "nitrogen": 24,
  "phosphorus": 15,
  "potassium": 18,
  "soil_moisture": 68,
  "soil_temperature": 26.5,
  "soil_ph": 6.2,
  "conductivity": 450,
  "air_temperature": 28,
  "air_humidity": 65,
  "light_intensity": 12000,
  "fan_status": false,
  "irrigation_status": true,
  "lamp_status": false
}'
```

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
| Redis                         | 6379 |
| MQTT                          | 1883 |

---

# Features

## Petani

* Login
* Monitoring sensor realtime
* Receive alert
* Melihat data screenhouse milik sendiri

## Operator

* Monitoring semua screenhouse
* Monitoring peta screenhouse
* Monitoring status device
* Approval user petani

## System

* MQTT realtime ingestion
* Redis event bus
* WebSocket realtime frontend
* Alert automation
* Realtime map dashboard

---

# Notes

* Sistem masih tahap development.
* Threshold saat ini masih global sederhana.
* Device ESP32 + RS485 NPK sensor akan menjadi publisher MQTT utama.
* Sistem fokus monitoring, belum ada aktuator otomatis.
