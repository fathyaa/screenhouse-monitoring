-- =========================================
-- APP DB migrations — screenhouse_app (port 5434)
-- Lanjutan setelah migrations.sql. Idempotent: aman dijalankan berulang.
--
--   psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/migrations2.sql
-- =========================================

BEGIN;

-- ─── Preferensi notifikasi (satu flag akun, dipakai web & HP) ───
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_muted BOOLEAN NOT NULL DEFAULT false;

COMMIT;
