# Monitoring Database (`screenhouse_monitoring`)

Bounded context: **telemetry IoT + alerting**

## Tabel

- `sensor_nodes` (`screenhouse_id` logical — tanpa FK ke App DB)
- `sensor_data`
- `alerts`
- `threshold_snapshots` (copy dari App DB via event/seed)

## Setup

Jalankan **setelah** App DB + seed app (ID screenhouse harus konsisten).

```bash
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/schema.sql
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/seed.sql
```

## Seed tambahan

```bash
psql ... -d screenhouse_monitoring -f database/monitoring/data/seed_map_screenhouses.sql
```

Rencana migrasi lengkap: [`docs/migration-app-monitoring-service.md`](../../docs/migration-app-monitoring-service.md)
