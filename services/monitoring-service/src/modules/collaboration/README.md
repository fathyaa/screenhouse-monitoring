# Kolaborasi Robot ↔ Sistem Monitoring melalui Sink Node

Bounded context `collaboration` di `monitoring-service` adalah **Collaboration Service**
pada model kolaborasi Smart Portable Screenhouse (proposal tesis: *Perancangan Model
Kolaborasi dan Orkestrasi Misi Lengan Robot melalui Sink Node untuk Penyeragaman Mutu
pada Smart Portable Screenhouse Pembibitan Padi*). Layanan ini:

- menerbitkan misi inspeksi;
- memelihara ketersediaan robot (satu misi aktif per screenhouse);
- mencatat siklus hidup misi;
- menyimpan hasil penilaian mutu bibit per tray dari model computer vision robot.

```
Sensor WSN (per tray) ─LoRa─┐                                   ┌─ collector ─┬─ q.ingest → processing → persistence (sensor_data) → alert/realtime
Collaboration Agent ─Wi-Fi──┤ Sink node ── MQTT (Mosquitto) ────┤             └─ q.collab → collaboration → robot_* / tray_inspections / actuation_events
 (Jetson Nano + ROS 2)      │ (store-and-forward)               └─ q.device.command ← api (POST /missions) ← dashboard
```

## Kontrak MQTT (Tabel 3.3)

| Topik | Arah | Payload | Disimpan ke |
|---|---|---|---|
| `telemetry/env` | sink → cloud | `{h_id, n_id, seq, ts, sn, sm, ah, t, uv}` | `sensor_data` (lewat jalur ingest yang ada) |
| `mission/command` | cloud → sink | `{m_id, h_id, cmd, trays, crit_lvl, ts}` | `robot_missions` |
| `mission/status` | sink → cloud | `{m_id, r_id, st, cur_tray, pct, bat, seq, ts}` | `robot_mission_events` + ringkasan `robot_missions` |
| `mission/result` | sink → cloud | `{m_id, h_id, tray_id, label, conf, h_cm, anom, seq, ts}` | `tray_inspections` |
| `actuator/control` | sink → cloud | `{h_id, act_id, action, dur_s, trig, seq, ts}` | `actuation_events` |

Ketentuan kontrak:
- `ts` adalah epoch milidetik (detik juga diterima).
- `st` bernilai `ACCEPTED | IN_PROGRESS | COMPLETED | FAILED | REJECTED | BUFFERED_OFFLINE`;
  status misi di cloud dapat juga `CANCELLED` (dibatalkan operator, terminal — status robot
  yang datang belakangan tidak menimpanya).
- `label` bernilai `BAGUS | TIDAK_BAGUS`.
- Nama topik dapat diganti lewat env `COLLAB_TOPIC_*`; seluruh modul dimatikan dengan
  `COLLAB_ENABLED=false`.

**Identitas:**
- `h_id` adalah kode rumah bibit. Sink node-nya `<h_id>-SINK`, misalnya `SH90-SINK`.
- `n_id` sama dengan `sensor_nodes.node_code`, misalnya `SH90-T01`.
- Tray `n` pada hasil inspeksi ditautkan ke node `<h_id>-Tnn`.

**Pemetaan telemetri:**

| Payload | Kolom `sensor_data` |
|---|---|
| `sn` | `nutrient` |
| `sm` | `soil_moisture` |
| `ah` | `air_humidity` |
| `t` | `air_temperature` |
| `uv` | `uv_index` |

Ambang & alert yang sudah ada (mis. kelembapan tanah) otomatis berlaku.

**Idempotensi.** Kunci `idemp_key` dibentuk dari house_id + mission_id/node_id + seq:

| Pesan | Format `idemp_key` |
|---|---|
| telemetri | `h/n/tel/seq` |
| status | `m/r/st/seq` |
| hasil | `h/m/res/seq` |
| aktuasi | `h/act/act/seq` |

Kolomnya UNIQUE, sehingga replay store-and-forward dari sink node tidak menggandakan baris.

## API (lewat app-service `/missions` atau langsung monitoring-service)

| Metode & path | Fungsi |
|---|---|
| `POST /missions/screenhouse/:id` `{trays?, crit_lvl?, force?}` | Terbitkan misi. `trays` default = semua tray ber-node `<h_id>-Tnn`. Mengembalikan 409 bila robot masih punya misi aktif (< `COLLAB_MISSION_STALE_MIN`, default 60 menit) |
| `POST /missions/:missionCode/cancel` | Batalkan misi non-terminal: status → `CANCELLED`, kirim `{m_id, cmd:"ABORT"}` lewat `q.device.command` ke sink node/robot (robot berhenti, misi berikutnya dapat diterbitkan). 409 bila misi sudah terminal |
| `GET /missions/screenhouse/:id?limit=20` | Riwayat misi + jumlah tray terinspeksi/bermasalah |
| `GET /missions/:missionCode` | Detail misi + riwayat status + hasil per tray |
| `GET /missions/screenhouse/:id/inspections/latest` | Hasil terbaru per tray |
| `GET /missions/screenhouse/:id/actuations?limit=50` | Riwayat aktuasi lokal sink node |

Semua endpoint memerlukan JWT. Petani hanya dapat mengakses screenhouse miliknya.

Realtime: Socket.IO memancarkan `mission-update`, `inspection-update`, dan
`actuation-update` ke room pemilik screenhouse. Dashboard menampilkannya di panel
**Inspeksi Mutu Bibit oleh Robot** pada halaman detail screenhouse.

## Menjalankan

Panduan lengkap langkah demi langkah (backend + simulasi Gazebo/ROS 2 + program uji):
`PANDUAN_MENJALANKAN.md` di repo tesis (`irfahadi/tesis`).


1. Migrasi DB, dan seed SPS simulasi bila perlu: lihat `database/README.md`.
2. Jalankan role baru `ROLE=collaboration` (sudah ada di `docker/docker-compose.yaml`).
3. Simulasi lengkap: Gazebo + ROS 2 Humble, emulator sink node, WSN 4 tray, dan program
   uji. Semuanya tersedia di repo tesis `irfahadi/tesis`, berkas
   `config.screenhouse-monitoring.yaml`.

Uji unit kontrak: `cd services/monitoring-service && npm run test:collab`.
