-- Sinkronkan kode node lama (SHxx-Nxx) ke model tray (SHxx-Txx) untuk 3 screenhouse demo.
-- Jalankan jika live-simulasi / mqtt-simulasi tidak masuk ke DB (node_id tidak dikenali).
--
--   psql -h localhost -p 5433 -U postgres -d screenhouse_monitoring \
--     -f database/monitoring/data/migrate_tray_node_codes.sql

BEGIN;

UPDATE sensor_nodes
SET node_code = 'SH01-T01', node_name = 'Tray A1', location = 'Baris 1 kolom A'
WHERE screenhouse_id = 1 AND node_code = 'SH01-N01';

UPDATE sensor_nodes
SET node_code = 'SH01-T02', node_name = 'Tray B1', location = 'Baris 1 kolom B'
WHERE screenhouse_id = 1 AND node_code = 'SH01-N02';

UPDATE sensor_nodes
SET node_code = 'SH02-T01', node_name = 'Tray A1', location = 'Pusat pembibitan'
WHERE screenhouse_id = 2 AND node_code = 'SH02-N01';

UPDATE sensor_nodes
SET node_code = 'SH03-T01', node_name = 'Tray A1', location = 'Dekat jalan desa'
WHERE screenhouse_id = 3 AND node_code = 'SH03-N01';

COMMIT;
