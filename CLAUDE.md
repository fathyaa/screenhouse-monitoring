# CLAUDE.md

Konteks kerja untuk Claude Code di repo ini. Untuk instalasi/menjalankan service, baca `README.md` — dokumen ini fokus ke hal yang tidak langsung kelihatan dari kode.

## Apa ini

BibitLive — monitoring screenhouse pembibitan padi (sensor NPK, kelembapan, suhu, EC, cahaya) untuk 3 role: **petani**, **operator**, **super_admin**. React frontend + 2 backend service Node/Express + 2 Postgres DB terpisah + MQTT + Redis + Socket.IO.

## Arsitektur singkat

- `frontend/` — React + Vite + Tailwind, semua role dalam satu app, routing berbasis role di `App.jsx`.
- `services/app-service/` — identity (users, auth) + catalog (screenhouses, thresholds, semai_cycles, wilayah). DB `screenhouse_app` (port host 5434).
- `services/monitoring-service/` — ingest sensor via MQTT, alerting, realtime (Socket.IO), stats. DB `screenhouse_monitoring` (port host 5433).
- Kedua service komunikasi lewat **RabbitMQ** (topic exchange `shms.events`) dan HTTP langsung (app-service → monitoring-service via `MONITORING_SERVICE_URL`). **Redis sudah dihapus** — di kode lama ia murni message bus (`redisClient` dibuat tapi tak pernah dipakai), jadi tidak ada cache/session yang perlu dipindahkan.

## Satu artefak, banyak role

`monitoring-service` bukan satu proses lagi. Image yang sama dijalankan sebagai tujuh proses, dipilih lewat env `ROLE` (dispatcher di `src/index.js`, entrypoint di `src/roles/`):

| ROLE | Tugas | Replica |
|---|---|---|
| `collector` | MQTT → `q.ingest`; `q.device.command` → MQTT | **tepat 1** |
| `processing` | `q.ingest` → resolusi node → `sensor.raw` | bebas |
| `persistence` | `sensor.raw` → INSERT `sensor_data` → `sensor.persisted` | bebas |
| `alert` | `sensor.persisted` → threshold → `alert.created` | **tepat 1** |
| `realtime` | `sensor.persisted`/`alert.*` → Socket.IO | bebas |
| `scheduler` | cron deteksi node offline | **tepat 1** |
| `api` | HTTP `/sensor-data`, `/alerts`, `/stats` | bebas |

app-service punya dua role: `api` dan `notifikasi` (Web Push, dulu `pushWorker` di dalam proses API).

**Tiga role tidak boleh ditambah replica-nya**, dan alasannya berbeda-beda:
1. `collector` — subscriber MQTT menerima *setiap* pesan pada topik yang cocok, jadi replica kedua menggandakan seluruh data sensor. Kalau butuh >1, pakai shared subscription MQTT v5 (`$share/grup/topik`), bukan load balancer.
2. `alert` — histeresis membaca-lalu-menulis status alert, dan cache ambangnya lokal.
3. `scheduler` — dua pemindaian bersamaan = alert offline ganda. Jalan yang benar kalau butuh HA: `pg_try_advisory_lock` di awal siklus.

## Kenapa alert ada di hilir persistence, bukan sejajar

`alerts.sensor_data_id` adalah foreign key ke `sensor_data(id)` (serial). Listener alert butuh id baris yang baru ada setelah `persistence` commit — makanya ia berlangganan `sensor.persisted`, bukan `sensor.raw`. Jangan "memperbaiki" ini jadi paralel tanpa lebih dulu mengganti PK `sensor_data` ke UUID yang dibuat di `processing`.

## Trade-off performa arsitektur listener (baca sebelum menjanjikan "lebih cepat")

