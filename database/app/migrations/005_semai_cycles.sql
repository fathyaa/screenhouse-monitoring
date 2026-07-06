-- Siklus semai: riwayat pembibitan per screenhouse (start/end, analytics)
BEGIN;

CREATE TABLE IF NOT EXISTS semai_cycles (
  id SERIAL PRIMARY KEY,
  screenhouse_id INTEGER NOT NULL REFERENCES screenhouses(id) ON DELETE CASCADE,
  varietas_id INTEGER REFERENCES varietas_bibit(id),
  varietas_nama VARCHAR(100),
  tanggal_mulai DATE NOT NULL,
  tanggal_selesai DATE,
  estimasi_siap DATE,
  durasi_target_hari INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed')),
  grade CHAR(1) CHECK (grade IN ('A', 'B', 'C')),
  analytics JSONB,
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_semai_cycles_screenhouse ON semai_cycles(screenhouse_id);
CREATE INDEX IF NOT EXISTS idx_semai_cycles_status ON semai_cycles(screenhouse_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_semai_cycles_one_active
  ON semai_cycles(screenhouse_id)
  WHERE status = 'active';

-- Backfill siklus aktif dari profil screenhouse yang sudah ada
INSERT INTO semai_cycles (
  screenhouse_id,
  varietas_id,
  varietas_nama,
  tanggal_mulai,
  estimasi_siap,
  durasi_target_hari,
  status
)
SELECT
  s.id,
  s.varietas_id,
  COALESCE(vb.nama, s.seed_variety),
  COALESCE(s.tanggal_semai, s.seedling_start_date),
  s.estimasi_siap_tanam,
  vb.durasi_pembibitan_hari,
  'active'
FROM screenhouses s
LEFT JOIN varietas_bibit vb ON vb.id = s.varietas_id
WHERE COALESCE(s.tanggal_semai, s.seedling_start_date) IS NOT NULL
  AND s.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM semai_cycles sc
    WHERE sc.screenhouse_id = s.id AND sc.status = 'active'
  );

COMMIT;
