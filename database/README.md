# Database

## Setup lengkap (wilayah Indonesia + demo)

Jalankan dari **root project**:

```bash
# 1. Struktur tabel
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/schema.sql

# 2. Data demo (user, 3 screenhouse, sensor 24 jam)
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/seed.sql

# 3. Wilayah seluruh Indonesia (~84rb desa, ~5–15 menit)
cd database/scripts && npm install && npm run import

# 4. 30 screenhouse demo di peta (setelah import)
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/data/seed_map_screenhouses.sql
```

Password demo: `123456` — Pak Eko `081111111111`, Operator `089999999999`

## Struktur folder

| File / folder | Wajib? | Fungsi |
|---------------|--------|--------|
| `schema.sql` | ✅ | Struktur tabel |
| `seed.sql` | ✅ | User + 3 screenhouse inti + grafik demo |
| `data/seed_sensor_history.sql` | — | Di-include otomatis dari `seed.sql` |
| `data/seed_map_screenhouses.sql` | ✅ | 30 screenhouse peta (step 4 di atas) |
| `scripts/` | ✅ | Import wilayah `idn-area-data` |

## Model data

```
screenhouses → sensor_nodes → sensor_data
```
