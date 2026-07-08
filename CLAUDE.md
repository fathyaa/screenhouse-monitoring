# CLAUDE.md

Konteks kerja untuk Claude Code di repo ini. Untuk instalasi/menjalankan service, baca `README.md` — dokumen ini fokus ke hal yang tidak langsung kelihatan dari kode.

## Apa ini

BibitLive — monitoring screenhouse pembibitan padi (sensor NPK, kelembapan, suhu, EC, cahaya) untuk 3 role: **petani**, **operator**, **super_admin**. React frontend + 2 backend service Node/Express + 2 Postgres DB terpisah + MQTT + Redis + Socket.IO.

## Arsitektur singkat

- `frontend/` — React + Vite + Tailwind, semua role dalam satu app, routing berbasis role di `App.jsx`.
- `services/app-service/` — identity (users, auth) + catalog (screenhouses, thresholds, semai_cycles, wilayah). DB `screenhouse_app` (port host 5434).
- `services/monitoring-service/` — ingest sensor via MQTT, alerting, realtime (Socket.IO), stats. DB `screenhouse_monitoring` (port host 5433).
- Kedua service komunikasi lewat Redis pub/sub (channel `alert-created`, `alert-resolved`, `sensor-update`) dan HTTP langsung (app-service → monitoring-service via `MONITORING_SERVICE_URL`).
- **`screenhouse_id` disinkron manual antar 2 DB** — bukan foreign key sungguhan, cuma konvensi. Kalau bikin data seed/migrasi yang menyentuh screenhouse, wajib insert row yang konsisten di kedua DB dengan id yang sama.

## Sebelum menulis seed data / migrasi

DB dev ini bukan database kosong — sudah ada data load-test dalam jumlah besar (ratusan user & screenhouse). **Selalu `SELECT MAX(id)`** di tabel terkait (`screenhouses`, `thresholds`, `semai_cycles` di app db; `screenhouse_registry`, `sink_nodes`, `sensor_nodes` di monitoring db) sebelum memilih id baru — jangan asumsikan id kecil (1-3) masih kosong.

## Format pesan alert (jangan diubah tanpa update kedua sisi)

Backend generate pesan alert dengan pola persis: `"{label} di bawah batas minimum"` / `"{label} melebihi batas maksimum"`, label berbahasa Indonesia (Nitrogen, Phosphorus, Potassium, Kelembapan tanah, Suhu tanah, pH tanah, Konduktivitas, Suhu udara, Kelembapan udara, Intensitas cahaya). Frontend **mem-parsing string ini via keyword-matching** di `frontend/src/constants/actuatorRules.js` (`getActuatorHintForAlert`, `isAutoHandledAlert`) untuk menentukan apakah alert "ditangani otomatis" oleh aktuator. Kalau ubah label/format pesan di backend, update juga keyword matching di file itu.

## Alert hysteresis

`services/monitoring-service/src/modules/alerting/worker.js` pakai margin 5% (`HYSTERESIS_RATIO`) antara nilai pelanggaran dan nilai pemulihan supaya alert tidak flapping (create → resolve → create berulang) saat sensor berosilasi di sekitar threshold.

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
