# Import Wilayah Indonesia (idn-area-data)

Mengimpor **seluruh** provinsi, kab/kota, kecamatan, dan desa/kelurahan Indonesia.

## Prasyarat

1. `database/app/schema.sql` dan `database/app/seed.sql` sudah dijalankan
2. `.env` database di `services/app-service/.env` (DB `screenhouse_app`, port `5434`)
3. Node.js **22+**

## Cara pakai

Lihat urutan lengkap di [`../README.md`](../README.md).

```bash
cd database/scripts
npm install
npm run import        # import seluruh wilayah Indonesia → App DB
npm run sync:registry # sync screenhouse aktif App DB → Monitoring DB (registry + threshold_snapshots)
npm run seed:map      # seed 30+ screenhouse demo tersebar di peta (App DB + Monitoring DB)
```

`import` juga **remap** 3 screenhouse demo inti ke ID desa/kecamatan yang benar dari data Kemendagri.

## Script

| Perintah | Fungsi |
|----------|--------|
| `npm run import` | Import wilayah Indonesia lengkap ke App DB |
| `npm run import:prune` | Hapus baris wilayah lama tanpa `kode` |
| `npm run sync:registry` | Sinkron screenhouse + threshold App DB → Monitoring DB |
| `npm run seed:map` | Seed screenhouse demo peta (App DB + Monitoring DB) |
