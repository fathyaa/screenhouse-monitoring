# Laporan Perbandingan Arsitektur Pipeline Ingest Backend

Dokumen ini mengevaluasi dua rancangan pipeline ingest pada backend aplikasi BibitLive, menjelaskan bagian kode mana yang menjadi jantung pengujiannya, lalu membandingkan dua hasil yang tersimpan di `results/report.md` dan `results/report-direct.md`.

Yang dinilai di sini adalah keputusan desain pada layanan monitoring, yaitu bagaimana kode backend menerima dan menyimpan data sensor. RabbitMQ dan PostgreSQL diperlakukan sebagai komponen pendukung dari rancangan itu, bukan sebagai objek yang diukur kapasitasnya. Dengan kata lain, fokusnya adalah perilaku dan keandalan kode ingest yang dibangun, bukan tolok ukur perangkat lunak infrastruktur.

Kedua laporan lahir dari kode uji yang persis sama. Skenario sama, simulator sama, cara pengukuran sama. Yang berbeda hanya satu hal, yaitu jalur yang ditempuh data sensor setelah masuk ke broker. Pada `report.md`, pesan melewati antrian RabbitMQ sebelum ditulis ke database. Pada `report-direct.md`, pesan ditulis langsung ke database tanpa penyangga. Perbedaan satu keputusan arsitektur inilah yang membuat hasil keduanya bercerita sangat berbeda.

## Apa yang sebenarnya diuji

Sistem BibitLive menerima telemetry dari alat di screenhouse melalui MQTT. Pesan itu ditangkap kode ingest pada layanan monitoring, lalu disimpan ke PostgreSQL, dan sebagian disiarkan ke dashboard lewat Socket.IO. Menyimpan setiap data sensor dengan andal adalah salah satu kebutuhan fungsional aplikasi ini, dan pertanyaan yang ingin dijawab berangkat dari situ. Sampai beban berapa kode ingest backend masih sanggup mencerna aliran sensor tanpa kehilangan data, dan apakah keputusan menaruh antrian pesan di depan penyimpanan memang membuat aplikasi lebih tahan.

Perlu ditegaskan agar tidak salah baca. Yang berada di bawah lampu bukan MQTT broker, RabbitMQ, atau PostgreSQL sebagai infrastruktur. Ketiganya adalah dependensi yang dipakai oleh rancangan. Yang dinilai adalah bagaimana kode backend memperlakukan aliran data di antara mereka, dan seberapa jauh pilihan arsitekturnya menjaga integritas data ketika beban naik.

Untuk menjawabnya, pengujian tidak memakai perangkat keras sungguhan. Sebagai gantinya ada simulator yang berpura pura menjadi ribuan sensor sekaligus, menembakkan payload ke broker dengan laju yang bisa diatur. Dari sisi lain, sekumpulan kolektor mengintip berapa pesan yang diterima backend, berapa yang benar benar mendarat di database, seberapa dalam antrian menumpuk, dan berapa banyak memori yang dipakai proses.

Satu catatan penting yang perlu dipegang sejak awal. Seribu sensor di sini tidak sama dengan seribu pengguna. Semua sensor virtual terdaftar pada satu screenhouse uji, sehingga yang dievaluasi adalah perilaku kode ingest dalam menyerap aliran telemetry, bukan jumlah orang yang membuka aplikasi. Beban pengguna dashboard diuji terpisah pada bagian load testing aplikasi web.

## Skenario pengujian

Ada enam skenario, dari yang ringan sampai yang sengaja dibuat brutal. Definisinya hidup di `config/scenarios.json`, dan pemilihannya cukup lugas.

S1 Baseline adalah kondisi tenang. Seratus sensor, satu pesan tiap lima detik, selama lima menit. Ini titik acuan untuk melihat sistem saat tidak ditekan sama sekali.

S2 Moderate Load menaikkan taruhan ke lima ratus sensor dengan interval tiga detik selama lima menit. Masih wajar, tetapi cukup untuk melihat apakah latensi mulai bergerak.

S3 Heavy Load adalah lompatan tajam. Seribu sensor menembak satu pesan tiap detik selama sepuluh menit, menghasilkan laju kirim mendekati seribu pesan per detik. Di sinilah biasanya sistem mulai kewalahan.

S4 Stress Test dibuat untuk mematahkan. Lima ribu sensor pada interval satu detik, sekitar lima ribu pesan per detik. Tujuannya bukan untuk lulus, melainkan untuk menemukan titik runtuh.

