const pool = require("../config/db");
const monitoringPool = require("../config/monitoringDb");
const {
  wibDateStr,
  lastNDaysWib,
  computeDailyStressScores,
  average,
  computeEstimasiTanam,
} = require("./estimasiTanam");

async function fetchScreenhouseEstimasiContext(client, screenhouseId) {
  const db = client ?? pool;
  const result = await db.query(
    `
    SELECT
      s.id,
      to_char(s.tanggal_semai, 'YYYY-MM-DD') AS tanggal_semai,
      to_char(s.seedling_start_date, 'YYYY-MM-DD') AS seedling_start_date,
      to_char(s.estimasi_siap_tanam, 'YYYY-MM-DD') AS estimasi_siap_tanam,
      s.status_estimasi,
      vb.nama AS varietas_nama,
      vb.durasi_pembibitan_hari
    FROM screenhouses s
    LEFT JOIN varietas_bibit vb ON vb.id = s.varietas_id
    WHERE s.id = $1
    `,
    [screenhouseId]
  );
  return result.rows[0] ?? null;
}

async function fetchThreshold(screenhouseId) {
  const result = await pool.query(`SELECT * FROM thresholds WHERE screenhouse_id = $1`, [
    screenhouseId,
  ]);
  return result.rows[0] ?? null;
}

async function fetchSevenDaySensorStats(screenhouseId) {
  if (!monitoringPool) {
    return { dailyNodeRows: [], daysWithData: new Set() };
  }

  const result = await monitoringPool.query(
    `
    SELECT
      to_char((sd.created_at AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY-MM-DD') AS day,
      sn.id AS node_id,
      sn.node_code,
      sn.node_name,
      AVG(sd.nitrogen)::float AS nitrogen,
      AVG(sd.phosphorus)::float AS phosphorus,
      AVG(sd.potassium)::float AS potassium,
      AVG(sd.soil_moisture)::float AS soil_moisture,
      AVG(sd.soil_temperature)::float AS soil_temperature,
      AVG(sd.soil_ph)::float AS soil_ph
    FROM sensor_data sd
    INNER JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
    WHERE sn.screenhouse_id = $1
      AND sn.is_active = true
      AND sd.created_at >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date - INTERVAL '6 days'
    GROUP BY day, sn.id, sn.node_code, sn.node_name
    ORDER BY day
    `,
    [screenhouseId]
  );

  const daysWithData = new Set(
    result.rows.map((r) => String(r.day).slice(0, 10))
  );
  return { dailyNodeRows: result.rows, daysWithData };
}

function countOfflineDays(daysWithData) {
  const window = lastNDaysWib(7);
  return window.filter((d) => !daysWithData.has(d)).length;
}

async function fetchEstimasiContextBatch(screenhouseIds) {
  if (!screenhouseIds.length) return {};
  const result = await pool.query(
    `
    SELECT
      s.id,
      to_char(s.tanggal_semai, 'YYYY-MM-DD') AS tanggal_semai,
      to_char(s.seedling_start_date, 'YYYY-MM-DD') AS seedling_start_date,
      to_char(s.estimasi_siap_tanam, 'YYYY-MM-DD') AS estimasi_siap_tanam,
      s.status_estimasi,
      vb.nama AS varietas_nama,
      vb.durasi_pembibitan_hari
    FROM screenhouses s
    LEFT JOIN varietas_bibit vb ON vb.id = s.varietas_id
    WHERE s.id = ANY($1::int[])
    `,
    [screenhouseIds]
  );
  return Object.fromEntries(result.rows.map((r) => [r.id, r]));
}

async function fetchThresholdBatch(screenhouseIds) {
  if (!screenhouseIds.length) return {};
  const result = await pool.query(
    `SELECT * FROM thresholds WHERE screenhouse_id = ANY($1::int[])`,
    [screenhouseIds]
  );
  return Object.fromEntries(result.rows.map((r) => [r.screenhouse_id, r]));
}

