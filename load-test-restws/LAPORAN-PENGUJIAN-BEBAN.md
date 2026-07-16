# Laporan Pengujian Beban Sistem BibitLive

**Jenis pengujian:** Load Testing (Pengujian Non-Fungsional)  
**Alat:** Grafana k6 v2.1.0  
**Tanggal:** 13 Juli 2026 (run representatif dengan seed data per-petani)  
**Skrip:** `load-tests/k6-bibitlive-dashboard.js`  
**Status:** ✅ **SEMUA KRITERIA NFR TERPENUHI**

---

## 1. Latar Belakang dan Tujuan

Sistem **BibitLive** (Screenhouse Monitoring) melayani dashboard web bagi petani pembibitan padi untuk memantau kondisi screenhouse secara realtime. Seiring bertambahnya jumlah pengguna, sistem harus mampu menangani akses bersamaan tanpa degradasi kinerja yang signifikan.

Pengujian beban ini dilakukan untuk memvalidasi **Non-Functional Requirements (NFR)** pada skenario **555 pengguna virtual (Virtual Users / VU)** yang mengakses dashboard secara simultan, meliputi:

1. Permintaan **REST API** (data dashboard dan riwayat siklus semai)
2. Koneksi **Socket.IO** persisten untuk streaming data sensor dan notifikasi alert secara realtime

---

## 2. Lingkungan Pengujian

### 2.1 Arsitektur Target Uji

```txt
[k6 Load Generator — MacBook lokal]
        │
        ├── HTTP :8000 ──► App Service (Express.js)
        │                      │
        │                      ├── PostgreSQL screenhouse_app (:5434)
        │                      └── Proxy ──► Monitoring Service
        │
        └── WebSocket :3001 ──► Monitoring Service (Socket.IO)
                                    │
                                    ├── PostgreSQL screenhouse_monitoring (:5433)
                                    └── Redis (:6379)
```

### 2.2 Komponen yang Dijalankan

| Komponen | Port | Keterangan |
|----------|------|------------|
| App Service | 8000 | REST API + JWT auth + proxy monitoring |
| Monitoring Service | 3001 | Socket.IO realtime + ingest pipeline |
| PostgreSQL (App) | 5434 | Katalog user, screenhouse, siklus semai |
| PostgreSQL (Monitoring) | 5433 | Sensor data, alert, registry |
| Redis | 6379 | Event bus antar service |
| Docker Compose | — | Infrastruktur database & cache |

### 2.3 Isolasi Lingkungan

Agar metrik merepresentasikan beban akses dashboard semata, komponen berikut **dimatikan** selama pengujian:

- Simulator sensor (`npm run simulate`)
- Publisher MQTT / firmware ESP32
- Frontend Vite (tidak diperlukan — k6 menguji API langsung)

### 2.4 Data Uji

- **555 akun petani** dibuat melalui `STRESS_FARMER_COUNT=555 npm run seed:stress`
- Nomor telepon: `081300000001` s.d. `081300000555`
- Password: `123456`
- Setiap VU dipetakan ke satu akun secara round-robin

### 2.5 Spesifikasi Mesin Penguji

| Item | Nilai |
|------|-------|
| OS | macOS (darwin 25.2.0, ARM64) |
| k6 | v2.1.0 |
| Node.js | v24.10.0 |
| Mode eksekusi | Lokal (load generator dan backend pada mesin yang sama) |

---

## 3. Metodologi Pengujian

### 3.1 Profil Beban (Load Profile)

Pengujian menggunakan executor **ramping-vus** dengan tiga tahap:

| Tahap | Durasi | Virtual Users | Deskripsi |
|-------|--------|---------------|-----------|
| **Stage 1 — Ramp-up** | 2 menit | 0 → 555 | Simulasi lonjakan pengguna masuk |
| **Stage 2 — Sustained load** | 5 menit | 555 (konstan) | Beban puncak stabil |
| **Stage 3 — Ramp-down** | 1 menit | 555 → 0 | Simulasi pengguna keluar |
| **Total skenario** | **8 menit** | **maks. 555 VU** | + graceful ramp-down 30 detik |

### 3.2 Skenario Perilaku Pengguna (User Journey)

Setiap Virtual User mensimulasikan satu sesi petani yang membuka dashboard, diulang dalam loop selama durasi pengujian:

| Urutan | Aksi | Endpoint / Protokol |
|--------|------|---------------------|
| 0 | Login (sekali per sesi VU) | `POST /auth/login` |
| A | Muat daftar screenhouse | `GET /screenhouses/my-screenhouses` |
| B | Muat riwayat siklus semai | `GET /screenhouses/my-cycles?status=completed` |
| — | Muat sensor terbaru | `GET /sensor-data/latest` |
| C | Koneksi realtime | Socket.IO → event `authenticate` + dengar broadcast |
| D | Think time | Jeda acak **1–3 detik** sebelum iterasi berikutnya |

Koneksi Socket.IO dipertahankan selama **20 detik** per iterasi, sesuai pola penggunaan dashboard yang membuka halaman dan menerima pembaruan telemetry.

### 3.3 Kriteria Keberhasilan (NFR Thresholds)

| Metrik k6 | Kriteria Lulus | Dasar |
|-----------|----------------|-------|
| `http_req_failed` | **< 1%** | Reliabilitas — hampir semua request HTTP sukses |
| `http_req_duration` p(95) | **< 2000 ms** | Responsivitas — 95% request di bawah 2 detik |
| `ws_connection_errors` | **= 0** | Stabilitas koneksi realtime |

### 3.4 Anatomi Skrip Load Generator (k6)

k6 adalah sebuah **load generator**: program yang membangkitkan banyak pengguna virtual (Virtual User / VU) sekaligus, lalu menjalankan skenario perilaku yang sama pada tiap VU secara berulang sambil merekam metrik performa. Berbeda dari browser, k6 tidak me-render halaman — ia langsung menembak endpoint HTTP dan membuka koneksi WebSocket, sehingga yang terukur murni beban sisi server. Seluruh perilaku didefinisikan dalam satu berkas `load-tests/k6-bibitlive-dashboard.js`. Bagian berikut membedah komponen kuncinya.

#### 3.4.1 Konfigurasi beban (`options`)

Objek `options` menetapkan profil beban dan kriteria lulus. Executor `ramping-vus` menaikkan jumlah VU mengikuti tahap yang ditentukan, sementara `thresholds` adalah ambang NFR yang membuat k6 menandai pengujian gagal bila dilanggar.

```js
export const options = {
  scenarios: {
    bibitlive_dashboard: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 555 }, // ramp up
        { duration: "5m", target: 555 }, // sustained
        { duration: "1m", target: 0 },   // ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
    ws_connection_errors: ["count==0"],
  },
};
```

#### 3.4.2 Siklus hidup satu Virtual User

Fungsi default diekspor sebagai badan iterasi: k6 memanggilnya berulang untuk setiap VU selama pengujian. Satu iterasi mewakili satu putaran seorang petani membuka dashboard. Tiap VU dipetakan ke satu akun uji melalui `(__VU - 1) % USERS.length`. Alur satu iterasi dapat digambarkan sebagai berikut:

```txt
ramping-vus:  0 ──▶ 555 VU   (ramp-up 2m · sustained 5m · ramp-down 1m)
                │
                ▼   setiap VU mengulang loop berikut sampai durasi uji habis
═════════════ SATU ITERASI VU (≈ satu petani membuka dashboard) ═════════════

  [0] login (sekali per VU, JWT di-cache)
       POST /auth/login  ──▶  { token, userId }
       │   ↺ diulang tiap iterasi bila RELOGIN_EACH_ITER=1
       ▼
  [A] GET /screenhouses/my-screenhouses             → check 200 & tidak kosong
       ▼
  [B] GET /screenhouses/my-cycles?status=completed  → check 200
       ▼
  [C] GET /sensor-data/latest                       → check 200
       ▼
  [D] Socket.IO  (hanya bila WS_HOLD_SEC > 0)
       handshake : terima 0 ─▶ kirim 40 ─▶ terima 40 ─▶ emit "authenticate"
       hold 20s  : dengar paket 42 (event sensor-update, dst)
       tutup     : kirim 41 ─▶ close  (gagal upgrade/putus → ws_connection_errors++)
       ▼
  [E] think time : sleep 1–3 detik (jeda acak menirukan manusia)
       │
       └────▶ kembali ke [A]  (token tetap dari cache)
═════════════════════════════════════════════════════════════════════════════
```