S5 Spike Test menguji reaksi terhadap lonjakan mendadak. Bebannya berpindah tahap dari seratus, naik ke seribu, melonjak ke lima ribu, lalu turun lagi ke seratus, masing masing tahap dua menit. Yang menarik di sini bukan angka puncaknya, melainkan bagaimana sistem pulih setelah dihantam.

S6 Endurance Test justru yang paling penting untuk kesimpulan. Bebannya sedang saja, seribu sensor dengan interval lima detik, tetapi ditahan selama satu jam penuh. Skenario ini menjawab pertanyaan yang tidak bisa dijawab tes pendek, yaitu apakah sistem sanggup bertahan stabil dalam waktu lama pada beban yang secara teori masih di bawah kapasitasnya.

## Kode kunci yang menjadi jantung simulator

Inti dari seluruh pengujian ada di `simulator/mqtt-simulator.js`. Kelas `MqttSimulator` tidak membuka satu koneksi MQTT untuk setiap sensor, karena itu akan boros dan tidak realistis. Ia memakai kolam koneksi kecil, secara bawaan sepuluh klien, lalu membagi beban ribuan sensor virtual ke atas kolam itu secara bergiliran.

Yang membuat simulasinya terasa alami adalah cara ia menjadwalkan pengiriman. Setiap sensor punya waktu kirim berikutnya sendiri. Ada loop yang berdetak tiap lima puluh milidetik, memeriksa sensor mana yang sudah waktunya mengirim, menembakkan payload untuk sensor itu, lalu menjadwalkan giliran selanjutnya sejauh satu interval ke depan.

```js
this._timer = setInterval(async () => {
  const now = Date.now();
  if (now >= endAt) { /* selesai, resolve stats */ return; }

  const due = this._sensors.filter((s) => s.nextSendAt <= now);
  for (const sensor of due) {
    await this._publishOne(sensor);
    sensor.messagesSent += 1;
    sensor.nextSendAt = now + intervalSec * 1000;
  }
}, tickMs);
```

Sebelum loop berjalan, daftar sensor dilewatkan ke `staggerInitialDelay`. Fungsi ini menyebar waktu kirim pertama tiap sensor supaya mereka tidak serentak menembak pada detik nol. Tanpa penyebaran ini, seribu sensor akan meledak bersamaan di awal dan menghasilkan gelombang palsu yang tidak mencerminkan lalu lintas nyata.

Untuk skenario spike, kelas ini menyediakan `reconfigure`. Alih alih membangun ulang segalanya, ia cukup menukar himpunan sensor aktif di antara tahap, sehingga transisi dari seratus ke lima ribu sensor terjadi mulus tanpa memutus koneksi.

Pengiriman sendiri memakai QoS nol pada `_publishOne`. Artinya broker tidak menjamin pengantaran, yang memang tepat untuk telemetry sensor bervolume tinggi. Setiap keberhasilan menambah penghitung `published`, setiap kegagalan menambah `publishErrors`, dan dari sini lahir laju kirim yang dilaporkan.

## Kode kunci yang mengatur eksekusi dan pengukuran

Simulator hanya menembakkan pesan. Yang mengubahnya menjadi eksperimen terukur adalah `runner/run-scenario.js`.

Hal pertama yang dilakukan runner ketika sebuah skenario dijalankan adalah menanyakan mode ingest ke backend.

```js
async function fetchIngestMode(env) {
  const res = await fetch(`${env.MONITORING_URL}/`);
  const data = await res.json();
  return data.ingestMode || "direct";
}
```

Di sinilah letak seluruh perbedaan antara dua laporan. Layanan monitoring memutuskan modenya sendiri dari variabel lingkungan `USE_RABBITMQ`. Bila menyala, ia melaporkan dirinya sebagai `rabbitmq` dan pesan mengalir lewat antrian. Bila mati, ia melaporkan `direct` dan pesan ditulis langsung ke database. Runner tinggal mengikuti apa yang dikatakan backend, lalu menyesuaikan perlakuannya. Untuk mode antrian, ia memastikan antrian bersih sebelum mulai supaya sisa run sebelumnya tidak mencemari hasil. Untuk mode langsung, langkah itu dilewati karena tidak ada antrian untuk diperiksa.