Arsitektur ini **lebih lambat per pesan** daripada jalur direct yang lama, dan itu bukan bug yang bisa dituning habis. Direct dulu: MQTT → panggil fungsi → INSERT. Sekarang: MQTT → publish `q.ingest` → consume → publish `sensor.raw` → consume → INSERT → publish `sensor.persisted` → consume. **Tiga round-trip broker + tiga tulisan durable** menggantikan nol.

Konsekuensinya:

- **Beban rendah: arsitektur lama menang**, selalu. Tidak ada yang jenuh, jadi hop tambahan murni jadi latency tambahan tanpa imbalan.
- **Beban tinggi: menang HANYA kalau leher botolnya CPU aplikasi, bukan Postgres.** Kalau `persistence` ditambah replica tapi Postgres sudah jenuh, tidak ada yang bertambah — direct tetap unggul di setiap tingkat beban. Di `prod-sim`, postgres-monitoring cuma dapat 1 OCPU; besar kemungkinan dialah leher botolnya.
- Dengan `--scale persistence=1`, arsitektur ini **pasti kalah**. Ia baru impas sekitar 2 replica dan baru untung di 3+.

Keunggulan yang tidak bersyarat ada di tempat lain, dan semuanya soal keandalan, bukan kecepatan: burst diserap antrean alih-alih menggelembungkan memori proses; Postgres restart tidak menghilangkan pesan; kegagalan alert tidak menghentikan ingest; deploy satu role tidak memutus WebSocket petani.

**Jangan menjual arsitektur ini sebagai "lebih cepat".** Klaim yang bisa dipertahankan adalah **Acceptance Rate** (`Accepted/Sent`) — metrik utama di `docs/evaluasi-kualitas/stress-test-matriks.md`. Burst 15–30 detik diserap habis oleh antrean, jadi acceptance tetap ~100% pada laju yang sudah membuat direct menolak pesan.

**Jebakan alokasi CPU (sudah pernah memakan waktu):** `docker-compose.prod-sim.yaml` memakai `cpuset` — seluruh role monitoring dipatok ke core 0 dan berbagi dinamis. **Jangan** menggantinya dengan plafon `cpus:` per role. Versi pertama membagi 1 OCPU jadi tujuh plafon terpisah (persistence 0,25 dst), dan hasilnya S6 cuma 23,4 pesan/detik dengan delivery 37,8% — sepuluh kali lebih buruk dari direct. Yang terukur bukan arsitektur, melainkan plafon buatan: peran yang jadi leher botol tidak boleh melewati 25% CPU sekalipun enam peran lain menganggur. Worker node sungguhan berbagi core.

Konsekuensi yang disengaja: dengan `cpuset`, `--scale persistence=4` **tidak menambah anggaran**. Sweep replica yang ingin menunjukkan skala horizontal harus dijalankan **tanpa** override prod-sim, dan dilaporkan terpisah sebagai pengujian mekanisme — bukan kapasitas produksi.

**Jebakan pengukuran:** hitung `COUNT(sensor_data)` **setelah `q.persist` kosong**, bukan tepat saat burst berakhir. Kalau tidak, baris yang masih mengantre terbaca sebagai pesan hilang, dan arsitektur ini akan terlihat jauh lebih buruk daripada kenyataannya. Cek dengan `docker exec screenhouse-rabbitmq rabbitmqctl -q list_queues name messages`.

## Queue realtime sengaja tidak durable

`q.realtime.{instance}` non-durable + auto-delete + TTL 30 detik, berbeda dari semua queue lain. Kalau dibuat durable, gateway yang mati lima menit menumpuk ribuan pembacaan basi lalu memuntahkannya ke browser saat hidup lagi. Untuk aliran ini, membuang pesan yang tak ada penerimanya adalah perilaku yang **benar**.
- **`screenhouse_id` disinkron manual antar 2 DB** — bukan foreign key sungguhan, cuma konvensi. Kalau bikin data seed/migrasi yang menyentuh screenhouse, wajib insert row yang konsisten di kedua DB dengan id yang sama.