Secara kode, iterasi tersebut ditulis sebagai berikut:

```js
export default function () {
  const user = USERS[(__VU - 1) % USERS.length];

  // Login di-cache per VU (meniru sesi browser yang menyimpan JWT)
  if (!vuSession || RELOGIN_EACH_ITER) {
    vuSession = login(user);
  }
  if (!vuSession) { sleep(1); return; }

  const headers = authHeaders(vuSession.token);

  // Tiga permintaan yang dilakukan dashboard petani saat dimuat
  const dashRes = http.get(DASHBOARD_URL, { headers, tags: { name: "GET /screenhouses/my-screenhouses" } });
  const cyclesRes = http.get(CYCLES_HISTORY_URL, { headers, tags: { name: "GET /screenhouses/my-cycles" } });
  const sensorRes = http.get(LATEST_SENSOR_URL, { headers, tags: { name: "GET /sensor-data/latest" } });

  // Verifikasi respons supaya kegagalan / data kosong tidak lolos diam-diam
  check(dashRes, {
    "dashboard 200": (r) => r.status === 200,
    "dashboard not empty": (r) => Array.isArray(r.json()) && r.json().length > 0,
  });
  check(cyclesRes, { "cycles 200": (r) => r.status === 200 });
  check(sensorRes, { "latest sensor 200": (r) => r.status === 200 });

  // Koneksi realtime (dilewati bila WS_HOLD_SEC=0)
  if (WS_HOLD_SEC > 0) connectSocketIO(vuSession.userId);

  sleep(1 + Math.random() * 2); // think time 1–3 detik
}
```

Keputusan desain yang penting:

- **Login di-cache per VU.** Variabel `vuSession` bertahan antar iterasi, meniru sesi browser yang menyimpan JWT. Set `RELOGIN_EACH_ITER=1` untuk memaksa login tiap iterasi bila biaya autentikasi (bcrypt) ingin ikut terukur di bawah beban.
- **Tiga permintaan GET** meniru yang dilakukan dashboard petani saat dimuat: daftar screenhouse, riwayat siklus semai, dan sensor terbaru.
- **Verifikasi respons** lewat `check`. Selain status 200, cek "dashboard not empty" menjaga agar data kosong (mis. akun tanpa screenhouse) tidak lolos diam-diam lalu membuat latensi tampak bagus secara palsu.
- **Think time** acak 1–3 detik menirukan jeda manusia sebelum aksi berikutnya.

#### 3.4.3 Login dan token

```js
function login(user) {
  const res = http.post(LOGIN_URL, JSON.stringify({
    phone_number: user.phone_number, password: user.password,
  }), { headers: { "Content-Type": "application/json" }, tags: { name: "POST /auth/login" } });

  const ok = check(res, {
    "login status 200": (r) => r.status === 200,
    "login has token": (r) => Boolean(r.json("token")),
  });
  if (!ok) return null;
  return { token: res.json("token"), userId: String(res.json("user.id")) };
}
```

Token JWT hasil login dipakai sebagai header `Authorization: Bearer` pada seluruh permintaan berikutnya (`authHeaders`).

#### 3.4.4 Koneksi realtime Socket.IO

Bagian inilah yang membedakan pengujian dari sekadar memukul REST. Socket.IO berjalan di atas protokol Engine.IO, sehingga koneksi WebSocket mentah harus melewati handshake berupa urutan paket bertanda angka: paket `0` (open) dibalas `40` (connect namespace), server lalu mengirim `40` (connected) yang dibalas dengan emit `authenticate`, dan paket `42[...]` adalah event aplikasi seperti `sensor-update`.

```js
socket.on("message", (raw) => {
  const data = String(raw);
  if (data.startsWith("0") && !connected) { connected = true; socket.send("40"); return; }
  if (data.startsWith("40") && !authenticated) {
    authenticated = true;
    socket.send(`42["authenticate",{"userId":"${userId}"}]`);
    return;
  }
  if (data.startsWith("42")) wsMessagesReceived.add(1);
});
```

Koneksi ditahan selama `WS_HOLD_SEC` (bawaan 20 detik) meniru dashboard yang terbuka menerima pembaruan, lalu ditutup rapi dengan paket `41`. Setiap kegagalan upgrade (status bukan HTTP 101) atau putus sebelum terautentikasi dicatat ke penghitung `ws_connection_errors`. Menyetel `WS_HOLD_SEC=0` melewati bagian ini untuk profil khusus throughput API.

