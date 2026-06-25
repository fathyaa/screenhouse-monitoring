const monitoringPool = require("../config/monitoringDb");
const { publishEvent } = require("./events/publisher");

const MAX_TRAY_COUNT = 20;

const DEFAULT_THRESHOLD = [
  20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000,
];

const THRESHOLD_COLS = [
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

async function insertDefaultThreshold(client, screenhouseId) {
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

  const result = await client.query(
    `
    UPDATE screenhouses
    SET status = 'active'
    WHERE id = $1 AND status = 'pending'
    RETURNING id, name, owner_user_id, tray_count
    `,
    [screenhouseId]
  );

  if (result.rows[0]) {
    await insertDefaultThreshold(client, screenhouseId);
  }

  return result.rows[0] ?? null;
}

async function provisionMonitoringInfrastructure(screenhouse) {
  const screenhouseId = Number(screenhouse.id);
  const trayCount = parseTrayCount(screenhouse.tray_count, 1);
  const shCode = formatShCode(screenhouseId);

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
        [screenhouseId, ...DEFAULT_THRESHOLD]
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
          [screenhouseId, formatTrayCode(screenhouseId, i), `Tray T${String(i).padStart(2, "0")}`]
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

  await publishEvent("threshold.updated", buildThresholdPayload(screenhouseId));
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

module.exports = {
  MAX_TRAY_COUNT,
  DEFAULT_THRESHOLD,
  THRESHOLD_COLS,
  parseTrayCount,
  insertDefaultThreshold,
  activateScreenhouseRecord,
  postActivationProvisioning,
};
