const pool = require("../config/db");
const monitoringPool = require("../config/monitoringDb");
const { publishEvent } = require("./events/publisher");
const { DEFAULT_THRESHOLD, THRESHOLD_COLS } = require("./thresholdDefaults");
const {
  fetchVarietasById,
  buildThresholdValuesArray,
  upsertThresholdFromVarietas,
} = require("./varietasThreshold");

const MAX_TRAY_COUNT = 20;

function parseTrayCount(val, defaultVal = 1) {
  if (val == null || val === "") return defaultVal;
  const n = Number(val);
  if (!Number.isInteger(n) || n < 1 || n > MAX_TRAY_COUNT) return null;
  return n;
}

function formatShCode(screenhouseId) {
  return `SH${String(screenhouseId).padStart(2, "0")}`;
}

function formatSinkCode(screenhouseId) {
  return `${formatShCode(screenhouseId)}-SINK`;
}

function formatTrayCode(screenhouseId, index) {
  return `${formatShCode(screenhouseId)}-T${String(index).padStart(2, "0")}`;
}

function buildThresholdPayload(screenhouseId) {
  const payload = { screenhouse_id: Number(screenhouseId) };
  THRESHOLD_COLS.forEach((col, i) => {
    payload[col] = DEFAULT_THRESHOLD[i];
  });
  return payload;
}

async function insertDefaultThreshold(client, screenhouseId, varietasId = null) {
  const varietas = varietasId ? await fetchVarietasById(client, varietasId) : null;
  if (varietas) {
    await upsertThresholdFromVarietas(client, screenhouseId, varietas, { manualOverride: false });
    return;
  }

  await client.query(
    `
    INSERT INTO thresholds (
      screenhouse_id,
      min_nitrogen, max_nitrogen,
      min_phosphorus, max_phosphorus,
      min_potassium, max_potassium,
      min_soil_moisture, max_soil_moisture,
      min_soil_temperature, max_soil_temperature,
      min_soil_ph, max_soil_ph,
      min_conductivity, max_conductivity,
      min_air_temperature, max_air_temperature,
      min_air_humidity, max_air_humidity,
      min_light_intensity, max_light_intensity
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    ON CONFLICT (screenhouse_id) DO NOTHING
    `,
    [screenhouseId, ...DEFAULT_THRESHOLD]
  );
}

async function activateScreenhouseRecord(client, screenhouseId, trayCountOverride = null) {
  if (trayCountOverride != null) {
    await client.query(
      `UPDATE screenhouses SET tray_count = $1 WHERE id = $2`,
      [trayCountOverride, screenhouseId]
    );
  }

  const shRow = await client.query(
    `SELECT varietas_id FROM screenhouses WHERE id = $1`,
    [screenhouseId]
  );

  const result = await client.query(
    `
    UPDATE screenhouses
    SET status = 'active'
    WHERE id = $1 AND status = 'pending'
    RETURNING id, name, owner_user_id, tray_count, varietas_id
    `,
    [screenhouseId]
  );

  if (result.rows[0]) {
    const varietasId = result.rows[0].varietas_id ?? shRow.rows[0]?.varietas_id ?? null;
    await insertDefaultThreshold(client, screenhouseId, varietasId);
  }

  return result.rows[0] ?? null;
}