#### 3.4.5 Metrik kustom

Di luar metrik bawaan k6, dibuat dua penghitung tambahan:

```js
const wsConnectionErrors = new Counter("ws_connection_errors");
const wsMessagesReceived = new Counter("ws_messages_received");
```

`ws_connection_errors` menjadi salah satu ambang NFR (harus nol), sedangkan `ws_messages_received` menghitung event aplikasi yang benar-benar tiba di klien.

> **Catatan validitas.** Angka pada Bagian 4 berasal dari run **13 Juli 2026** yang sudah memakai skrip terkini (dengan verifikasi respons GET) dan data uji representatif: seluruh 555 akun petani di-seed lewat mode `STRESS_PER_FARMER=1` sehingga masing-masing memiliki screenhouse, reading sensor, dan siklus semai. Konsekuensinya, ketiga endpoint dashboard mengembalikan data nyata (bukan array kosong), dan cek `dashboard not empty` lolos 100%. Latensi pada run ini lebih tinggi daripada run awal 6 Juli justru karena kueri kini benar-benar mengambil data, sehingga angkanya lebih sahih untuk dijadikan acuan.

---

## 4. Hasil Pengujian

**Durasi eksekusi:** 8 menit 17 detik (termasuk graceful stop)  
**Total iterasi selesai:** 10.095  
**Virtual Users maksimum:** 555  
**Exit code k6:** 0 (sukses)

### 4.1 Ringkasan Kriteria NFR

| Metrik | Hasil | Threshold | Status |
|--------|-------|-----------|--------|
| HTTP failure rate | **0,00%** (0 / 30.840) | < 1% | ✅ **LULUS** |
| HTTP latency p(95) | **37,67 ms** | < 2000 ms | ✅ **LULUS** |
| WebSocket connection errors | **0** | = 0 | ✅ **LULUS** |

### 4.2 Detail Metrik HTTP

| Statistik | Nilai |
|-----------|-------|
| Total request HTTP | 30.840 |
| Throughput | 62,04 req/detik |
| Rata-rata (`avg`) | 9,34 ms |
| Median (`med`) | 3,48 ms |
| Persentil ke-90 (`p90`) | 11,3 ms |
| Persentil ke-95 (`p95`) | **37,67 ms** |
| Minimum | 0,74 ms |
| Maksimum | 1,05 detik |
| Tingkat kegagalan | 0,00% |

Nilai maksimum 1,05 detik adalah outlier langka (satu request pada ekor distribusi); p(95) sebesar 37,67 ms menunjukkan 95% permintaan tetap di bawah ~38 ms.

### 4.3 Detail Metrik WebSocket (Socket.IO)

| Statistik | Nilai |
|-----------|-------|
| Total sesi WebSocket | 10.095 |
| Durasi sesi rata-rata | 20 detik (sesuai desain skrip) |
| Waktu koneksi rata-rata (`ws_connecting`) | 0,94 ms |
| Pesan diterima (`ws_msgs_received`) | 20.190 |
| Pesan dikirim (`ws_msgs_sent`) | 30.285 |
| Event aplikasi diterima (`sensor-update`, dll.) | 0 (simulator sensor dimatikan) |
| Error koneksi | **0** |

### 4.4 Validasi Checks

Seluruh **51.585** check lolos (**100% sukses, 0 gagal**). Tujuh jenis check dijalankan:

| Check | Hasil |
|-------|-------|
| Login status 200 | ✅ 100% (555 / 555) |
| Login memiliki token JWT | ✅ 100% (555 / 555) |
| Dashboard status 200 | ✅ 100% |
| **Dashboard tidak kosong** (data screenhouse terisi) | ✅ 100% |
| Riwayat siklus status 200 | ✅ 100% |
| Sensor terbaru status 200 | ✅ 100% |
| WebSocket upgrade HTTP 101 | ✅ 100% |
| **Total checks** | **51.585 — 100% sukses** |

Check **"dashboard tidak kosong"** lolos 100% membuktikan bahwa setiap VU mengakses akun petani yang benar-benar memiliki screenhouse, sehingga latensi yang terukur mencerminkan beban kueri nyata, bukan respons kosong. Login dilakukan sekali per VU, jadi 555 check login sesuai jumlah VU yang berhasil autentikasi.

