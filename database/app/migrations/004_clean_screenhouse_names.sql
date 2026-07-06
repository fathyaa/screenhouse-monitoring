-- Hapus sufiks setelah em dash ( — ) pada nama screenhouse
BEGIN;

UPDATE screenhouses
SET name = TRIM(SPLIT_PART(name, ' — ', 1))
WHERE name LIKE '% — %';

UPDATE screenhouses
SET name = TRIM(SPLIT_PART(name, ' - ', 1))
WHERE name LIKE '% - %';

COMMIT;
