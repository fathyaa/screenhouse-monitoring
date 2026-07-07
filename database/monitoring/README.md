# Monitoring DB (`screenhouse_monitoring`)

Bounded context: **ingest + alerting + read-model tersinkron**

## Model

```
screenhouse_registry
├── sink_nodes (1 per screenhouse — gateway + relay)
├── sensor_nodes (N per screenhouse — 1 tray = 1 node)
│   └── sensor_data (pembacaan tray + sink_node_id)
├── actuator_logs (riwayat ON/OFF relay)
└── alerts (dedup active per screenhouse + node + pesan)
```

Payload MQTT:

| Field | Tabel |
|-------|-------|
| `node_id` | `sensor_nodes.node_code` (tray) |
| `destination_id` | `sink_nodes.node_code` (sink) |

### Konvensi kode node

| Sumber | Tray | Sink |
|--------|------|------|
| `seed.sql` (3 demo inti) | `SH01-T01`, `SH01-T02`, `SH02-T01`, `SH03-T01` | `SH01-SINK` … `SH03-SINK` |
| `npm run seed:map` (peta) | `SHM01-N01`, `SHM02-N01`, … | `SHM01-SINK`, `SHM02-SINK`, … |

Pola demo inti: tray `SH{id}-T{nn}`, sink `SH{id}-SINK` (satu sink per screenhouse).

Status relay di `sink_nodes` + `actuator_logs`, bukan di `sensor_data`.

## Setup (fresh install / cloud)

Port host **5433**:

```bash
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/schema.sql
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/seed.sql
```

`seed.sql` sudah mencakup:

- registry + threshold 3 screenhouse inti (mirror App DB)
- sink + sensor node per `tray_count`
- histori sensor 24 jam
- reading live `NOW()` untuk demo peta: SH01 Sehat, SH02 Peringatan, SH03 Kritis

Jalankan **App DB** dulu (`database/app/schema.sql` + `seed.sql`), lalu monitoring di atas.

## Migrasi (DB lama)

Fresh install cukup `schema.sql` + `seed.sql`. Untuk DB yang sudah jalan:

```bash
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/migrations.sql
```

## Seed tambahan (peta)

30+ screenhouse di peta — lewat `database/scripts/`:

```bash
cd database/scripts && npm install
npm run sync:registry
npm run seed:map
```

## Reset penuh (opsional)

```bash
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/schema.sql
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/seed.sql
```

## Tes MQTT

```bash
mosquitto_pub -h localhost \
  -t screenhouse/1/sink/SH01-SINK/sensor \
  -m '{"node_id":"SH01-T01","destination_id":"SH01-SINK","nitrogen":24,"soil_moisture":68,"air_temperature":28}'
```

Simulasi berkelanjutan: `docs/evaluasi-kualitas/mqtt-pak-eko.sh`
