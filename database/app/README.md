# App Database (`screenhouse_app`)

Bounded context: **identity + catalog bisnis**

## Tabel

- `users`
- `provinces`, `regencies`, `districts`, `villages`
- `screenhouses` (kolom `tray_count`: jumlah tray/sensor node terpasang, 1–20)
- `thresholds`
- `push_subscriptions` (PWA Web Push — subscription endpoint per petani)

## Setup

Port host **5434** (lihat `docker/docker-compose.yaml`):

```bash
# Fresh install
psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/schema.sql
psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/seed.sql
```

## Seed demo inti (`seed.sql`)

- 3 user: Pak Eko (petani), Operator, Super Admin — password `123456`
- 3 screenhouse inti di Sukabumi + threshold default
  - SH01 `tray_count = 2` (SH01-T01, SH01-T02 di Monitoring DB)
  - SH02 & SH03 `tray_count = 1`
- `push_subscriptions` kosong sampai petani mengaktifkan notifikasi di PWA
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

## Migrasi (DB lama)

Fresh install cukup `schema.sql` + `seed.sql`. Untuk DB yang sudah jalan:

```bash
psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/migrations.sql
```
