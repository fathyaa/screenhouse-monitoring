-- Estimasi siap tanam · idempotent
BEGIN;

ALTER TABLE screenhouses
  ADD COLUMN IF NOT EXISTS tanggal_semai DATE,
  ADD COLUMN IF NOT EXISTS estimasi_siap_tanam DATE,
  ADD COLUMN IF NOT EXISTS status_estimasi VARCHAR(30);

UPDATE screenhouses
SET tanggal_semai = seedling_start_date
WHERE tanggal_semai IS NULL AND seedling_start_date IS NOT NULL;

COMMIT;
