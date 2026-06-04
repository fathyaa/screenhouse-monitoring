# App Database (`screenhouse_app`)

Bounded context: **identity + catalog bisnis**

## Tabel

- `users`
- `provinces`, `regencies`, `districts`, `villages`
- `screenhouses`
- `thresholds`

## Setup

```bash
psql -h localhost -p 5432 -U postgres -d screenhouse_app -f database/app/schema.sql
psql -h localhost -p 5432 -U postgres -d screenhouse_app -f database/app/seed.sql

# Wilayah Indonesia (target App DB — update connection di scripts/.env)
cd database/scripts && npm install && npm run import
```

## Seed tambahan

```bash
psql ... -d screenhouse_app -f database/app/data/seed_map_screenhouses.sql
```

Rencana migrasi lengkap: [`docs/migration-app-monitoring-service.md`](../../docs/migration-app-monitoring-service.md)