## Sebelum menulis seed data / migrasi

DB dev ini bukan database kosong — sudah ada data load-test dalam jumlah besar (ratusan user & screenhouse). **Selalu `SELECT MAX(id)`** di tabel terkait (`screenhouses`, `thresholds`, `semai_cycles` di app db; `screenhouse_registry`, `sink_nodes`, `sensor_nodes` di monitoring db) sebelum memilih id baru — jangan asumsikan id kecil (1-3) masih kosong.

## Format pesan alert (jangan diubah tanpa update kedua sisi)

Backend generate pesan alert dengan pola persis: `"{label} di bawah batas minimum"` / `"{label} melebihi batas maksimum"`, label berbahasa Indonesia (Nitrogen, Phosphorus, Potassium, Kelembapan tanah, Suhu tanah, pH tanah, Konduktivitas, Suhu udara, Kelembapan udara, Intensitas cahaya). Frontend **mem-parsing string ini via keyword-matching** di `frontend/src/constants/actuatorRules.js` (`getActuatorHintForAlert`, `isAutoHandledAlert`) untuk menentukan apakah alert "ditangani otomatis" oleh aktuator. Kalau ubah label/format pesan di backend, update juga keyword matching di file itu.

## Alert hysteresis

`services/monitoring-service/src/modules/alerting/alertEngine.js` pakai margin 5% (`HYSTERESIS_RATIO`) antara nilai pelanggaran dan nilai pemulihan supaya alert tidak flapping (create → resolve → create berulang) saat sensor berosilasi di sekitar threshold.

## gh01: slot aktuator `fan` dipinjam untuk katup irigasi tray 2

Perangkat gh01 (screenhouse 700) punya **dua katup irigasi** — `valve1` = tray 1, `valve2` = tray 2 — sementara `sink_nodes` cuma punya tiga kolom status (`fan_status`, `irrigation_status`, `lamp_status`). Supaya tidak perlu kolom/migrasi baru, katup tray 2 memakai slot `fan_status`. Pemetaannya di `deviceBridge.js` (`VALVE_BY_ACTUATOR` / `ACTUATOR_BY_VALVE`).

Konsekuensi yang wajib dijaga kalau menyentuh area ini:

1. **gh01 harus tetap ada di `AUTO_ACTUATOR_EXCLUDE`.** Rule otomatis di `shared/actuatorRules.js` memetakan suhu/kelembapan udara tinggi → `fan: true`; di gh01 itu berarti membuka katup air tray 2 (tray kebanjiran di hari panas). Rule otomatis juga belum tahu tray mana yang kering — alert membawa `sensor_node_id`, tapi `setActuators` masih per-screenhouse — jadi irigasi gh01 sengaja manual dulu.
2. **Label ke petani di-override lewat env**, bukan hardcode: `ACTUATOR_CAPABILITIES=700:irrigation=Irigasi Tray 1|fan=Irigasi Tray 2`. Frontend (`ActuatorControls.jsx`) memilih ikon & kalimat konfirmasi dari label itu, jadi tombolnya tidak pernah tampil sebagai "Kipas".
3. **Env `ACTUATOR_CAPABILITIES` harus sama persis di kedua service.** app-service memakainya (`shared/actuatorCapabilities.js`, parser terpisah tanpa label) supaya laporan wilayah & `analytics.actuators[]` tidak menghitung slot pinjaman itu sebagai kipas.

Kalau nanti butuh irigasi otomatis per tray, jalan yang benar adalah kolom kanal (mis. `irrigation_channels JSONB` di `sink_nodes` + `actuator_logs`) dengan `irrigation_status` tetap jadi agregat OR — bukan menambah slot pinjaman baru.

## Data siklus semai (`semai_cycles.analytics`)

Kolom JSONB, dihasilkan `cycleAnalyticsService.js`, struktur: `{durasi, uptime, stability[], stress, actuators[], grade, computed_at}`. Dipakai di halaman Riwayat Semai & Detail Siklus petani, serta laporan operator (termasuk export PDF).