async function provisionMonitoringInfrastructure(screenhouse) {
  const screenhouseId = Number(screenhouse.id);
  const trayCount = parseTrayCount(screenhouse.tray_count, 1);
  const shCode = formatShCode(screenhouseId);

  let thresholdValues = DEFAULT_THRESHOLD;
  if (screenhouse.varietas_id && monitoringPool) {
    const vRes = await pool.query(`SELECT * FROM varietas_bibit WHERE id = $1`, [
      screenhouse.varietas_id,
    ]);
    if (vRes.rows[0]) {
      thresholdValues = buildThresholdValuesArray(vRes.rows[0]);
    }
  } else if (monitoringPool) {
    const tRes = await pool.query(`SELECT * FROM thresholds WHERE screenhouse_id = $1`, [
      screenhouseId,
    ]);
    if (tRes.rows[0]) {
      thresholdValues = THRESHOLD_COLS.map((col) => tRes.rows[0][col] ?? DEFAULT_THRESHOLD[THRESHOLD_COLS.indexOf(col)]);
    }
  }

  if (monitoringPool) {
    const client = await monitoringPool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `
        INSERT INTO screenhouse_registry (screenhouse_id, owner_user_id, screenhouse_name, status, updated_at)
        VALUES ($1, $2, $3, 'active', NOW())
        ON CONFLICT (screenhouse_id) DO UPDATE SET
          owner_user_id = EXCLUDED.owner_user_id,
          screenhouse_name = EXCLUDED.screenhouse_name,
          status = EXCLUDED.status,
          updated_at = NOW()
        `,
        [screenhouseId, screenhouse.owner_user_id ?? null, screenhouse.name ?? `Screenhouse ${screenhouseId}`]
      );

      const thresholdPlaceholders = THRESHOLD_COLS.map((_, i) => `$${i + 2}`).join(", ");
      const thresholdSetClause = THRESHOLD_COLS.map((c) => `${c} = EXCLUDED.${c}`).join(", ");
      await client.query(
        `
        INSERT INTO threshold_snapshots (screenhouse_id, ${THRESHOLD_COLS.join(", ")}, updated_at)
        VALUES ($1, ${thresholdPlaceholders}, NOW())
        ON CONFLICT (screenhouse_id) DO UPDATE SET
          ${thresholdSetClause},
          updated_at = NOW()
        `,
        [screenhouseId, ...thresholdValues]
      );

      await client.query(
        `
        INSERT INTO sink_nodes (screenhouse_id, node_code, node_name, relay_channels, is_active)
        VALUES ($1, $2, $3, 3, true)
        ON CONFLICT (screenhouse_id) DO NOTHING
        `,
        [screenhouseId, formatSinkCode(screenhouseId), `Sink Node ${shCode}`]
      );

      for (let i = 1; i <= trayCount; i++) {
        await client.query(
          `
          INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, send_interval_seconds, is_active)
          VALUES ($1, $2, $3, 60, true)
          ON CONFLICT (node_code) DO NOTHING
          `,
          [screenhouseId, formatTrayCode(screenhouseId, i), `Rak bibit ${i}`]
        );
      }

      await client.query("COMMIT");
      console.log(
        `[provision] SH${screenhouseId}: sink + ${trayCount} tray (${formatSinkCode(screenhouseId)})`
      );
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } else {
    console.warn("[provision] monitoringPool unavailable — hanya publish event Redis");
  }

  await publishEvent("screenhouse.registry", {
    screenhouse_id: screenhouseId,
    owner_user_id: screenhouse.owner_user_id ?? null,
    screenhouse_name: screenhouse.name ?? `Screenhouse ${screenhouseId}`,
    status: "active",
  });

  const thresholdPayload = { screenhouse_id: screenhouseId };
  THRESHOLD_COLS.forEach((col, i) => {
    thresholdPayload[col] = thresholdValues[i];
  });
  await publishEvent("threshold.updated", thresholdPayload);
}

async function postActivationProvisioning(screenhouses) {
  const list = Array.isArray(screenhouses) ? screenhouses : [screenhouses];
  for (const sh of list) {
    if (!sh?.id) continue;
    try {
      await provisionMonitoringInfrastructure(sh);
    } catch (err) {
      console.error(`[provision] gagal SH${sh.id}:`, err.message);
    }
  }
}

/** Sinkronkan nama screenhouse ke monitoring DB + Redis setelah rename. */
async function syncScreenhouseRegistryName(screenhouse) {
  const screenhouseId = Number(screenhouse.id);
  if (!screenhouseId) return;

  const name = String(screenhouse.name ?? "").trim() || `Screenhouse ${screenhouseId}`;
  const ownerUserId = screenhouse.owner_user_id ?? null;
  const status = screenhouse.status ?? "active";

  if (monitoringPool) {
    await monitoringPool.query(
      `
      UPDATE screenhouse_registry
      SET screenhouse_name = $1, updated_at = NOW()
      WHERE screenhouse_id = $2
      `,
      [name, screenhouseId]
    );
  }

  await publishEvent("screenhouse.registry", {
    screenhouse_id: screenhouseId,
    owner_user_id: ownerUserId,
    screenhouse_name: name,
    status,
  });
}

module.exports = {
  MAX_TRAY_COUNT,
  DEFAULT_THRESHOLD,
  THRESHOLD_COLS,
  parseTrayCount,
  insertDefaultThreshold,
  activateScreenhouseRecord,
  postActivationProvisioning,
  syncScreenhouseRegistryName,
};
