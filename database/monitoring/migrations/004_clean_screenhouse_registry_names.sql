-- Sinkron nama registry dengan app DB (hapus sufiks em dash)
BEGIN;

UPDATE screenhouse_registry
SET screenhouse_name = TRIM(SPLIT_PART(screenhouse_name, ' — ', 1))
WHERE screenhouse_name LIKE '% — %';

UPDATE screenhouse_registry
SET screenhouse_name = TRIM(SPLIT_PART(screenhouse_name, ' - ', 1))
WHERE screenhouse_name LIKE '% - %';

COMMIT;
