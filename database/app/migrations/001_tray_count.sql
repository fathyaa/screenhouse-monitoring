-- Tambah kolom tray_count pada screenhouses (jumlah sensor node / tray terpasang).
-- Jalankan sekali pada DB yang sudah ada:
--   psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/migrations/001_tray_count.sql

BEGIN;

ALTER TABLE screenhouses
  ADD COLUMN IF NOT EXISTS tray_count INTEGER NOT NULL DEFAULT 1
  CHECK (tray_count >= 1 AND tray_count <= 20);

COMMIT;
