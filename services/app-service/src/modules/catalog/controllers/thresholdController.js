const pool = require("../../../config/db");
const { publishEvent } = require("../../../shared/events/publisher");

const THRESHOLD_FIELDS = [
  "min_nitrogen", "max_nitrogen",
  "min_phosphorus", "max_phosphorus",
  "min_potassium", "max_potassium",
  "min_soil_moisture", "max_soil_moisture",
  "min_soil_temperature", "max_soil_temperature",
  "min_soil_ph", "max_soil_ph",
  "min_conductivity", "max_conductivity",
  "min_air_temperature", "max_air_temperature",
  "min_air_humidity", "max_air_humidity",
  "min_light_intensity", "max_light_intensity",
];

function buildWilayahFilter(query, params) {
  const conditions = ["s.status = 'active'"];

  if (query.regency_id) {
    params.push(Number(query.regency_id));
    conditions.push(`s.regency_id = $${params.length}`);
  }
  if (query.district_id) {
    params.push(Number(query.district_id));
    conditions.push(`s.district_id = $${params.length}`);
  }
  if (query.village_id) {
    params.push(Number(query.village_id));
    conditions.push(`s.village_id = $${params.length}`);
  }
  if (query.search?.trim()) {
    params.push(`%${query.search.trim()}%`);
    conditions.push(`(s.name ILIKE $${params.length} OR u.name ILIKE $${params.length})`);
  }

  return conditions;
}

async function listThresholds(req, res) {
  try {
    const params = [];
    const conditions = buildWilayahFilter(req.query, params);

    const result = await pool.query(
      `
      SELECT
        s.id AS screenhouse_id,
        s.name AS screenhouse_name,
        u.name AS owner_name,
        p.name AS province,
        r.name AS regency,
        d.name AS district,
        v.name AS village,
        t.id AS threshold_id,
        t.min_nitrogen, t.max_nitrogen,
        t.min_phosphorus, t.max_phosphorus,
        t.min_potassium, t.max_potassium,
        t.min_soil_moisture, t.max_soil_moisture,
        t.min_soil_temperature, t.max_soil_temperature,
        t.min_soil_ph, t.max_soil_ph,
        t.min_conductivity, t.max_conductivity,
        t.min_air_temperature, t.max_air_temperature,
        t.min_air_humidity, t.max_air_humidity,
        t.min_light_intensity, t.max_light_intensity,
        t.varietas_id AS threshold_varietas_id,
        t.manual_override,
        vb.nama AS varietas_nama,
        vb.sumber_referensi AS varietas_sumber
      FROM screenhouses s
      JOIN users u ON u.id = s.owner_user_id
      JOIN provinces p ON p.id = s.province_id
      JOIN regencies r ON r.id = s.regency_id
      JOIN districts d ON d.id = s.district_id
      JOIN villages v ON v.id = s.village_id
      LEFT JOIN thresholds t ON t.screenhouse_id = s.id
      LEFT JOIN varietas_bibit vb ON t.varietas_id = vb.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY s.name ASC
      `,
      params
    );

    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getThreshold(req, res) {
  try {
    const { screenhouseId } = req.params;
    const result = await pool.query(
      `SELECT * FROM thresholds WHERE screenhouse_id = $1`,
      [screenhouseId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: "Threshold belum diset untuk screenhouse ini" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function upsertThresholdForScreenhouse(screenhouseId, body, client = pool) {
  const shCheck = await client.query(
    `SELECT id FROM screenhouses WHERE id = $1 AND status = 'active'`,
    [screenhouseId]
  );
  if (!shCheck.rows[0]) {
    const err = new Error("Screenhouse tidak ditemukan");
    err.status = 404;
    throw err;
  }

  const values = THRESHOLD_FIELDS.map((f) => body[f] ?? null);
  const existing = await client.query(
    `SELECT id FROM thresholds WHERE screenhouse_id = $1`,
    [screenhouseId]
  );

  let result;
  if (existing.rows[0]) {
    const setClause = THRESHOLD_FIELDS.map((f, i) => `${f} = $${i + 1}`).join(", ");
    result = await client.query(
      `UPDATE thresholds SET ${setClause}, manual_override = true WHERE screenhouse_id = $${THRESHOLD_FIELDS.length + 1} RETURNING *`,
      [...values, screenhouseId]
    );
  } else {
    const cols = ["screenhouse_id", ...THRESHOLD_FIELDS].join(", ");
    const placeholders = THRESHOLD_FIELDS.map((_, i) => `$${i + 2}`).join(", ");
    result = await client.query(
      `INSERT INTO thresholds (${cols}) VALUES ($1, ${placeholders}) RETURNING *`,
      [screenhouseId, ...values]
    );
  }

  await publishEvent("threshold.updated", {
    screenhouse_id: Number(screenhouseId),
    ...result.rows[0],
  });

  return result.rows[0];
}

async function upsertThreshold(req, res) {
  try {
    const { screenhouseId } = req.params;
    const row = await upsertThresholdForScreenhouse(screenhouseId, req.body);
    res.json(row);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ message: err.message });
    }
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function bulkUpsertThreshold(req, res) {
  const { screenhouse_ids: rawIds, ...thresholdBody } = req.body;
  const screenhouseIds = [...new Set((rawIds || []).map(Number).filter(Boolean))];

  if (!screenhouseIds.length) {
    return res.status(400).json({ message: "Pilih minimal satu screenhouse" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = [];
    for (const screenhouseId of screenhouseIds) {
      const row = await upsertThresholdForScreenhouse(screenhouseId, thresholdBody, client);
      updated.push(row);
    }
    await client.query("COMMIT");
    res.json({ updated_count: updated.length, screenhouse_ids: screenhouseIds });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.status === 404) {
      return res.status(404).json({ message: err.message });
    }
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
}

module.exports = { listThresholds, getThreshold, upsertThreshold, bulkUpsertThreshold };
