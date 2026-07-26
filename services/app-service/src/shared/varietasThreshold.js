const { DEFAULT_THRESHOLD, THRESHOLD_COLS } = require("./thresholdDefaults");

// Threshold disamakan untuk SEMUA varietas — selalu mengacu ke DEFAULT_THRESHOLD.
// Nilai per-varietas (kolom *_min/*_max di varietas_bibit) sengaja TIDAK dipakai
// lagi. Parameter `varietas` tetap diterima hanya untuk mencatat varietas_id di
// baris thresholds (lihat upsertThresholdFromVarietas), bukan mengubah angkanya.
function buildThresholdPayloadFromVarietas(varietas, screenhouseId) {
  const payload = { screenhouse_id: Number(screenhouseId) };

  THRESHOLD_COLS.forEach((col, i) => {
    payload[col] = DEFAULT_THRESHOLD[i];
  });

  return payload;
}

function buildThresholdValuesArray(varietas) {
  const payload = buildThresholdPayloadFromVarietas(varietas, 0);
  return THRESHOLD_COLS.map((col) => payload[col]);
}

async function fetchVarietasById(client, varietasId) {
  if (!varietasId) return null;
  const result = await client.query(`SELECT * FROM varietas_bibit WHERE id = $1`, [varietasId]);
  return result.rows[0] ?? null;
}

async function resolveVarietasId(client, varietasId) {
  if (varietasId == null || varietasId === "") return null;
  const id = Number(varietasId);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error("Varietas bibit tidak valid");
    err.status = 400;
    throw err;
  }
  const row = await fetchVarietasById(client, id);
  if (!row) {
    const err = new Error("Varietas bibit tidak ditemukan");
    err.status = 400;
    throw err;
  }
  return row;
}

async function upsertThresholdFromVarietas(client, screenhouseId, varietas, { manualOverride = false } = {}) {
  const payload = buildThresholdPayloadFromVarietas(varietas, screenhouseId);
  const varietasId = varietas?.id ?? null;

  const existing = await client.query(
    `SELECT id FROM thresholds WHERE screenhouse_id = $1`,
    [screenhouseId]
  );

  const cols = THRESHOLD_COLS;
  const values = cols.map((c) => payload[c]);

  if (existing.rows[0]) {
    const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
    await client.query(
      `
      UPDATE thresholds
      SET ${setClause},
          varietas_id = $${cols.length + 1},
          manual_override = $${cols.length + 2}
      WHERE screenhouse_id = $${cols.length + 3}
      `,
      [...values, varietasId, manualOverride, screenhouseId]
    );
  } else {
    const colList = ["screenhouse_id", ...cols, "varietas_id", "manual_override"].join(", ");
    const placeholders = cols.map((_, i) => `$${i + 2}`).join(", ");
    await client.query(
      `
      INSERT INTO thresholds (${colList})
      VALUES ($1, ${placeholders}, $${cols.length + 2}, $${cols.length + 3})
      ON CONFLICT (screenhouse_id) DO NOTHING
      `,
      [screenhouseId, ...values, varietasId, manualOverride]
    );
  }

  return payload;
}

module.exports = {
  buildThresholdPayloadFromVarietas,
  buildThresholdValuesArray,
  fetchVarietasById,
  resolveVarietasId,
  upsertThresholdFromVarietas,
};