async function fetchSevenDaySensorStatsBatch(screenhouseIds) {
  if (!monitoringPool || !screenhouseIds.length) return {};

  const result = await monitoringPool.query(
    `
    SELECT
      sn.screenhouse_id,
      to_char((sd.created_at AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY-MM-DD') AS day,
      sn.id AS node_id,
      sn.node_code,
      sn.node_name,
      AVG(sd.nitrogen)::float AS nitrogen,
      AVG(sd.phosphorus)::float AS phosphorus,
      AVG(sd.potassium)::float AS potassium,
      AVG(sd.soil_moisture)::float AS soil_moisture,
      AVG(sd.soil_temperature)::float AS soil_temperature,
      AVG(sd.soil_ph)::float AS soil_ph
    FROM sensor_data sd
    INNER JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
    WHERE sn.screenhouse_id = ANY($1::int[])
      AND sn.is_active = true
      AND sd.created_at >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date - INTERVAL '6 days'
    GROUP BY sn.screenhouse_id, day, sn.id, sn.node_code, sn.node_name
    ORDER BY sn.screenhouse_id, day
    `,
    [screenhouseIds]
  );

  const bySh = {};
  for (const row of result.rows) {
    if (!bySh[row.screenhouse_id]) {
      bySh[row.screenhouse_id] = { dailyNodeRows: [], daysWithData: new Set() };
    }
    bySh[row.screenhouse_id].dailyNodeRows.push(row);
    bySh[row.screenhouse_id].daysWithData.add(String(row.day).slice(0, 10));
  }
  return bySh;
}

function computeEstimasiFromContext(ctx, threshold, sensorStats) {
  const tanggalSemai = ctx.tanggal_semai ?? ctx.seedling_start_date;
  const tanggalSemaiStr = tanggalSemai ? String(tanggalSemai).slice(0, 10) : null;
  const dailyNodeRows = sensorStats?.dailyNodeRows ?? [];
  const daysWithData = sensorStats?.daysWithData ?? new Set();
  const dailyScores = computeDailyStressScores(dailyNodeRows, threshold);
  const avgStress = average(dailyScores);
  const offlineDays = countOfflineDays(daysWithData);

  const estimasi = computeEstimasiTanam({
    tanggalSemai: tanggalSemaiStr,
    durasiPembibitanHari: ctx.durasi_pembibitan_hari,
    avgStressScore7d: avgStress,
    offlineDays7d: offlineDays,
    todayStr: wibDateStr(),
  });

  return {
    ...estimasi,
    varietas_nama: ctx.varietas_nama ?? null,
  };
}

async function buildEstimasiTanamBatch(screenhouseIds, { persist = false } = {}) {
  if (!screenhouseIds.length) return {};

  const [contextMap, thresholdMap, sensorMap] = await Promise.all([
    fetchEstimasiContextBatch(screenhouseIds),
    fetchThresholdBatch(screenhouseIds),
    fetchSevenDaySensorStatsBatch(screenhouseIds),
  ]);

  const result = {};
  const persistRows = [];

  for (const id of screenhouseIds) {
    const ctx = contextMap[id];
    if (!ctx) continue;
    const payload = computeEstimasiFromContext(
      ctx,
      thresholdMap[id] ?? null,
      sensorMap[id]
    );
    result[id] = payload;
    if (persist && payload.estimasi_siap && payload.status) {
      persistRows.push([id, payload.estimasi_siap, payload.status]);
    }
  }

  if (persistRows.length) {
    await Promise.all(
      persistRows.map(([id, estimasiSiap, status]) =>
        pool.query(
          `
          UPDATE screenhouses
          SET estimasi_siap_tanam = $2::date,
              status_estimasi = $3
          WHERE id = $1
          `,
          [id, estimasiSiap, status]
        )
      )
    );
  }

  return result;
}

async function buildEstimasiTanam(screenhouseId, { persist = true } = {}) {
  const ctx = await fetchScreenhouseEstimasiContext(null, screenhouseId);
  if (!ctx) return null;

  const threshold = await fetchThreshold(screenhouseId);
  const sensorStats = await fetchSevenDaySensorStats(screenhouseId);
  const payload = computeEstimasiFromContext(ctx, threshold, sensorStats);

  if (persist && payload.estimasi_siap && payload.status) {
    await pool.query(
      `
      UPDATE screenhouses
      SET estimasi_siap_tanam = $2::date,
          status_estimasi = $3
      WHERE id = $1
      `,
      [screenhouseId, payload.estimasi_siap, payload.status]
    );
  }

  return payload;
}

module.exports = {
  fetchScreenhouseEstimasiContext,
  buildEstimasiTanam,
  buildEstimasiTanamBatch,
};
