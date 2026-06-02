# Import Wilayah Indonesia (idn-area-data)

Mengimpor **seluruh** provinsi, kab/kota, kecamatan, dan desa/kelurahan Indonesia.

## Prasyarat

1. `schema.sql` dan `seed.sql` sudah dijalankan
2. `.env` database di `services/screenhouse-service/.env`
3. Node.js **22+**

## Cara pakai

Lihat urutan lengkap di [`../README.md`](../README.md).

```bash
cd database/scripts
npm install
npm run import
```

Script ini juga **remap** 3 screenhouse demo inti ke ID desa/kecamatan yang benar dari data Kemendagri.

## Opsional

Hapus baris wilayah lama tanpa `kode`:

```bash
npm run import:prune
```
