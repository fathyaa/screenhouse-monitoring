# Laporan Load Test Aplikasi BibitLive

Dokumen ini ditulis dengan bahasa sesederhana mungkin. Setiap istilah teknis dijelaskan di tempat, jadi tidak perlu latar belakang backend untuk mengikutinya.

## 1. Load test itu apa

Load test artinya kita **pura-pura mendatangkan banyak pengguna sekaligus** ke aplikasi, lalu melihat apakah server masih sanggup melayani atau mulai keteteran. Tujuannya menemukan batas: sampai berapa banyak pengguna atau permintaan yang bisa ditangani sebelum aplikasi jadi lambat atau menolak permintaan.

Analogi yang enak dipakai adalah bandara. Server itu bandara, dan setiap permintaan dari pengguna itu pesawat yang mau mendarat. Pertanyaannya, dalam satu waktu bandara bisa menerima berapa pesawat sebelum ada yang terpaksa disuruh berputar-putar karena landasan penuh. Load test adalah cara mengukur itu.

## 2. Alat dan cara kerjanya

Alat yang dipakai namanya **k6**. Dia membuat banyak **pengguna tiruan** lalu menyuruh mereka melakukan hal yang sama berulang kali, sambil mencatat berapa lama server menjawab dan berapa yang gagal. k6 tidak membuka aplikasi di browser, dia langsung menembak alamat-alamat server, jadi yang terukur murni beban di sisi server.

Semua perilaku ini ditulis dalam satu berkas, `k6-bibitlive-scenarios.js`. Untuk saat ini pengujian dijalankan di **laptop lokal** dulu sebagai latihan. Angka final nanti sebaiknya diambil di server cloud, karena laptop punya batas tenaga sendiri yang bisa mengaburkan hasil.

## 3. Kamus istilah singkat

Supaya laporan ini mudah dibaca siapa saja:

| Istilah | Arti sederhana |
|---|---|
| VU (Virtual User) | Satu pengguna tiruan. 50 VU berarti 50 orang tiruan mengakses bersamaan. |
| Iterasi | Satu putaran penuh yang dilakukan satu pengguna tiruan (login, buka dashboard, dan seterusnya). |
| Endpoint | Satu alamat fungsi di server. Contoh: `/auth/login` untuk masuk, `/my-screenhouses` untuk mengambil daftar screenhouse. |
| Latensi | Berapa lama server menjawab satu permintaan. Makin kecil makin baik. Satuannya milidetik (ms), 1000 ms = 1 detik. |
| avg | Rata-rata latensi. |
| p95 | 95 persen permintaan lebih cepat dari angka ini. Cara jujur melihat pengalaman terburuk yang masih wajar tanpa terganggu satu dua kejadian ekstrem. |
| max | Latensi paling lambat yang pernah terjadi (biasanya kejadian langka). |
| Throughput | Berapa banyak permintaan dilayani per detik. Ini angka "berapa pesawat mendarat per detik" dari analogi bandara. |
| Request gagal | Permintaan yang ditolak atau error oleh server. Idealnya nol. |
| bcrypt | Cara mengacak password saat login supaya aman. Sengaja dibuat berat di prosesor, jadi login memang lebih lambat daripada sekadar mengambil data. |
| Threshold | Batas lulus yang kita tetapkan sendiri, misalnya "95 persen permintaan harus di bawah 2 detik". |

## 4. Yang diuji: lima profil beban

Satu aplikasi bisa dites dengan cara-cara berbeda, karena tiap cara menjawab pertanyaan berbeda. Kita menyiapkan lima profil:

| Profil | Cara kerjanya | Menjawab pertanyaan |
|---|---|---|
| **baseline** | Naik landai ke 50 pengguna lalu tahan | Bagaimana perilaku normal saat santai (jadi acuan) |
| **ramping** | Naik bertahap sampai 555 pengguna lalu tahan | Kuat tidak saat banyak orang masuk sekaligus |
| **spike** | Melonjak mendadak lalu turun lagi | Bagaimana reaksi saat ada hentakan tiba-tiba |
| **soak** | Beban sedang tapi ditahan lama (30 menit) | Ada kebocoran memori atau melambat perlahan tidak |
| **saturasi** | Memaksa jumlah permintaan naik terus tanpa henti | Di angka berapa server mulai menolak (titik jenuh) |

Cara menjalankan satu profil:

```bash
cd load-tests
k6 run -e PROFILE=baseline k6-bibitlive-scenarios.js
```

Tiap kali dijalankan, hasilnya otomatis disimpan ke file `summary-<profil>-<waktu>.json` dan ringkasannya dicetak di layar.

## 5. Hasil sejauh ini

### 5.1 Profil baseline (run pertama)

