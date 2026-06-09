# Skenario Use Case — Sistem Monitoring Screenhouse

Format mengikuti template: Aktor, Referensi FR, Prasyarat, Pasca kondisi, Alur interaksi (Langkah | Aktor | Sistem).

---

## INCREMENT 1 — Sistem Monitoring

---

### UC-01. Login

| | |
|---|---|
| **Aktor** | Petani, Operator MCtan, Super Admin |
| **Referensi FR** | FR-01, FR-12 |
| **Prasyarat** | Akun sudah terdaftar; petani berstatus approved |
| **Pasca kondisi** | Pengguna masuk dashboard sesuai role; token JWT tersimpan |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Membuka halaman login | Menampilkan form nomor HP dan password |
| 2 | Mengisi nomor HP dan password, klik Masuk | — |
| 3 | — | Memvalidasi kredensial di database |
| 4 | — | Mengembalikan JWT dan data user |
| 5 | — | Mengarahkan ke dashboard sesuai role (/petani, /operator, /admin) |

**Alternatif:** A1 — Password salah → tampilkan pesan error. A2 — Petani status pending → pesan menunggu approval. A3 — Petani status rejected → pesan akun ditolak.

---

### UC-02. Register Akun Petani

| | |
|---|---|
| **Aktor** | Petani |
| **Referensi FR** | FR-02 |
| **Prasyarat** | Petani belum memiliki akun |
| **Pasca kondisi** | Pendaftaran menunggu approval operator |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Mengisi data akun + screenhouse | Validasi input |
| 2 | Kirim pendaftaran | Simpan user (pending) + screenhouse |
| 3 | — | Pesan menunggu approval operator |

**Alternatif:** A1 — Nomor HP sudah terdaftar → tampilkan pesan error.

---

### UC-03. Approval Pendaftaran Akun

| | |
|---|---|
| **Aktor** | Operator MCtan, Super Admin |
| **Referensi FR** | FR-03 |
| **Prasyarat** | Operator/Admin sudah login; terdapat petani berstatus pending |
| **Pasca kondisi** | Status akun petani menjadi approved atau rejected |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Membuka menu Approval Petani | Menampilkan daftar petani pending |
| 2 | Memilih petani, melihat data akun dan screenhouse | Menampilkan detail pendaftaran |
| 3 | Klik Approve atau Reject | Memperbarui status akun petani |
| 4 | — | Jika approved, petani dapat login ke sistem |

**Alternatif:** A1 — Reject → status akun rejected, petani tidak dapat login.

---

### UC-04. Kelola User

| | |
|---|---|
| **Aktor** | Super Admin |
| **Referensi FR** | FR-04 |
| **Prasyarat** | Admin sudah login |
| **Pasca kondisi** | Data user terbaru tersimpan di database |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Membuka menu Kelola User | Menampilkan daftar seluruh user |
| 2 | Memilih user yang akan diubah | Menampilkan detail user |
| 3 | Mengubah status atau reset password | — |
| 4 | Klik Simpan | Memperbarui data user di database |
| 5 | — | Menampilkan konfirmasi berhasil |

---

### UC-05. Kelola Screenhouse

| | |
|---|---|
| **Aktor** | Super Admin |
| **Referensi FR** | FR-05 |
| **Prasyarat** | Admin sudah login |
| **Pasca kondisi** | Data screenhouse terbaru tersimpan di database |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Membuka menu Kelola Screenhouse | Menampilkan daftar screenhouse |
| 2 | Memilih screenhouse | Menampilkan detail screenhouse |
| 3 | Mengubah status screenhouse (active/inactive) | — |
| 4 | Klik Simpan | Memperbarui data screenhouse di database |
| 5 | — | Menampilkan konfirmasi berhasil |

---

### UC-06. Mengirim Data Sensor