Setelah pemanasan singkat dan pengambilan garis dasar jumlah baris database, simulator dijalankan selama durasi skenario. Bagian yang sering luput dari perhatian justru yang paling menentukan angka reliabilitas, yaitu masa pendinginan. Fungsi `waitForQueueDrain` terus memantau sampai jumlah baris yang benar benar masuk database mencapai hampir seluruh pesan yang dikirim, atau sampai batas waktu pendinginan habis.

Dari sinilah metrik hilang dihitung. Runner membandingkan berapa yang dikirim simulator dengan berapa baris yang bertambah di database, lalu selisihnya disebut pesan hilang.

```js
const missing = Math.max(published - dbRows, 0);
const missingPct = published > 0 ? (missing / published) * 100 : 0;
```

Definisi ini penting untuk dibaca dengan jujur. Pada pipeline antrian, pesan yang masih menumpuk di RabbitMQ ketika jendela pengukuran ditutup ikut terhitung hilang, padahal secara teknis belum tentu lenyap permanen. Sebaliknya pada mode langsung, tidak ada tempat menunggu, sehingga pesan yang tidak sempat ditulis benar benar hilang.

Angka latency berasal dari kolektor `backend-metrics.js`, yang tiap lima detik menyapa endpoint `/stats/ingest` untuk mengambil laju terima, laju proses, kedalaman antrian, penggunaan memori, serta latensi rata rata dan persentil. Latensi di sini bermakna waktu tempuh pesan dari saat diterima sampai selesai diproses. Ketika sistem sehat, angkanya puluhan atau ratusan milidetik. Ketika tersumbat, angkanya membengkak menjadi ratusan ribu milidetik, yang sebenarnya adalah cara statistik mengatakan bahwa pesan mengantre sangat lama sebelum sempat ditulis.

## Perbandingan hasil kedua pipeline

Pada beban ringan, keduanya sama sama baik, bahkan mode langsung sedikit lebih gesit. Di S1, pipeline antrian mencatat latensi rata rata sekitar lima belas milidetik, sementara mode langsung hanya sekitar sembilan milidetik dengan persentil sembilan puluh lima di sekitar sembilan belas milidetik. Wajar. Tanpa antrian, pesan tidak perlu singgah di mana pun sebelum ditulis, sehingga jalurnya lebih pendek.

Di S2 pola itu masih terlihat. Mode langsung tetap ringan dengan persentil sembilan puluh lima sekitar seratus tujuh puluh dua milidetik. Pipeline antrian mulai menunjukkan ongkos penyangganya, dengan latensi yang lebih tinggi karena setiap pesan harus melewati satu hop tambahan dan menunggu giliran konsumsi. Ini pelajaran pertama yang penting. Antrian tidak gratis, ia menambah sedikit keterlambatan pada beban sedang.

Perpisahan sesungguhnya terjadi mulai S3. Laju kirim melompat ke hampir seribu pesan per detik, sementara kemampuan proses backend mentok di kisaran seratus sampai seratus tiga puluh pesan per detik. Jurang ini tidak mungkin ditutup, dan di sinilah watak kedua pipeline terlihat jelas. Pada mode antrian, tumpukan pesan tertahan di RabbitMQ, dengan kedalaman antrian menembus lima ratus ribu lebih, tetapi memori backend tetap terkendali di sekitar tiga ratus tujuh puluh megabita. Pada mode langsung, tidak ada penampung, sehingga tekanan berpindah ke proses itu sendiri dan memori melonjak ke sekitar dua ribu dua ratus megabita.

S4 mengonfirmasi bahwa keduanya memang bisa dipatahkan. Pada lima ribu pesan per detik, mode antrian nyaris tidak menuliskan apa apa ke database selama jendela pengukuran karena hampir semuanya masih terjebak di antrian dan backend akhirnya kehabisan memori. Mode langsung pun ambruk dengan tingkat hilang di atas sembilan puluh delapan persen. Pesan dari skenario ini bukan bahwa sistem gagal, melainkan bahwa titik runtuh berhasil ditemukan, yang justru merupakan tujuan sebuah stress test.

S5 memperlihatkan reaksi terhadap lonjakan. Pipeline antrian menyerap hentakan dengan menampungnya di buffer, membuat kedalaman antrian sangat tinggi namun tetap menjaga backend hidup. Mode langsung tidak punya bantalan itu, sehingga lonjakan langsung menampar database dan sebagian besar pesan tidak selamat.

