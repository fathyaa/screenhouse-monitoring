# App Database (`screenhouse_app`)

Bounded context: **identity + catalog bisnis**

## Tabel

- `users`
- `provinces`, `regencies`, `districts`, `villages`
- `screenhouses`
- `thresholds`
- `push_subscriptions` (PWA Web Push — ada di `schema.sql`; migrasi terpisah di `push_subscriptions.sql` untuk DB lama)

## Setup

Port host **5434** (lihat `docker/docker-compose.yaml`):

```bash
# Fresh install
psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/schema.sql
psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/seed.sql

# DB app sudah ada sebelum push_subscriptions ditambahkan:
psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/push_subscriptions.sql
```

## Seed demo inti (`seed.sql`)

- 3 user: Pak Eko (petani), Operator, Super Admin — password `123456`
- 3 screenhouse inti di Sukabumi + threshold default
- Wilayah minimal (Jawa Barat / Kab. Sukabumi); dilengkapi `npm run import`

## Seed tambahan (peta + wilayah)

Screenhouse peta **tidak** ada di `seed.sql` — dibuat lewat script di `database/scripts/`:

```bash
cd database/scripts && npm install
npm run import        # seluruh wilayah Indonesia → App DB
npm run sync:registry # sync screenhouse aktif → Monitoring DB
npm run seed:map      # 30+ screenhouse demo di peta (App DB + Monitoring DB)
```

Lihat [`database/scripts/README.md`](../scripts/README.md) dan [`database/README.md`](../README.md).

Rencana migrasi lengkap: [`docs/migration-app-monitoring-service.md`](../../docs/migration-app-monitoring-service.md)