| | |
|---|---|
| **Aktor** | Sensor/Aktuator |
| **Referensi FR** | FR-06 |
| **Prasyarat** | Sensor node terdaftar; MQTT broker aktif |
| **Pasca kondisi** | Data sensor tersimpan dan siap ditampilkan di dashboard |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Membaca parameter lingkungan (NPK, suhu, kelembaban, dll.) | — |
| 2 | Mengirim data JSON via MQTT | Menerima payload dari broker |
| 3 | — | Mencocokkan node_code dengan sensor_nodes |
| 4 | — | Menyimpan data ke tabel sensor_data |
| 5 | — | Data tersedia untuk dashboard dan modul alert |

**Pengecualian:** E1 — Sensor node tidak ditemukan → data dibuang, log error.

---

### UC-07. Lihat Dashboard Screenhouse Miliknya

| | |
|---|---|
| **Aktor** | Petani |
| **Referensi FR** | FR-07 |
| **Prasyarat** | Petani sudah login; memiliki ≥1 screenhouse |
| **Pasca kondisi** | Petani melihat kondisi terkini screenhouse miliknya |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Membuka dashboard /petani | Memuat daftar screenhouse milik petani |
| 2 | — | Memuat data sensor terbaru per screenhouse |
| 3 | — | Menampilkan kartu status (Sehat / Perlu perhatian / Tidak ada data) |
| 4 | Memilih screenhouse (opsional) | Menampilkan detail 11 parameter + status aktuator |

**Alternatif:** A1 — Tidak ada data sensor → status Offline/Tidak ada data. A2 — Ada alert aktif → status Perlu perhatian.

---

### UC-08. Lihat Dashboard per Screenhouse

| | |
|---|---|
| **Aktor** | Operator MCtan, Super Admin |
| **Referensi FR** | FR-08 |
| **Prasyarat** | Operator/Admin sudah login |
| **Pasca kondisi** | Operator/Admin melihat detail kondisi screenhouse terpilih |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Memilih screenhouse dari peta atau daftar | Memuat data screenhouse |
| 2 | — | Memuat data sensor terbaru |
| 3 | — | Menampilkan 11 parameter sensor dan status aktuator |
| 4 | — | Menampilkan informasi lokasi dan petani pemilik |

---

### UC-09. Lihat Peta Screenhouse

| | |
|---|---|
| **Aktor** | Operator MCtan, Super Admin |
| **Referensi FR** | FR-09 |
| **Prasyarat** | Operator/Admin sudah login |
| **Pasca kondisi** | Peta menampilkan lokasi screenhouse dengan marker status |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Membuka dashboard operator | Menampilkan peta interaktif |
| 2 | — | Menampilkan marker screenhouse dengan warna status |
| 3 | Mengklik marker (opsional) | Menampilkan popup ringkasan screenhouse |

**Catatan:** Use case ini di-include oleh UC-10 (Filter per provinsi).

---

### UC-10. Filter Screenhouse per Provinsi

| | |
|---|---|
| **Aktor** | Operator MCtan, Super Admin |
| **Referensi FR** | FR-10 (include FR-09) |
| **Prasyarat** | Operator/Admin sudah login |
| **Pasca kondisi** | Peta dan daftar screenhouse terfilter sesuai provinsi |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Membuka dashboard operator | <<include>> Menampilkan peta screenhouse (UC-09) |
| 2 | Memilih filter provinsi | — |
| 3 | — | Memfilter screenhouse berdasarkan provinsi |
| 4 | — | Memperbarui marker peta dan daftar screenhouse |

---

### UC-11. Monitoring Status Device

| | |
|---|---|
| **Aktor** | Operator MCtan, Super Admin |
| **Referensi FR** | FR-11 |
| **Prasyarat** | Operator/Admin sudah login |
| **Pasca kondisi** | Operator/Admin mengetahui status online/offline device |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Membuka dashboard operator | — |
| 2 | — | Menampilkan status device per screenhouse (healthy/warning/critical/offline) |
| 3 | — | Menampilkan jumlah screenhouse dan device aktif di sidebar |
| 4 | — | Memperbarui status secara berkala dari data sensor terbaru |

---

## INCREMENT 2 — Sistem Analisis & Reporting

---

### UC-12. Lihat dan Export Laporan per Wilayah