### 4.5 Metrik Eksekusi

| Statistik | Nilai |
|-----------|-------|
| Durasi iterasi rata-rata | 22,04 detik |
| Iterasi per detik | 20,31 iter/s |
| Data diterima | 30 MB (61 kB/s) |
| Data dikirim | 12 MB (25 kB/s) |

Durasi iterasi ~22 detik sesuai desain: ~20 detik hold WebSocket + 1–3 detik think time + overhead HTTP. Data diterima naik menjadi 30 MB (dari 14 MB pada run data-kosong 6 Juli) karena endpoint kini mengembalikan payload screenhouse dan analitik siklus yang sesungguhnya.

---

## 5. Analisis dan Interpretasi

### 5.1 Kinerja HTTP

Pada beban **555 pengguna bersamaan**, sistem menunjukkan kinerja HTTP yang sangat baik. Persentil ke-95 waktu respons sebesar **37,67 ms** — jauh di bawah batas 2.000 ms (hanya sekitar **1,9%** dari threshold). Tidak terdapat satupun request HTTP yang gagal dari total **30.840** permintaan.

Angka p(95) ini lebih tinggi dibanding run awal 6 Juli (10,85 ms), dan itu justru pertanda hasil yang lebih sahih. Pada run 13 Juli setiap akun petani sudah memiliki screenhouse, sehingga endpoint `/my-screenhouses`, `/my-cycles`, dan `/sensor-data/latest` benar-benar menjalankan kueri dan mengembalikan payload nyata (termasuk analitik siklus dalam bentuk JSONB). Volume data diterima yang naik dari 14 MB ke 30 MB mengonfirmasi hal ini. Dengan kata lain, latensi 37,67 ms adalah biaya melayani data dashboard yang sesungguhnya, bukan angka semu dari respons kosong.

Hal ini menunjukkan bahwa App Service beserta koneksi ke PostgreSQL dan proxy ke Monitoring Service mampu menangani throughput ~62 request/detik dengan latensi p(95) di bawah 40 ms pada lingkungan uji lokal, meskipun tiap permintaan kini mengambil data screenhouse dan siklus yang lengkap.

### 5.2 Kinerja Realtime (Socket.IO)

Seluruh **10.095** sesi WebSocket berhasil dibuka (HTTP upgrade 101) tanpa error koneksi. Waktu pembukaan koneksi rata-rata hanya **0,94 ms**, menandakan Monitoring Service mampu menangani ribuan koneksi Socket.IO bersamaan secara stabil.

Tidak ada event aplikasi (`sensor-update`) yang diterima selama pengujian karena simulator sensor dimatikan — ini sesuai desain isolasi lingkungan. Pengujian fokus pada **kapasitas koneksi dan stabilitas channel**, bukan volume broadcast telemetry.

### 5.3 Perbandingan dengan Run Sebelumnya (Gagal)

Pada percobaan pertama yang dihentikan manual (Ctrl+C) pada menit ke-0:56, terdapat masalah:

| Masalah | Penyebab | Solusi |
|---------|--------|--------|
| `ws.connect` error | Modul `k6/experimental/websockets` tidak kompatibel dengan k6 v2 | Diganti ke `k6/ws` |
| Login gagal ~71% | Akun petani belum di-seed | `STRESS_FARMER_COUNT=555 npm run seed:stress` |
| Test terhenti | Ctrl+C manual | Dijalankan ulang dari awal |

---

## 6. Kesimpulan

Berdasarkan hasil pengujian beban dengan **555 Virtual Users** selama **8 menit** menggunakan Grafana k6, sistem **BibitLive memenuhi seluruh kriteria Non-Functional Requirements** yang ditetapkan:

| Aspek | Kesimpulan |
|-------|------------|
| **Reliabilitas** | Tingkat kegagalan HTTP 0,00% (< 1%) ✅ |
| **Responsivitas** | p(95) latensi HTTP 37,67 ms (< 2000 ms) ✅ |
| **Stabilitas realtime** | 0 error koneksi WebSocket pada 10.095 sesi ✅ |

Sistem mampu melayani **555 pengguna dashboard secara bersamaan** pada lingkungan uji lokal dengan kinerja yang sangat baik, baik untuk permintaan REST API maupun koneksi Socket.IO persisten.