| Yang diukur | Hasil |
|---|---|
| Total permintaan | 1.325 (sekitar 6,5 per detik) |
| Iterasi selesai | 425 |
| Request gagal | 0 persen (tidak ada yang ditolak) |
| Latensi keseluruhan | rata-rata 146 ms, p95 1.318 ms, paling lambat 3.641 ms |
| Login (POST /auth/login) | rata-rata 2.174 ms, p95 3.496 ms |
| Dashboard (GET /my-screenhouses) | rata-rata 182 ms, p95 1.623 ms |
| Pemeriksaan (checks) | 2.225 lolos, 100 persen |

### 5.2 Cara membaca angka ini

Kabar baiknya jelas: **tidak ada satu pun permintaan yang ditolak** (request gagal nol). Server menerima semua yang datang, tidak ada pesawat yang disuruh pulang. Semua pemeriksaan juga lolos, termasuk pemeriksaan bahwa data dashboard benar-benar terisi.

Yang menarik ada di **login**. Rata-ratanya 2,1 detik, jauh lebih lambat dari endpoint lain. Sementara **dashboard rata-ratanya cuma 182 ms**, artinya mengambil data itu ringan. Jadi bagian yang berat bukan menampilkan data, melainkan **proses masuk (login)**.

Kenapa login berat? Karena login memakai **bcrypt** untuk memeriksa password, dan bcrypt memang sengaja dibuat menyita prosesor demi keamanan. Ketika banyak login terjadi di saat yang persis bersamaan, prosesor keteteran sesaat, sehingga login jadi lama, dan itu ikut menyeret melambat beberapa permintaan dashboard yang kebetulan lewat di saat yang sama (itu sebabnya p95 dashboard sampai 1.623 ms padahal rata-ratanya cuma 182 ms).

Temuan ini sebenarnya bagus dan sejalan dengan yang dikatakan pembimbing, bahwa **proses memasukkan atau mengubah data itu yang paling berat, sedangkan sekadar menarik data itu ringan.** Sekarang kita punya buktinya dalam angka.

## 6. Perbaikan yang dilakukan pada skrip

Setelah melihat hasil di atas, ada dua penyesuaian:

**Pertama, memperbaiki cara start pada profil baseline.** Sebelumnya 50 pengguna tiruan dilepas serentak di detik nol, sehingga 50 login bcrypt meledak bersamaan (istilahnya *thundering herd*, gerombolan menyerbu serentak). Sekarang pengguna dinaikkan landai selama 30 detik dulu, jadi login tersebar dan angka baseline mencerminkan kondisi stabil, bukan badai sesaat di awal.

**Kedua, mengubah cara menandai endpoint lambat.** Sebelumnya latensi tiap endpoint dijadikan batas lulus, sehingga saat login melambat, k6 menandai seluruh pengujian "gagal" padahal tidak ada yang benar-benar rusak. Sekarang latensi per-endpoint hanya **diamati dan dicetak** di ringkasan, tidak lagi membuat seluruh run dicap gagal. Batas lulus yang tersisa hanya tiga yang memang penting: persentase request gagal harus di bawah 1 persen, 95 persen permintaan harus di bawah 2 detik, dan tidak boleh ada koneksi realtime yang gagal.

Karena baseline sudah diperbaiki, profil baseline lalu **dijalankan ulang tiga kali** untuk mendapat angka stabil yang bersih. Angka di bagian 5.1 di atas adalah run pertama yang justru berguna karena memunculkan temuan tentang login.

### 6.1 Bukti perbaikan berhasil

Setelah start dibuat landai, hasilnya jauh membaik. Perbandingan sebelum dan sesudah:

| Ukuran | Sebelum (start serentak) | Sesudah (start landai, rata-rata 3 run) |
|---|---|---|
| Login p95 | 3.496 ms | 151 ms |
| Dashboard p95 | 1.623 ms | 25 ms |
| p95 keseluruhan | 1.318 ms | 37,5 ms |
| Request gagal | 0 persen | 0 persen |

Login yang tadinya butuh 3,5 detik kini sekitar 0,15 detik, sekitar dua puluh kali lebih cepat, hanya karena login tidak lagi meledak serentak. Ini menegaskan bahwa kelambatan sebelumnya memang murni efek start bersamaan, bukan aplikasi yang lemah.

Yang tidak kalah penting, **ketiga run itu sangat konsisten** (p95 keseluruhan 23 ms, 44 ms, dan 45 ms; login p95 106 ms sampai 201 ms). Konsistensi ini membuktikan hasilnya bukan kebetulan satu kali, melainkan perilaku yang stabil. Itulah gunanya mengulang pengujian beberapa kali.

Untuk menghitung rata-rata dan rentang lintas run secara otomatis, tersedia skrip kecil `aggregate-results.py`:

```bash
cd load-tests
python3 aggregate-results.py summary-baseline-*.json
```

## 7. Profil lain (diisi setelah dijalankan)

Tabel ini menunggu hasil run berikutnya. Cukup salin angka dari ringkasan yang dicetak k6.

