# Diagram TA — Draw.io

File `.drawio` untuk Bab 3 (perancangan). Buka dengan [diagrams.net](https://app.diagrams.net) atau Draw.io Desktop.

## Daftar file

| File | Isi | Caption saran | Wajib? |
|------|-----|---------------|--------|
| `09-erd-app-database.drawio` | ERD `screenhouse_app` (8 tabel) | Gambar III-4 | ✅ |
| `10-erd-monitoring-database.drawio` | ERD `screenhouse_monitoring` (5 tabel) | Gambar III-5 | ✅ |
| `11-erd-sinkronisasi-antar-db.drawio` | Relasi sync antar 2 database | Gambar III-6 | ✅ |
| `01-arsitektur-sistem.drawio` | Arsitektur layered microservices | Gambar III-X | ✅ |
| `05-deployment-diagram.drawio` | Deployment (Docker + Node.js + IoT) | Gambar III-AB | ✅ |
| `06-sequence-increment-1-monitoring.drawio` | Sequence — MQTT ingest + dashboard | Gambar III-AC | ✅ |
| `07-sequence-increment-2-analisis.drawio` | Sequence — tren & grafik | Gambar III-AD | ✅ |
| `08-sequence-increment-3-notifikasi.drawio` | Sequence — alert + notifikasi | Gambar III-AE | ✅ |
| `02-activity-increment-1-monitoring.drawio` | Activity **awam** — Petani + Operator + Sistem | Gambar III-Y | ✅ |
| `03-activity-increment-2-analisis.drawio` | Activity **awam** — Petani + Sistem | Gambar III-Z | ✅ |
| `04-activity-increment-3-notifikasi.drawio` | Activity **awam** — Admin + Petani + Sistem | Gambar III-AA | ✅ |

## Rekomendasi diagram untuk TA

| Kebutuhan | Diagram | Bahasa |
|-----------|---------|--------|
| Proses bisnis tradisional (AS-IS) | **Activity** (1 diagram) | Awam |
| Alur user ↔ sistem per increment | **Activity** (3 diagram) | Awam — tanpa MQTT/API |
| Interaksi teknis antar komponen | **Sequence** (3 diagram) | Teknis — untuk pembaca IT |
| Infrastruktur fisik/deployment | **Deployment** (1 diagram) | Semi-teknis |
| Arsitektur logis | **Arsitektur** (1 diagram) | Semi-teknis |

**Activity + Sequence tidak redundant** selama fokusnya beda: Activity = *what* (pengguna & sistem), Sequence = *how* (pesan antar service).

## Cara buka

1. Buka https://app.diagrams.net
2. **File → Open from → Device**
3. Pilih file `.drawio` dari folder ini

Atau drag-and-drop file ke browser.

## Export ke Word

1. **File → Export as → PNG** (300 DPI untuk cetak)
2. Atau **SVG** jika kampus menerima vektor
3. Sisipkan ke Word dengan caption sesuai tabel di atas

## Tips edit

- Geser node jika garis overlap — layout awal sudah benar secara logika, mungkin perlu dirapikan visual
- Untuk swimlane vertikal: klik pool → kanan panel **Arrange → Insert → Swimlane**
- Warna swimlane sudah dikode per komponen (IoT kuning, backend biru, frontend ungu, dll.)
