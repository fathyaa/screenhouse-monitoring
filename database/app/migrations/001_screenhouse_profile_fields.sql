-- Profil pembibitan screenhouse (idempotent)
ALTER TABLE screenhouses ADD COLUMN IF NOT EXISTS seed_variety VARCHAR(100);
ALTER TABLE screenhouses ADD COLUMN IF NOT EXISTS seedling_start_date DATE;
