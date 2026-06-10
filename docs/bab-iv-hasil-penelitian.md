# BAB IV — HASIL PENELITIAN

Dokumen pendukung penulisan Word. Subbab IV.1 (AS-IS, FR, NFR, use case) mengacu pada versi sebelumnya; **IV.2 sampai IV.3 di bawah sudah direvisi** agar selaras dengan model WSN (Sensor Node + Sink Node) dan basis data monitoring **7 tabel**.

---

## IV.2 Perancangan Sistem

Setelah kebutuhan fungsional dan non-fungsional teridentifikasi, dilakukan perancangan teknis sistem monitoring screenhouse. Perancangan ini mencakup arsitektur, struktur basis data, alur proses pengguna, interaksi antar komponen, dan wireframe antarmuka. Meskipun implementasinya bertahap dalam tiga increment, desain dirancang holistik agar seluruh modul saling selaras sejak awal.

---

### IV.2.1 Arsitektur Sistem

Sistem monitoring screenhouse dirancang dengan pola microservices dan pemisahan tanggung jawab antar layanan. Di lapisan paling bawah terdapat jaringan sensor nirkabel (WSN) di lapangan. Setiap screenhouse memiliki **satu Sink Node** berperan sebagai gateway sekaligus relay tiga aktuator (kipas, irigasi, dan lampu). Di dalam screenhouse terdapat **beberapa Sensor Node**, masing-masing dipasang pada satu tray bibit dan membaca sepuluh parameter lingkungan — nitrogen, fosfor, kalium, suhu tanah, kelembaban tanah, pH tanah, konduktivitas, suhu udara, kelembaban udara, dan intensitas cahaya. Sensor Node mengirim telemetri ke Sink Node melalui komunikasi radio WSN; Sink Node yang meneruskan data ke broker Mosquitto menggunakan protokol MQTT.

Topik MQTT dirancang per screenhouse dan per sink, dengan pola `screenhouse/{id}/sink/{kode_sink}/sensor` untuk telemetri masuk dan `screenhouse/{id}/sink/{kode_sink}/command` untuk perintah aktuator keluar. Payload telemetri memuat identitas `node_id` (kode tray pengirim) dan `destination_id` (kode sink penerima), sehingga Monitoring Service dapat menautkan setiap record ke `sensor_nodes` dan `sink_nodes` yang benar.

Di lapisan backend terdapat dua service terpisah. App Service berjalan di port 8000 dan menangani identitas pengguna (autentikasi JWT), katalog screenhouse, data wilayah administratif, serta konfigurasi threshold. Monitoring Service berjalan di port 3001 dan menangani penerimaan data sensor dari MQTT, penyimpanan ke basis data, pemrosesan alert, perintah aktuator, serta komunikasi realtime via Socket.IO. App Service tidak langsung menerima data MQTT; perannya lebih sebagai gateway API dan pengelola data master, sementara Monitoring Service fokus pada telemetri, alerting, dan relay aktuator.

Kedua service masing-masing memiliki basis data PostgreSQL sendiri. Database `screenhouse_app` (port 5434) menyimpan data user, screenhouse, threshold, wilayah, dan subscription Web Push. Database `screenhouse_monitoring` (port 5433) terdiri atas **tujuh tabel**: read-model tersinkron (`screenhouse_registry`, `threshold_snapshots`), entitas WSN (`sink_nodes`, `sensor_nodes`), data operasional (`sensor_data`, `actuator_logs`), dan `alerts`. Pemisahan ini mengikuti prinsip bounded context — data identitas dan katalog tidak tercampur dengan data ingest dan alerting.

Komunikasi antar service dilengkapi Redis sebagai event bus. Ketika admin mengubah threshold atau menambah screenhouse baru, App Service mempublish event ke Redis, lalu Monitoring Service memperbarui read-model lokalnya. Tanpa mekanisme ini, alert worker tidak bisa membandingkan data sensor dengan batas threshold yang benar.

Di lapisan presentasi terdapat aplikasi web berbasis React dan Vite. Frontend berkomunikasi ke backend melalui **Load Balancer** (Nginx reverse proxy pada port 80/443). Load balancer menerima semua permintaan HTTP/HTTPS dari browser, lalu meneruskannya ke instance microservice yang tersedia — misalnya request REST ke App Service dan koneksi WebSocket (Socket.IO) ke Monitoring Service. Mekanisme ini memungkinkan penambahan instance App Service atau Monitoring Service (horizontal scaling) tanpa mengubah URL yang diakses pengguna. Load balancer juga melakukan health check dan distribusi beban (round-robin) agar tidak ada satu server saja yang memproses seluruh traffic.