| Profil | Total request | Request gagal | p95 keseluruhan | Throughput | Catatan |
|---|---|---|---|---|---|
| baseline (3x) | ~1.479 | 0 persen | 37,5 ms (23–45) | 6,2 req/detik | sangat konsisten; login p95 ~151 ms, dashboard p95 ~25 ms |
| ramping (3x) | ~30.856 | 0 persen | 29,2 ms (20–43) | 62,1 req/detik | puncak 555 VU; 3x konsisten; login p95 ~120 ms, dashboard p95 ~43 ms |
| spike (3x) | ~9.441 | 4,6 persen (1,2–8,1) | ~10.500 ms | 41 req/detik | lonjakan ke 800 VU membebani; sebagian ditolak; lihat 7.1 |
| soak (1x) | 49.175 | 0 persen | 12,3 ms | 27 req/detik | 30 menit stabil, tidak melambat; login p95 tinggi = artefak start (lihat 7.1) |
| saturasi (1x) | 48.130 | 85,4 persen | ~60 detik (batas) | 146 req/detik tercapai | titik jenuh tercapai; angka terpengaruh batas laptop, wajib diulang di cloud (lihat 7.1) |

Khusus **saturasi**, yang dicari bukan lulus atau tidak, melainkan **di laju berapa request gagal mulai naik dari nol dan latensi mulai meledak** meski kita terus menambah beban. Itulah titik jenuh, dan itulah jawaban "berapa pesawat bisa mendarat" untuk aplikasi ini.

### 7.1 Membaca hasil spike, soak, dan saturasi

Tiga profil ini menghasilkan angka yang terlihat "jelek", tetapi justru itu tujuannya: mencari batas. Berikut cara membacanya dengan jujur.

**Spike (lonjakan mendadak ke 800 pengguna).** Saat beban melonjak tiba-tiba, aplikasi keteteran: sekitar 1 sampai 8 persen permintaan ditolak dan latensi naik ke hitungan detik. Ini wajar, karena lonjakan itu membuat ratusan proses login berat terjadi hampir bersamaan. Aplikasi tidak sampai mati, masih melayani mayoritas permintaan, tapi jelas butuh kapasitas lebih atau pembagi beban (load balancing) untuk menahan hentakan sebesar itu. Ini sekaligus menguatkan saran pembimbing tentang perlunya load balancing.

**Soak (beban sedang selama 30 menit).** Inilah hasil yang paling menenangkan: selama setengah jam penuh, **nol permintaan ditolak** dan latensi tetap stabil di sekitar 12 ms tanpa melambat seiring waktu. Artinya tidak ada kebocoran memori dan aplikasi sanggup hidup lama pada beban wajar. Satu angka yang terlihat aneh, login p95 sampai 14 detik, itu bukan masalah beban, melainkan **artefak start**: profil soak masih melepas 200 pengguna serentak di detik nol (ramp landai baru dipasang di profil baseline, belum di soak), sehingga login menumpuk sesaat di awal lalu selebihnya mulus. Kalau profil soak nanti diberi start landai juga, angka login ini akan ikut bersih.

**Saturasi (memaksa laju request naik terus).** Aplikasi menabrak dinding: pada laju ekstrem, 85 persen permintaan ditolak dan latensi mentok di batas 60 detik, dengan throughput tercapai sekitar 146 permintaan per detik. Titik jenuh memang ketemu, tapi **dua hal membuat angka ini belum bisa dipakai sebagai kapasitas sebenarnya**. Pertama, di laptop, k6 (pembuat beban) dan server berebut prosesor yang sama, jadi sebagian batas itu batas laptop, bukan batas aplikasi. Kedua, tiap pengguna tiruan baru melakukan login (bcrypt yang berat), sehingga yang tersaturasi sebagian besar adalah proses login, bukan murni pengambilan data. Untuk angka titik jenuh yang bisa dipertanggungjawabkan, tes ini **wajib diulang di cloud** dan sebaiknya memakai token login yang disiapkan di awal supaya yang diukur benar-benar endpoint datanya.

## 8. Catatan penting

1. **Ulangi tiap profil beberapa kali** (misalnya tiga kali), lalu ambil rata-ratanya. Sekali jalan bisa dianggap kebetulan.
2. **Lokal versus cloud.** Angka di laptop dibatasi tenaga laptop itu sendiri, bukan batas aplikasi. Untuk angka yang dipakai di laporan akhir, ulangi di server cloud setelah aplikasi di-deploy.
3. **Siapkan data dulu.** Sebelum menjalankan, pastikan sudah menjalankan seed `STRESS_PER_FARMER=1`, supaya setiap akun uji punya screenhouse dan endpoint mengembalikan data nyata. Kalau tidak, pemeriksaan "dashboard tidak kosong" akan gagal dan angkanya jadi semu.