| | |
|---|---|
| **Aktor** | Operator MCtan |
| **Referensi FR** | FR-13 |
| **Prasyarat** | Operator sudah login |
| **Pasca kondisi** | Laporan wilayah ditampilkan; file PDF terunduh (jika export) |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Membuka menu Laporan Wilayah (/operator/laporan) | Menampilkan halaman laporan |
| 2 | Mengatur filter (periode, grouping, provinsi/kabupaten) | — |
| 3 | — | Mengagregasi data screenhouse, alert, dan sensor |
| 4 | — | Menampilkan KPI (total SH, uptime, alert aktif, offline) |
| 5 | — | Menampilkan grafik status, tren alert, tren sensor |
| 6 | Klik Unduh PDF (opsional) | Menghasilkan dan mengunduh file PDF laporan |

**Alternatif:** A1 — Tidak ada data pada filter → tampilkan pesan data kosong.

---

### UC-13. Analisis Tren Parameter Sensor

| | |
|---|---|
| **Aktor** | Petani |
| **Referensi FR** | FR-14 |
| **Prasyarat** | Petani sudah login; terdapat histori data sensor |
| **Pasca kondisi** | Petani melihat grafik tren dan evaluasi kesehatan parameter |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Membuka menu Tren Tanah (/petani/tren) | Memuat daftar screenhouse petani |
| 2 | Memilih screenhouse | Memuat histori sensor 24 jam + threshold |
| 3 | — | Menampilkan grafik tren NPK, kelembaban, suhu |
| 4 | — | Menampilkan area rentang threshold pada grafik |
| 5 | — | Menampilkan kartu kesehatan parameter (ParamHealthCards) |

**Alternatif:** A1 — Data histori belum ada → pesan "Data belum tersedia".

---

### UC-14. Lihat Grafik Historis Detail Screenhouse

| | |
|---|---|
| **Aktor** | Operator MCtan, Super Admin |
| **Referensi FR** | FR-08, FR-15 |
| **Prasyarat** | Operator/Admin sudah login; screenhouse memiliki histori sensor |
| **Pasca kondisi** | Grafik historis 24 jam ditampilkan pada halaman detail |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Membuka detail screenhouse (/operator/screenhouse/:id) | Memuat data screenhouse dan sensor terbaru |
| 2 | Klik "Lihat tren & data detail" | Memuat histori sensor 24 jam |
| 3 | — | Menampilkan grafik line/bar NPK dan parameter lingkungan |
| 4 | — | Menampilkan area rentang threshold pada grafik |

**Alternatif:** A1 — Belum ada histori → pesan data historis belum tersedia.

---

## INCREMENT 3 — Sistem Notifikasi & Kontrol Aktuator

---

### UC-15. Kelola Threshold Sensor

| | |
|---|---|
| **Aktor** | Super Admin |
| **Referensi FR** | FR-16 |
| **Prasyarat** | Admin sudah login; screenhouse terdaftar |
| **Pasca kondisi** | Threshold tersimpan dan tersinkron ke Monitoring DB |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Membuka menu Kelola Threshold | Menampilkan daftar screenhouse |
| 2 | Memilih screenhouse | Menampilkan threshold saat ini |
| 3 | Mengatur min/max 11 parameter sensor | — |
| 4 | Klik Simpan | Menyimpan ke tabel thresholds (App DB) |
| 5 | — | Menyinkronkan threshold_snapshots ke Monitoring DB |

---

### UC-16. Deteksi Alert Otomatis

| | |
|---|---|
| **Aktor** | Sistem |
| **Referensi FR** | FR-17 |
| **Prasyarat** | Data sensor baru masuk; threshold snapshot tersedia |
| **Pasca kondisi** | Record alert active dibuat (jika parameter di luar batas) |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | — | Menerima data sensor baru (UC-06) |
| 2 | — | Membandingkan nilai dengan threshold_snapshots |
| 3 | — | Jika ada parameter di luar batas → insert alert (status active) |
| 4 | — | Mempublish event alert untuk notifikasi (UC-18) |

**Alternatif:** A1 — Semua parameter normal → tidak ada alert baru.