Pada lingkungan pengembangan lokal, frontend dapat langsung memanggil App Service (:8000) dan Monitoring Service (:3001) tanpa load balancer. Pada skenario deployment produksi, seluruh traffic pengguna diarahkan melalui load balancer sebagai pintu masuk tunggal (single entry point). Aplikasi juga dikonfigurasi sebagai Progressive Web App (PWA) sehingga petani dapat mengakses dashboard dari perangkat mobile dan menerima notifikasi push meski browser ditutup.

**Gambar IV.3** Arsitektur Sistem menggambarkan keseluruhan lapisan di atas. **Gambar IV.4** Diagram Deployment melengkapi dengan tata letak infrastruktur fisik — container Docker untuk PostgreSQL, Redis, dan Mosquitto, proses Node.js untuk kedua backend service, serta perangkat WSN (Sensor Node dan Sink Node) di lapangan.

---

### IV.2.2 Entity Relationship Diagram

Struktur basis data dirancang dalam dua database terpisah sesuai domain masing-masing.

Database `screenhouse_app` (**Gambar IV.5**) menyimpan data identitas dan katalog. Tabel `users` menampung akun petani, operator, dan admin dengan atribut nomor HP, password, role, dan status approval. Tabel `screenhouses` menyimpan data screenhouse — nama, alamat detail, koordinat GPS, relasi ke pemilik (owner), dan status aktif/nonaktif. Data wilayah administratif Indonesia disimpan dalam empat tabel berjenjang: `provinces`, `regencies`, `districts`, dan `villages`, sehingga setiap screenhouse terhubung ke lokasi administratif yang spesifik. Tabel `thresholds` berisi batas minimum dan maksimum untuk sepuluh parameter sensor per screenhouse, dengan relasi one-to-one ke screenhouse. Tabel `push_subscriptions` menyimpan endpoint Web Push untuk notifikasi PWA per user.

Database `screenhouse_monitoring` (**Gambar IV.6**) menyimpan data operasional sensor, aktuator, dan alert — **tujuh tabel** secara keseluruhan. Tabel `screenhouse_registry` dan `threshold_snapshots` merupakan read-model yang disinkronkan dari App DB; keduanya tidak memiliki foreign key lintas database, melainkan diisi via script sinkronisasi dan event Redis. Tabel `sink_nodes` mendaftarkan gateway WSN — satu record unik per screenhouse — sekaligus menyimpan status terkini tiga relay aktuator (fan, irigasi, lampu). Tabel `sensor_nodes` mendaftarkan perangkat sensor per tray dengan `node_code` unik sebagai identitas `node_id` pada payload MQTT. Tabel `sensor_data` menyimpan record telemetri setiap kali tray publish data; kolom `sensor_node_id` menunjuk tray sumber, sedangkan `sink_node_id` menunjuk gateway yang meneruskan data ke cloud. Status aktuator **tidak** lagi disimpan di `sensor_data`, melainkan di `sink_nodes` dan riwayatnya di `actuator_logs`. Tabel `alerts` menyimpan alert otomatis ketika nilai parameter melampaui batas threshold, dengan status active atau resolved.

Relasi utama di Monitoring DB: `screenhouse_registry` → `sink_nodes` (1:1), `screenhouse_registry` → `sensor_nodes` (1:N), `sensor_nodes` → `sensor_data` (1:N), `sink_nodes` → `sensor_data` (1:N), `sink_nodes` → `actuator_logs` (1:N), serta `screenhouse_registry` → `alerts` (1:N).

**Gambar IV.7** ERD Sinkronisasi Antar Database menjelaskan mekanisme penyelarasan data antara kedua database. Hanya `screenhouses` dan `thresholds` dari App DB yang disalin ke `screenhouse_registry` dan `threshold_snapshots` di Monitoring DB. Tabel WSN (`sink_nodes`, `sensor_nodes`, `sensor_data`, `actuator_logs`) dan `alerts` dikelola sepenuhnya oleh Monitoring Service tanpa sinkronisasi balik ke App DB. Garis putus-putus pada diagram menandakan sinkronisasi logis, bukan foreign key lintas database.

---

### IV.2.3 Activity Diagram

Activity diagram dibuat untuk menggambarkan alur proses dari sudut pandang pengguna, tanpa masuk ke detail teknis seperti nama API atau protokol MQTT. Tiga diagram disusun per increment implementasi.

