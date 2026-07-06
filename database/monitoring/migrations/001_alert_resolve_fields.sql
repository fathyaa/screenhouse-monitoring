-- Tambahan kolom resolve alert (idempotent untuk DB yang sudah jalan)
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolve_note VARCHAR(255);
