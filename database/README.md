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
| `database/monitoring/` | `screenhouse_monitoring` (5433) | screenhouse_registry, threshold_snapshots, sensor_nodes, sensor_data, alerts |
| `database/scripts/` | App + Monitoring | import wilayah, sync registry, seed peta |

## Model

```
App DB:        users → screenhouses → thresholds
Monitoring DB: screenhouse_registry + threshold_snapshots (sync)
                 sensor_nodes → sensor_data → alerts
```

Migrasi service: [`docs/migration-app-monitoring-service.md`](../docs/migration-app-monitoring-service.md)