**Gambar IV.8** Activity Increment 1 (Modul Monitoring) menggunakan swimlane Petani, Operator, dan Sistem. Alur petani dimulai dari login, membuka dashboard, melihat kartu screenhouse milik sendiri, lalu masuk ke halaman detail untuk membaca nilai sepuluh parameter sensor terbaru beserta status aktuator yang ditampilkan dari Sink Node. Alur operator dimulai dari login, membuka dashboard operator yang menampilkan peta interaktif, memfilter screenhouse berdasarkan provinsi, lalu mengklik marker untuk melihat detail screenhouse dan status perangkat (online atau offline). Swimlane Sistem menggambarkan proses di balik layar: tray mengirim telemetri ke sink via radio, sink meneruskan ke broker MQTT, Monitoring Service memvalidasi `node_id` dan `destination_id`, menyimpan ke `sensor_data`, lalu menampilkan nilai terbaru di dashboard.

**Gambar IV.9** Activity Increment 2 (Modul Analisis dan Reporting) fokus pada analisis data historis. Petani membuka halaman tren, memilih screenhouse dan parameter yang ingin dianalisis, lalu sistem menampilkan grafik line chart agregasi per jam. Di bawah grafik, kartu kesehatan parameter memberi verdict apakah nilai ideal, kurang, atau berlebih, disertai rekomendasi tindakan. Operator membuka halaman laporan wilayah, mengatur filter periode dan grouping, lalu sistem menampilkan KPI agregat dan grafik distribusi parameter. Operator dapat mengunduh laporan dalam format PDF.

**Gambar IV.10** Activity Increment 3 (Modul Notifikasi) melibatkan swimlane Admin, Petani, dan Sistem. Admin mengatur batas threshold per screenhouse melalui halaman kelola threshold. Sistem secara otomatis membandingkan setiap data sensor baru dengan threshold — jika melampaui batas, alert dibuat dan notifikasi dikirim ke petani. Petani menerima notifikasi (badge di topbar atau toast), membuka halaman peringatan untuk melihat detail alert, menandai alert sebagai selesai (resolve), dan bila perlu mengatur aktuator melalui perintah yang diteruskan ke Sink Node.

---

### IV.2.4 Sequence Diagram

Sequence diagram melengkapi activity diagram dengan menjabarkan interaksi teknis antar komponen — urutan pesan, siapa memanggil siapa, dan respons yang dikembalikan. Tiga diagram disusun per increment.

**Gambar IV.11** Sequence Increment 1 menggambarkan skenario data sensor tampil di dashboard. Sensor Node (tray) mengirim telemetri ke Sink Node via radio WSN. Sink Node mempublish payload JSON ke topik MQTT `screenhouse/{id}/sink/{kode_sink}/sensor`. Monitoring Service yang subscribe topik tersebut menerima pesan, memparse JSON, memvalidasi `node_id` terhadap tabel `sensor_nodes` dan `destination_id` terhadap `sink_nodes`, lalu melakukan INSERT ke tabel `sensor_data` dengan kolom `sink_node_id`. Event `sensor-update` dipublish ke Redis agar dashboard dapat diperbarui. Ketika petani membuka dashboard, frontend mengirim request GET ke App Service, yang meneruskan (proxy) ke Monitoring Service. Monitoring Service mengembalikan data sensor terbaru beserta status aktuator dari `sink_nodes`, dan frontend merender nilai pada kartu parameter.

**Gambar IV.12** Sequence Increment 2 menggambarkan skenario petani membuka halaman tren. Frontend mengirim request history sensor dengan rentang waktu tertentu. Monitoring Service melakukan query ke tabel `sensor_data`, mengembalikan array data mentah. Frontend melakukan agregasi per jam, lalu Recharts merender line chart dengan area referensi threshold. Untuk operator, frontend meminta data agregat wilayah ke App Service, App Service proxy ke endpoint statistik Monitoring Service, hasilnya dirender sebagai KPI dan grafik. Saat operator mengklik unduh PDF, frontend memanggil fungsi export yang menghasilkan file PDF dari data yang sudah ditampilkan.

**Gambar IV.13** Sequence Increment 3 menggambarkan skenario alert otomatis dan (secara implisit) jalur aktuator. Setelah Monitoring Service menyimpan data sensor baru, alert worker membaca `threshold_snapshots` dan membandingkan nilai parameter. Jika nitrogen misalnya 50 padahal batas maksimum 40, worker INSERT record alert dengan status active, lalu publish event ke Redis channel `alert-created`. Socket.IO server menerima event dan emit ke room `user:{owner_user_id}`. Frontend yang subscribe via `AlertContext` menerima event, memperbarui counter badge notifikasi, dan menampilkan toast. Bila petani sudah mendaftarkan Web Push subscription, notifikasi juga dikirim ke service worker meski tab browser ditutup. Untuk kontrol aktuator, petani mengirim perintah via REST ke Monitoring Service; service mempublish ke topik `.../command`, Sink Node mengeksekusi relay, memperbarui `sink_nodes`, dan mencatat riwayat di `actuator_logs`.

