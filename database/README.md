# Database

Arsitektur microservices dengan **2 database terpisah** (bounded context):
**App DB** (`screenhouse_app`, port `5434`) dan **Monitoring DB**
(`screenhouse_monitoring`, port `5433`). Jalankan semua dari **root project**:

```bash
# 1. Infra (Postgres app+monitoring, Redis, MQTT)
cd docker && docker compose up -d && cd ..

# 2. App DB (identity + catalog) — port 5434
psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/schema.sql
psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/seed.sql

# 3. Monitoring DB (ingest + alerting) — port 5433
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/schema.sql
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/seed.sql

# 4. Wilayah Indonesia lengkap → App DB (~5–15 menit) + sync ke Monitoring
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
| `database/app/` | `screenhouse_app` (5434) | users, wilayah, screenhouses, thresholds |
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
| 3 screenhouse inti (`seed.sql`) | `SH01-T01`, `SH01-T02`, … | `SH01-SINK`, `SH02-SINK`, … |
| 30+ titik peta (`npm run seed:map`) | `SHM01-N01`, `SHM02-N01`, … | `SHM01-SINK`, `SHM02-SINK`, … |
| DB lama (auto-migrasi 001) | — | `SH01-SINK` berdasarkan `screenhouse_id` |

Kode tray harus cocok dengan `node_id` di payload MQTT. Untuk simulasi/demo inti pakai `SH01-T01`; titik peta pakai kode `SHMxx-N01` dari DB.

### Migrasi DB monitoring yang sudah ada

Jalankan berurutan (tidak perlu drop database):

```bash
# 1. Sink node + actuator logs (wajib)
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring \
  -f database/monitoring/migrations/001_sink_nodes_actuators.sql

# 2. Dedup alert active (jika index belum ada)
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring \
  -f database/monitoring/data/migrate_alert_dedup_index.sql

# 3. Kode tray legacy → Txx (hanya 3 demo inti, jika masih SHxx-Nxx)
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring \
  -f database/monitoring/data/migrate_tray_node_codes.sql
```

Setelah migrasi, restart `monitoring-service`. Detail + seed opsional: [`database/monitoring/README.md`](monitoring/README.md).

### Seed & demo opsional (Monitoring DB)

```bash
# Inject reading "live" untuk demo status peta (Sehat / Peringatan / Kritis)
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring \
  -f database/monitoring/data/seed_live_demo.sql
```
