# Monitoring DB — Migrasi & Schema

## Model terbaru

```
screenhouse_registry
├── sink_nodes (1 per screenhouse — gateway + relay)
├── sensor_nodes (N per screenhouse — 1 tray = 1 node)
│   └── sensor_data (pembacaan tray, opsional sink_node_id)
└── actuator_logs (riwayat ON/OFF relay via sink)
```

Payload MQTT dari tim IoT:

| Field | Tabel |
|-------|-------|
| `node_id` | `sensor_nodes.node_code` (tray pengirim) |
| `destination_id` | `sink_nodes.node_code` (sink penerima) |

### Konvensi kode node

| Sumber | Tray | Sink |
|--------|------|------|
| `seed.sql` (3 demo inti) | `SH01-T01`, `SH01-T02`, `SH02-T01`, `SH03-T01` | `SH01-SINK` … `SH03-SINK` |
| `npm run seed:map` (peta) | `SHM01-N01`, `SHM02-N01`, … | `SHM01-SINK`, `SHM02-SINK`, … |
| Migrasi 001 (DB lama) | — | `SH{id}-SINK` dari `screenhouse_id` |

Status relay disimpan di `sink_nodes` + `actuator_logs`, **bukan** di `sensor_data`.

---

## DB baru (fresh install)

```bash
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/schema.sql
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/seed.sql
```

---

## DB lama (sudah jalan) — jalankan migrasi

**Tidak perlu drop database.** Jalankan berurutan:

### 1. Sink node + actuator (`migrations/001_sink_nodes_actuators.sql`)

```bash
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring \
  -f database/monitoring/migrations/001_sink_nodes_actuators.sql
```

Migrasi ini akan:

1. Membuat tabel `sink_nodes` dan `actuator_logs`
2. Auto-generate 1 sink node per screenhouse (`SH01-SINK`, `SH02-SINK`, …)
3. Menambah kolom `sink_node_id` di `sensor_data`
4. Memindahkan status aktuator terakhir ke `sink_nodes`
5. Menghapus kolom `fan_status`, `irrigation_status`, `lamp_status` dari `sensor_data`

Aman dijalankan ulang (`IF NOT EXISTS`).

### 2. Dedup alert active (`data/migrate_alert_dedup_index.sql`)

Jalankan jika DB dibuat sebelum index `idx_alerts_active_dedup` ada di `schema.sql`:

```bash
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring \
  -f database/monitoring/data/migrate_alert_dedup_index.sql
```

Menutup duplikat alert `active` (simpan yang terbaru), lalu membuat unique partial index
`(screenhouse_id, sensor_node_id, message) WHERE status = 'active'`.

### 3. Kode tray legacy (`data/migrate_tray_node_codes.sql`)

Hanya untuk 3 screenhouse demo inti yang masih memakai `SHxx-Nxx`:

```bash
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring \
  -f database/monitoring/data/migrate_tray_node_codes.sql
```

Mengubah `SH01-N01` → `SH01-T01`, `SH01-N02` → `SH01-T02`, dst.
Jika simulasi MQTT/live tidak masuk DB (node tidak dikenali), jalankan script ini.

Setelah semua migrasi, **restart monitoring-service**:

```bash
cd services/monitoring-service && npm run dev
```

---

## Seed opsional

| File | Fungsi |
|------|--------|
| `seed.sql` | 3 screenhouse inti + histori 24 jam + 1 alert demo |
| `data/seed_sensor_history.sql` | Di-include otomatis dari `seed.sql` |
| `data/seed_live_demo.sql` | Inject reading `NOW()` untuk demo peta: SH01 Sehat, SH02 Peringatan, SH03 Kritis |

```bash
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring \
  -f database/monitoring/data/seed_live_demo.sql
```

---

## Reset penuh (opsional, data hilang)

```bash
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/schema.sql
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/seed.sql
```

Lalu sync registry jika perlu:

```bash
cd database/scripts && npm run sync:registry
```

---

## Tes MQTT setelah migrasi

**Telemetry tray → cloud (via sink):**

```bash
mosquitto_pub -h localhost \
  -t screenhouse/1/sink/SH01-SINK/sensor \
  -m '{
    "node_id": "SH01-T01",
    "destination_id": "SH01-SINK",
    "nitrogen": 24,
    "soil_moisture": 68,
    "soil_temperature": 26.5
  }'
```

**Status relay dari sink:**

```bash
mosquitto_pub -h localhost \
  -t screenhouse/1/sink/SH01-SINK/sensor \
  -m '{
    "node_id": "SH01-SINK",
    "destination_id": "SH01-SINK",
    "fan_status": true,
    "irrigation_status": false,
    "lamp_status": false
  }'
```

**Dengarkan perintah aktuator dari dashboard:**

```bash
mosquitto_sub -h localhost -t 'screenhouse/+/sink/+/command' -v
```