---

## 7. Keterbatasan Pengujian

1. **Lingkungan lokal** — load generator (k6) dan backend berjalan pada mesin yang sama, sehingga CPU/RAM berbagi sumber daya. Hasil di lingkungan produksi (cloud/VPS terpisah) dapat berbeda.
2. **Tanpa render UI** — k6 menguji API dan WebSocket langsung, bukan rendering React di browser. Beban sisi klien (DOM, chart, PWA) tidak terukur.
3. **Tanpa ingest sensor paralel** — simulator MQTT dimatikan; pengujian tidak mencakup skenario beban gabungan (555 user + ribuan telemetry MQTT bersamaan).
4. **Virtual Users ≠ manusia nyata** — VU adalah goroutine simulasi dengan think time tetap; pola perilaku manusia sesungguhnya lebih variatif.
5. **Data uji sintetis** — akun petani dibuat oleh skrip seed, bukan data produksi.

---

## 8. Rekomendasi

1. **Ulangi pengujian** pada mesin terpisah (k6 di laptop lain, backend di server) untuk hasil yang lebih representatif.
2. **Pengujian kombinasi** — jalankan simulator sensor bersamaan dengan 555 VU untuk menguji skenario worst-case (dashboard + ingest telemetry).
3. **Stress test lanjutan** — tingkatkan VU di atas 555 untuk menemukan titik patah (breaking point) sistem.
4. **Monitoring infrastruktur** — pada pengujian berikutnya, catat penggunaan CPU, RAM, dan koneksi database secara paralel.

---

## Lampiran A — Perintah Menjalankan Ulang

```bash
# 1. Pastikan infrastruktur jalan
cd docker && docker compose up -d

# 2. Jalankan services
cd services/app-service && node src/index.js
cd services/monitoring-service && node src/index.js

# 3. Seed data representatif (setiap petani mendapat screenhouse + reading + siklus)
cd database/scripts
STRESS_FARMER_COUNT=555 STRESS_PER_FARMER=1 npm run seed:stress

# 4. Jalankan load test
cd load-tests
k6 run k6-bibitlive-dashboard.js

# 5. Export hasil ke JSON (opsional, untuk grafik)
k6 run --out json=hasil-load-test.json k6-bibitlive-dashboard.js
```

## Lampiran B — Output k6 (Ringkasan Terminal)

```
█ THRESHOLDS
  http_req_duration    ✓ 'p(95)<2000'  p(95)=37.67ms
  http_req_failed      ✓ 'rate<0.01'   rate=0.00%
  ws_connection_errors ✓ 'count==0'    count=0

█ TOTAL RESULTS
  checks_total.......: 51585   103.77/s
  checks_succeeded...: 100.00% 51585 out of 51585
  checks_failed......: 0.00%   0 out of 51585
    ✓ login status 200
    ✓ login has token
    ✓ dashboard 200
    ✓ dashboard not empty
    ✓ cycles 200
    ✓ latest sensor 200
    ✓ websocket upgrade 101

  http_req_duration..: avg=9.34ms  med=3.48ms  p(90)=11.3ms  p(95)=37.67ms  max=1.05s
  http_req_failed....: 0.00%   0 out of 30840
  http_reqs..........: 30840   62.04/s
  iteration_duration.: avg=22.04s  p(95)=22.94s
  iterations.........: 10095   20.31/s
  vus_max............: 555
  data_received......: 30 MB   61 kB/s
  data_sent..........: 12 MB   25 kB/s
  ws_connecting......: avg=939µs  p(95)=1.98ms
  ws_connection_errors: 0
  ws_msgs_received...: 20190
  ws_msgs_sent.......: 30285
  ws_session_duration: avg=20s
  ws_sessions........: 10095

running (8m17.1s), 000/555 VUs, 10095 complete and 0 interrupted iterations
bibitlive_dashboard ✓ [======================================] 000/555 VUs  8m0s
```

---

*Dokumen ini dihasilkan berdasarkan hasil pengujian aktual pada 13 Juli 2026 (run representatif dengan seed data per-petani). Run awal 6 Juli 2026 memakai data uji yang sebagian akun belum memiliki screenhouse; angka final di dokumen ini berasal dari run 13 Juli.*