---

### IV.2.5 Perancangan Antarmuka (Wireframe)

Wireframe dirancang setelah kebutuhan fungsional dan use case diagram selesai. Tujuannya memetakan tata letak halaman sebelum coding — posisi menu, area konten utama, dan elemen interaksi — tanpa detail warna atau grafik final. Wireframe dibuat holistik untuk seluruh peran (petani, operator, admin), meskipun implementasinya bertahap per increment.

Desain antarmuka mengikuti pola layout yang sama di hampir semua halaman internal: sidebar kiri berisi navigasi per role, topbar atas menampilkan nama pengguna dan (untuk petani) badge notifikasi alert, area konten utama di sebelah kanan. Halaman publik (login dan registrasi) sengaja tidak memakai sidebar agar fokus pengguna tetap pada form.

Wireframe halaman login (**Gambar IV.14**) menampilkan form sederhana di tengah layar — field nomor HP, field password, tombol Masuk, dan link ke halaman registrasi. Registrasi petani dibagi dua langkah: data akun (**Gambar IV.14**) dan data screenhouse dengan dropdown wilayah serta koordinat GPS (**Gambar IV.15**).

Dashboard petani (**Gambar IV.16**) wireframe-nya terdiri atas sidebar (Beranda, Tren, Peringatan), topbar dengan ikon notifikasi, ringkasan statistik di atas, dan deretan kartu screenhouse di bawah. Detail screenhouse petani (**Gambar IV.17**) menampilkan grid kartu sepuluh parameter dan panel status tiga aktuator (kipas, irigasi, lampu) yang direpresentasikan sebagai status gateway screenhouse.

Dashboard operator (**Gambar IV.18**) fokus pada peta interaktif dengan marker screenhouse, panel filter provinsi, dan popup ringkas per marker. Halaman approval petani (**Gambar IV.19**) menampilkan kartu petani pending beserta tombol Setujui/Tolak. Halaman tren petani (**Gambar IV.20**) dan laporan wilayah operator (**Gambar IV.21**) menggambarkan area grafik dan KPI agregat. Wireframe kelola threshold admin (**Gambar IV.22**) dan halaman peringatan petani (**Gambar IV.23**) melengkapi increment 3.

Wireframe desktop tersedia di file Figma; wireframe mobile diekspor sebagai PNG di folder `docs/wireframes-mobile/png/`. Screenshot hasil implementasi per increment dicantumkan di IV.3 sebagai bukti bahwa wireframe sudah direalisasikan.

---

## IV.3 Hasil Implementasi Sistem

Perancangan pada IV.2 direalisasikan dengan model incremental. Setiap modul dibangun dan diuji sebelum modul berikutnya dimulai. Subbab ini menampilkan hasil implementasi berupa penjelasan fitur yang sudah berjalan dan screenshot antarmuka sebagai bukti.

---

### IV.3.1 Increment 1 — Modul Monitoring

Increment pertama menyelesaikan fondasi sistem — FR-01 sampai FR-12. Modul ini harus stabil dulu sebelum increment 2 dan 3 bisa dikerjakan, karena keduanya bergantung pada aliran data sensor dan autentikasi pengguna.

Di sisi backend, App Service mengimplementasikan autentikasi JWT berbasis nomor HP dan password. Petani yang mendaftar melalui halaman registrasi disimpan dengan status pending, beserta data screenhouse yang diisi sekaligus. Operator dapat menyetujui atau menolak pendaftaran melalui halaman approval. Admin memiliki halaman kelola user dan kelola screenhouse untuk operasi CRUD. Monitoring Service mengimplementasikan subscriber MQTT pada topik `screenhouse/+/sink/+/sensor`. Setiap pesan divalidasi: `node_id` dicocokkan ke `sensor_nodes`, `destination_id` ke `sink_nodes`, lalu payload disimpan ke `sensor_data` dengan referensi `sink_node_id`. App Service berperan sebagai proxy — frontend memanggil endpoint App Service yang meneruskan request ke Monitoring Service.

Di sisi frontend, halaman login menjadi pintu masuk semua peran. Setelah login, petani diarahkan ke dashboard yang menampilkan kartu screenhouse milik sendiri beserta nilai sensor terbaru. Halaman detail menampilkan sepuluh parameter lingkungan dan badge status tiga aktuator yang diambil dari status Sink Node. Operator diarahkan ke dashboard dengan peta interaktif React Leaflet — setiap screenhouse ditandai marker, bisa difilter per provinsi, dan status perangkat terlihat dari indikator visual marker atau badge.

