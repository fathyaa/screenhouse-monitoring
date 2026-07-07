-- =========================================
-- MONITORING DB migrations — screenhouse_monitoring (port 5433)
-- Untuk instalasi yang sudah jalan sebelum schema terbaru.
-- Idempotent: aman dijalankan berulang.
--
--   psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring -f database/monitoring/migrations.sql
--
-- Fresh install cukup schema.sql + seed.sql (tidak wajib file ini).
-- =========================================

BEGIN;

-- ─── 1. Kolom resolve alert ───
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolve_note VARCHAR(255);

-- ─── 2. Bersihkan sufiks nama registry (em dash) ───
UPDATE screenhouse_registry
SET screenhouse_name = TRIM(SPLIT_PART(screenhouse_name, ' — ', 1))
WHERE screenhouse_name LIKE '% — %';

UPDATE screenhouse_registry
SET screenhouse_name = TRIM(SPLIT_PART(screenhouse_name, ' - ', 1))
WHERE screenhouse_name LIKE '% - %';

COMMIT;
