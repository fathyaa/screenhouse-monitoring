# Database

Arsitektur microservices dengan **2 database terpisah** (bounded context):
**App DB** (`screenhouse_app`, port `5434`) dan **Monitoring DB**
(`screenhouse_monitoring`, port `5433`).

## Setup cloud / fresh install

```bash
# 1. Infra (Postgres app+monitoring, Redis, MQTT)
cd docker && docker compose up -d && cd ..

# 2. App DB — port 5434
psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/schema.sql
psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/seed.sql

# 3. Monitoring DB — port 5433
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/schema.sql
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/seed.sql
```

Opsional (wilayah lengkap + peta):

```bash
cd database/scripts && npm install
npm run import         # wilayah Indonesia → App DB
npm run sync:registry  # screenhouse + threshold App DB → Monitoring DB
npm run seed:map       # 30+ screenhouse demo di peta (App + Monitoring DB)
cd ../..
```

> Port `5434`/`5433` adalah port **host** (lihat `docker/docker-compose.yaml`).
> Di dalam container Postgres tetap `5432`.

Password demo: `123456`  
- Pak Eko `081111111111`  
- Operator `089999999999`  
- Super Admin `088888888888`

## Struktur

| Folder | DB (port) | Isi |
|--------|-----------|-----|
| `database/app/` | `screenhouse_app` (5434) | users, wilayah, screenhouses (`tray_count`), thresholds, `push_subscriptions` |
| `database/monitoring/` | `screenhouse_monitoring` (5433) | screenhouse_registry, threshold_snapshots, sink_nodes, sensor_nodes, sensor_data, actuator_logs, alerts |
| `database/scripts/` | App + Monitoring | import wilayah, sync registry, seed peta |

## Model

```
App DB:        users → screenhouses → thresholds
Monitoring DB: screenhouse_registry + threshold_snapshots (sync)
                 sink_nodes (1/SH) + sensor_nodes (tray) → sensor_data → alerts
                 actuator_logs (riwayat relay)
```

### Konvensi kode node

| Sumber | Tray (`sensor_nodes`) | Sink (`sink_nodes`) |
|--------|----------------------|---------------------|
| 3 screenhouse inti (`seed.sql`) | `SH01-T01`, `SH01-T02`, `SH02-T01`, `SH03-T01` | `SH01-SINK`, `SH02-SINK`, `SH03-SINK` |
| 30+ titik peta (`npm run seed:map`) | `SHM01-N01`, `SHM02-N01`, … | `SHM01-SINK`, `SHM02-SINK`, … |

Pola demo inti: `SH` + `screenhouse_id` (2 digit) + `-T` + nomor tray (`01`, `02`, …). Satu sink per screenhouse: `SH01-SINK`, `SH02-SINK`, dst.

`node_id` di payload MQTT harus sama persis dengan `node_code` di DB. Simulasi inti: `SH01-T01` via topic `screenhouse/1/sink/SH01-SINK/sensor`.

### Seed & demo opsional (Monitoring DB)

Fresh install sudah mencakup histori 24 jam + status peta demo di `database/monitoring/seed.sql` (via `data/seed_sensor_history.sql`).
