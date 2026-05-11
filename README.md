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

```txt
Sensor ESP32
    ↓
MQTT Broker (Mosquitto)
    ↓
Data Service
    ↓
Redis Event Bus
    ↓
┌───────────────────────┐
│ Alert Service         │
│ Realtime Service      │
└───────────────────────┘
    ↓
Frontend Dashboard
```

---

# Struktur Project

```txt
screenhouse-monitoring/
│
├── frontend/
│
├── services/
│   ├── user-service/
│   ├── screenhouse-service/
│   ├── data-service/
│   ├── realtime-service/
│   └── alert-service/
│
├── database/
│   ├── schema.sql
│   └── seed.sql
│
├── docker/
│   └── mosquitto/
│       └── config/
│           └── mosquitto.conf
│
├── docker-compose.yml
│
├── .gitignore
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

Buat file `.env` di masing-masing service.

Contoh:

## services/user-service/.env

```env
PORT=3004

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=screenhouse_monitoring

JWT_SECRET=supersecret
```

---

## services/screenhouse-service/.env

```env
PORT=3003

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=screenhouse_monitoring

JWT_SECRET=supersecret
```

---

## services/data-service/.env

```env
PORT=3001

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=screenhouse_monitoring

MQTT_HOST=localhost
MQTT_PORT=1883

REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## services/realtime-service/.env

```env
PORT=3002

REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## services/alert-service/.env

```env
PORT=3005

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=screenhouse_monitoring

REDIS_HOST=localhost
REDIS_PORT=6379
```

---

# Install Dependency

## Frontend

```bash
cd frontend
npm install
```

---

## User Service

```bash
cd services/user-service
npm install
```

---

## Screenhouse Service

```bash
cd services/screenhouse-service
npm install
```

---

## Data Service

```bash
cd services/data-service
npm install
```

---

## Realtime Service

```bash
cd services/realtime-service
npm install
```

---

## Alert Service

```bash
cd services/alert-service
npm install
```

---

# Menjalankan Infrastructure Docker

Jalankan:

```bash
docker compose up -d
```

Container yang akan berjalan:

* PostgreSQL
* Redis
* Mosquitto MQTT Broker

---

# Setup Database

## Masuk PostgreSQL

```bash
docker exec -it screenhouse-postgres psql -U postgres
```

---

## Buat Database

```sql
CREATE DATABASE screenhouse_monitoring;
```

---

## Import Schema

Keluar dari PostgreSQL lalu jalankan:

```bash
psql -U postgres -d screenhouse_monitoring -f database/schema.sql
```

---

## Import Seed Data

```bash
psql -U postgres -d screenhouse_monitoring -f database/seed.sql
```

---

# Menjalankan Services

## User Service

```bash
cd services/user-service
node src/index.js
```

---

## Screenhouse Service

```bash
cd services/screenhouse-service
node src/index.js
```

---

## Data Service

```bash
cd services/data-service
node src/index.js
```

---

## Realtime Service

```bash
cd services/realtime-service
node src/index.js
```

---

## Alert Service

```bash
cd services/alert-service
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
-t screenhouse/1/sensor \
-m '{
  "npk":{
    "nitrogen":10,
    "phosphorus":15,
    "potassium":18
  },
  "moisture":40
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

| Service             | Port |
| ------------------- | ---- |
| Frontend            | 5173 |
| Data Service        | 3001 |
| Realtime Service    | 3002 |
| Screenhouse Service | 3003 |
| User Service        | 3004 |
| Alert Service       | 3005 |
| PostgreSQL          | 5432 |
| Redis               | 6379 |
| MQTT                | 1883 |

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