**Gambar IV.24** sampai **IV.28** melampirkan screenshot halaman login, dashboard petani, dashboard operator dengan peta, halaman approval, serta bukti data MQTT masuk via topik sink dan langsung tampil di dashboard.

---

### IV.3.2 Increment 2 — Modul Analisis dan Reporting

Increment kedua menambah kemampuan membaca dan menganalisis data historis — FR-13 sampai FR-15. Modul ini baru bermakna setelah data sensor sudah terkumpul cukup banyak dari increment 1.

Halaman tren petani menampilkan grafik line chart untuk setiap parameter sensor. Data mentah dari API history diagregasi per jam sebelum dirender. Grafik dilengkapi area referensi threshold — zona hijau menandakan rentang aman, zona merah menandakan nilai di luar batas. Komponen ParamHealthCards mengevaluasi status setiap parameter: ideal, kurang, atau berlebih, disertai rekomendasi tindakan. Di sisi operator, halaman laporan wilayah menampilkan KPI agregat dengan filter periode dan grouping wilayah, plus opsi unduh PDF. Halaman detail screenhouse operator juga menampilkan grafik historis sensor per screenhouse.

**Gambar IV.29** sampai **IV.33** melampirkan screenshot halaman tren petani, grafik dengan area threshold, kartu kesehatan parameter, halaman laporan operator, dan contoh file PDF yang terunduh.

---

### IV.3.3 Increment 3 — Modul Notifikasi

Increment terakhir menambah alert otomatis, notifikasi realtime, dan kontrol aktuator — FR-16 sampai FR-22. Modul ini membutuhkan threshold yang sudah dikonfigurasi admin dan aliran data sensor yang sudah berjalan dari increment sebelumnya.

Admin mengatur batas minimum dan maksimum setiap parameter melalui halaman kelola threshold. Setiap kali disimpan, perubahan disinkronkan ke `threshold_snapshots` di Monitoring DB via event Redis. Alert worker membandingkan setiap record `sensor_data` baru dengan snapshot threshold screenhouse terkait. Jika ada parameter yang melampaui batas, sistem otomatis INSERT alert dengan status active.

Notifikasi alert dikirim ke petani pemilik screenhouse melalui Socket.IO (badge counter dan toast realtime) dan Web Push PWA (bila subscription aktif). Petani membuka halaman peringatan untuk melihat daftar alert, memfilter berdasarkan status, dan menandai alert sebagai selesai (resolve).

Kontrol aktuator manual diimplementasikan melalui Sink Node. Di halaman detail screenhouse, petani dapat menyalakan atau mematikan kipas, irigasi, dan lampu melalui panel ActuatorControls. Perintah dikirim ke Monitoring Service via REST; service mempublish payload ke topik MQTT `screenhouse/{id}/sink/{kode}/command`, memperbarui kolom status di `sink_nodes`, dan menulis riwayat ke `actuator_logs`. Sink Node mengeksekusi relay dan dapat mengirim status terbaru kembali via topik sensor, sehingga dashboard menampilkan kondisi aktuator yang mutakhir.

**Gambar IV.34** sampai **IV.39** melampirkan screenshot halaman kelola threshold admin, notifikasi alert realtime, halaman peringatan petani, alert setelah di-resolve, panel kontrol aktuator, dan (opsional) notifikasi Web Push di perangkat mobile.

---

## Daftar gambar (revisi penomoran)

| Subbab | Gambar | Isi |
|--------|--------|-----|
| IV.1.1 | IV.1 | Proses bisnis eksisting |
| IV.1.4 | IV.2 | Use case diagram |
| IV.2.1 | IV.3–IV.4 | Arsitektur + deployment |
| IV.2.2 | IV.5–IV.7 | ERD App, Monitoring (7 tabel), sync |
| IV.2.3 | IV.8–IV.10 | Activity diagram (3 increment) |
| IV.2.4 | IV.11–IV.13 | Sequence diagram (3 increment) |
| IV.2.5 | IV.14–IV.23 | Wireframe |
| IV.3.1 | IV.24–IV.28 | Screenshot increment 1 |
| IV.3.2 | IV.29–IV.33 | Screenshot increment 2 |
| IV.3.3 | IV.34–IV.39 | Screenshot increment 3 |

File diagram Draw.io: `docs/diagrams/`. Wireframe mobile PNG: `docs/wireframes-mobile/png/`.