S6 adalah bagian yang paling layak dijadikan sandaran kesimpulan, dan sekaligus paling kontras. Bebannya sedang, hanya sekitar dua ratus pesan per detik, tetapi ditahan satu jam penuh. Pada pipeline antrian, hasilnya rapi. Sekitar seratus sembilan puluh delapan pesan per detik diproses, tingkat hilang nol persen, penggunaan memori stabil di sekitar seratus sembilan puluh megabita, dan persentil sembilan puluh lima latensi hanya dua ratus enam puluh empat milidetik sepanjang seluruh durasi. Pada mode langsung, dengan beban yang sama persis, sistem justru gagal bertahan. Laju proses melorot ke sekitar seratus dua pesan per detik, tingkat hilang mencapai empat puluh dua persen, memori merangkak naik terus sampai lebih dari tiga ribu dua ratus megabita, dan latensi meledak ke ratusan ribu milidetik.

## Mengapa hasilnya seperti itu

Perbandingan S6 menyingkap inti persoalannya. Beban dua ratus pesan per detik sebenarnya sanggup dilayani, terbukti dari pipeline antrian yang menuntaskannya tanpa kehilangan satu pesan pun selama satu jam. Masalahnya, aliran sensor tidak pernah benar benar rata. Selalu ada riak, ada detik yang lebih padat dari detik lain. Tanpa penampung, setiap riak kecil itu langsung menekan proses penulisan, dan ketika penulisan tersendat, pesan berikutnya menumpuk di dalam memori proses. Tumpukan itu tidak punya tempat pembuangan yang teratur, sehingga memori terus membesar, memicu tekanan yang justru memperlambat proses, lalu berputar menjadi lingkaran yang makin buruk sepanjang jam.

RabbitMQ memutus lingkaran itu. Ia memberi tempat menunggu yang murah bagi lonjakan sesaat, membiarkan konsumen menuliskannya ke database dengan lajunya sendiri. Beban puncak diratakan menjadi aliran yang lebih tenang, memori tetap kecil karena tumpukan tersimpan di antrian, bukan di dalam proses.

Kesimpulan yang bisa dipertanggungjawabkan dari kedua laporan adalah sebagai berikut. Pada beban ringan, penulisan langsung sedikit lebih cepat dan lebih hemat, tetapi rapuh. Pada beban tinggi maupun beban sedang yang berlangsung lama, hanya pipeline berantrian yang mampu menjaga integritas data dan kestabilan memori. Untuk sistem monitoring yang harus hidup terus menerus, ketahanan jangka panjang jauh lebih berharga daripada keunggulan latensi beberapa milidetik pada kondisi santai.

Karena itu, hasil ini menjadi dasar sebuah keputusan desain pada backend, yaitu mempertahankan antrian pesan sebagai penyangga di depan penyimpanan alih alih menulis langsung ke database. Perbandingan ini adalah evaluasi terhadap rancangan aplikasi yang dibangun, bukan penilaian atas kapasitas perangkat infrastruktur yang dipakainya.

## Batas yang perlu dinyatakan terus terang

Beberapa hal harus disampaikan apa adanya agar laporan ini tidak menjanjikan lebih dari yang sebenarnya diukur.

Angka hilang pada pipeline antrian sebagian adalah akibat jendela pengukuran. Pesan yang masih mengantre saat pendinginan berakhir dihitung hilang, meski sebenarnya bisa habis dikonsumsi bila ditunggu lebih lama. Pada mode langsung tidak ada nuansa ini, sebab tanpa antrian pesan yang tidak tertulis memang lenyap.

Semua pengujian berjalan pada satu instance dan pada satu mesin. Hasilnya menggambarkan perilaku satu instance layanan backend, bukan sistem yang diskalakan mendatar dengan banyak konsumen. Perbaikan pada sisi kode untuk beban di atas titik runtuh, seperti penambahan konsumen paralel dan penulisan database secara batch, belum diterapkan di sini dan menjadi bahan pekerjaan lanjutan.

Terakhir, jumlah sensor bukan jumlah pengguna. Pengujian ini menilai keandalan kode ingest backend dalam menyerap telemetry, sedangkan beban pengguna dashboard diuji terpisah dengan alat dan skenario yang berbeda. Keduanya adalah pengujian pada aplikasi yang dibangun, bukan pengujian kapasitas infrastruktur. Angka di dalam dokumen ini tidak dimaksudkan sebagai tolok ukur MQTT broker, RabbitMQ, atau PostgreSQL secara tersendiri, melainkan sebagai bukti bagaimana rancangan ingest backend berperilaku saat menghadapinya.