---

### UC-17. Lihat Alert

| | |
|---|---|
| **Aktor** | Petani |
| **Referensi FR** | FR-18 |
| **Prasyarat** | Petani sudah login; terdapat alert |
| **Pasca kondisi** | Petani membaca detail alert |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Membuka halaman Peringatan (/petani/peringatan) | Menampilkan daftar alert aktif |
| 2 | Memilih alert | Menampilkan pesan alert dan nilai sensor aktual |
| 3 | — | Menampilkan screenhouse dan parameter yang bermasalah |

---

### UC-18. Terima Notifikasi

| | |
|---|---|
| **Aktor** | Petani |
| **Referensi FR** | FR-19 (extend UC-17) |
| **Prasyarat** | Alert baru terpicu; petani login atau PWA aktif |
| **Pasca kondisi** | Petani menerima notifikasi alert |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | — | Alert terpicu oleh sistem (UC-16) |
| 2 | — | Mengirim notifikasi via Socket.IO (app terbuka) |
| 3 | — | Mengirim Web Push via Service Worker (app tertutup) |
| 4 | Melihat badge/notifikasi di topbar | <<extend>> Petani dapat lanjut ke UC-17 |

---

### UC-19. Resolve Alert

| | |
|---|---|
| **Aktor** | Petani |
| **Referensi FR** | FR-20 |
| **Prasyarat** | Petani sudah login; alert berstatus active |
| **Pasca kondisi** | Alert berstatus resolved |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Membaca detail alert di halaman Peringatan | — |
| 2 | Melakukan tindakan korektif di screenhouse (siram, pupuk, ventilasi) | — |
| 3 | Klik Tandai selesai | Memperbarui status alert menjadi resolved |
| 4 | — | Menghapus alert dari daftar aktif |

---

### UC-20. Mengatur Aktuator

| | |
|---|---|
| **Aktor** | Petani |
| **Referensi FR** | FR-21 |
| **Prasyarat** | Petani sudah login; screenhouse milik petani |
| **Pasca kondisi** | Perintah aktuator dikirim ke sistem dan hardware |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | Membuka dashboard atau detail screenhouse | Menampilkan kontrol fan, irigasi, lampu |
| 2 | Menyalakan atau mematikan aktuator | Mengirim perintah ke backend |
| 3 | — | <<include>> Meneruskan perintah ke hardware (UC-21) |
| 4 | — | Memperbarui tampilan status aktuator di dashboard |

---

### UC-21. Menerima Aksi Aktuator

| | |
|---|---|
| **Aktor** | Sensor/Aktuator |
| **Referensi FR** | FR-22 |
| **Prasyarat** | Perintah aktuator diterima dari sistem (UC-20) |
| **Pasca kondisi** | Aktuator berjalan sesuai perintah; status terkirim balik |

| Langkah ke | Aktor | Sistem |
|:---:|:---|:---|
| 1 | — | Sistem meneruskan perintah aktuator |
| 2 | Menerima perintah (fan/irigasi/lampu on/off) | — |
| 3 | Mengeksekusi aksi pada hardware | — |
| 4 | Mengirim status aktuator terbaru via MQTT | Menerima dan menyimpan status ke sensor_data |

---

## Ringkasan FR ↔ Use Case

| FR | Use Case |
|----|----------|
| FR-01, FR-12 | UC-01 |
| FR-02 | UC-02 |
| FR-03 | UC-03 |
| FR-04 | UC-04 |
| FR-05 | UC-05 |
| FR-06 | UC-06 |
| FR-07 | UC-07 |
| FR-08 | UC-08, UC-14 |
| FR-09 | UC-09 |
| FR-10 | UC-10 |
| FR-11 | UC-11 |
| FR-13 | UC-12 |
| FR-14 | UC-13 |
| FR-15 | UC-14 |
| FR-16 | UC-15 |
| FR-17 | UC-16 |
| FR-18 | UC-17 |
| FR-19 | UC-18 |
| FR-20 | UC-19 |
| FR-21 | UC-20 |
| FR-22 | UC-21 |
