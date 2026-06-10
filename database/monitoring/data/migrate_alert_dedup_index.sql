-- Dedup alert active: satu record per screenhouse + node + pesan.
-- Jalankan sekali jika DB sudah ada sebelum index ini ditambahkan:
--   psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring \
--     -f database/monitoring/data/migrate_alert_dedup_index.sql

BEGIN;

-- Tutup duplikat active (simpan yang paling baru)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY screenhouse_id, sensor_node_id, message
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM alerts
  WHERE status = 'active'
)
UPDATE alerts a
SET status = 'resolved'
FROM ranked r
WHERE a.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_active_dedup
    ON alerts (screenhouse_id, sensor_node_id, message)
    WHERE status = 'active';

COMMIT;