## Prinsip desain UI/UX (berlaku di semua halaman petani)

Ditetapkan dari audit UX menyeluruh setelah seorang petani uji-coba bilang "ngga ngerti":

1. Bahasa awam dulu, angka teknis jadi detail sekunder — setiap skor/grade harus ada kalimat verdict di sampingnya, bukan cuma angka.
2. Progressive disclosure — layar utama cuma jawab 3 hal: bibit gimana, perlu ngapain, kapan siap tanam. Detail teknis (NPK mentah, EC, uptime%) disembunyikan di balik "lihat detail".
3. Penjelasan selalu terlihat (teks kecil permanen / expand), **jangan** cuma `title=""` tooltip — tidak berfungsi di HP/layar sentuh.
4. Satu istilah konsisten di semua tempat ("Kata sandi", bukan campur "Password"); satu pola notifikasi error (toast `react-hot-toast`, bukan `alert()` browser).
5. Pola ikon + warna + kalimat pendek untuk status, bukan angka/badge mentah tanpa konteks.
6. Setiap parameter bermasalah wajib dipasangkan salah satu: "ditangani otomatis" atau instruksi konkret — jangan tampilkan status tanpa arah tindakan.
7. Hindari section yang duplikat info yang sudah ada di tempat lain — mis. dashboard petani sempat punya ringkasan alert besar di paling atas yang tumpang tindih dengan lonceng notifikasi (topbar) + banner per-kartu screenhouse; sudah dihapus karena redundan.

## Layout dashboard petani

`PetaniDashboard.jsx` sengaja **full-width, tanpa max-width cap** — pernah dicoba dibatasi (`max-w-3xl mx-auto`) lalu direvert eksplisit atas permintaan user. Jangan tambahkan cap lebar lagi kecuali diminta ulang. Kolom insight ringkasan (`DashboardInsightPanel`) ada di kiri (`lg:sticky`), daftar kartu screenhouse di kanan.

## Verifikasi setelah edit frontend

Tidak ada test suite (`npm test` di kedua service backend cuma placeholder). Cara verifikasi standar:

```bash
cd frontend
npx eslint src/path/to/file.jsx   # lint file yang diubah
npm run build                      # full production build sebagai smoke test
```

Build sukses + lint bersih dianggap "selesai" untuk perubahan frontend murni — tidak ada browser testing otomatis, jadi untuk perubahan visual besar sebaiknya diminta dicek manual di `npm run dev` (port 5173/5174).

## Verifikasi setelah edit backend

Tidak ada test suite. Cara paling cepat membuktikan pipeline masih utuh: jalankan role sebagai **proses host** terhadap container infrastruktur yang sudah hidup (postgres 5433, rabbitmq 5672, mosquitto 1883) — jauh lebih cepat daripada menunggu `docker compose build`, dan menguji kodenya, bukan Dockerfile-nya.

```bash
cd services/monitoring-service
for r in collector processing persistence alert; do
  ROLE=$r node src/index.js > /tmp/role-$r.log 2>&1 &
done
# publish ke screenhouse/93/sensor dengan node_code SH93-T01, lalu:
psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring \
  -c "SELECT id, nitrogen, created_at FROM sensor_data WHERE sensor_node_id=93 ORDER BY id DESC LIMIT 5;"
```

Cek topologi antrean sekaligus: `docker exec screenhouse-rabbitmq rabbitmqctl -q list_bindings source_name routing_key destination_name`.

Dua jebakan yang sudah pernah menghabiskan waktu:

1. **`.env` lokal menimpa env yang di-export.** Kalau queue yang terbentuk bernama aneh (mis. `sensor-ingest` alih-alih `q.ingest`), curigai `.env` dulu. Salinan sebelum redesign ada di `.env.bak-pra-redesign`.
2. **Container RabbitMQ bisa "Up" padahal node Erlang di dalamnya mati** (terjadi setelah Docker Desktop me-resume container lama). `docker compose ps` tetap hijau; yang jujur adalah `docker exec screenhouse-rabbitmq rabbitmq-diagnostics -q check_running`. Gejalanya `ECONNRESET` saat connect, bukan pesan auth.

Bersihkan data sintetis setelah selesai — hapus `alerts` yang menunjuk baris uji **sebelum** `sensor_data` (ada FK `alerts.sensor_data_id`).

## Uji beban: kondisi wajib dicatat, dan run lama tidak memilikinya

Tiap file di `load-test-monitoring/results/` sekarang menyimpan blok `environment` (batas CPU/memori per container, jumlah replica, branch, commit). **Seluruh hasil sebelum 6 Agustus 2026 tidak memilikinya**, jadi tidak bisa dibuktikan memakai batas yang sama — `reporter/generate-arsitektur.js` menandainya `unknown` dan memperlakukannya sebagai data pendahuluan. Jangan mengutipnya sebagai hasil final.

Dua laporan, jangan tertukar:
- `report-compare.html` — dua mode ingest dalam satu arsitektur, satu run per skenario
- `report-arsitektur.html` — lintas arsitektur (`direct`, `rabbitmq`, `listener@N`), beberapa run per konfigurasi dengan median + rentang, dan **dipisah per profil resource** supaya angka 1 OCPU tidak pernah sekolom dengan angka tanpa batas

Metrik yang selamat dari perubahan arsitektur adalah `databaseDeliveryRatePct` (`dbRows/sent`) — ia menghitung baris database langsung, bukan counter internal. Sisanya (`processRatePerSec`, `latencyP95Ms`, `rssMbMax`) bergantung pada agregasi `metrics.report`; kalau nol, curigai role `api` tidak menerima laporan, bukan pipeline yang mati.

## PWA / Service Worker (dev)

`vite-plugin-pwa` diset `devOptions.enabled: true` — service worker aktif bahkan saat `npm run dev`. Kalau perubahan UI tidak muncul di browser padahal source sudah berubah dan build sukses, curigai cache SW dulu (hard refresh / unregister SW di DevTools) sebelum mengira ada bug di kode.

## Role & routing

3 role: `petani`, `operator`, `super_admin` — dicek dari JWT + `role` di record user, redirect diatur di `frontend/src/App.jsx`. Halaman utama per role:

- **Petani**: `PetaniDashboard`, `ScreenhouseDetailPage`, `NotifikasiPage`, `PetaniRiwayatSemaiPage`, `SemaiCycleDetailPage`, `PetaniAjukanScreenhousePage`.
- **Operator**: `OperatorDashboard` (peta + list realtime), `OperatorLaporanPage` (laporan wilayah + export PDF/CSV via `utils/exportReportPdf.js`).
- **Super admin**: `ThresholdPage`, `KelolaUserPage`, `KelolaScreenhousePage`, `DaftarPetaniPage` — menu sidebar dikelompokkan section "Admin" vs "Operator".

Form pendaftaran screenhouse (saat register akun baru vs pengajuan tambahan oleh petani yang sudah login) berbagi field & validasi lewat `hooks/useScreenhouseFormFields.js` + `components/ScreenhouseFormFields.jsx`, tapi tetap punya chrome dan endpoint submit masing-masing (`/auth/register` vs `/screenhouses/mine`).

## Login demo

Password semua user demo: `123456`. Lihat `README.md` untuk nomor HP demo operator/petani. `database/app/seed_pak_eko_demo.sql` + `database/monitoring/seed_pak_eko_demo.sql` berisi user petani demo "Pak Eko" (screenhouse id 93-95) dengan data siklus semai & alert lengkap, khusus untuk testing tampilan UI tanpa perlu hardware/simulator.
