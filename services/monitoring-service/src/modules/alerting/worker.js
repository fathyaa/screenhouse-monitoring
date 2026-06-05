const pool = require("../../config/db");
const { THRESHOLD_METRICS } = require("./thresholdMetrics");
const { subscriber, publisher } = require("../../config/redis");

const SNAPSHOT_FIELDS = [
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

async function upsertThresholdSnapshot(row) {
  const screenhouseId = Number(row.screenhouse_id);
  if (!screenhouseId) return;

  const cols = ["screenhouse_id", ...SNAPSHOT_FIELDS];
  const values = [screenhouseId, ...SNAPSHOT_FIELDS.map((f) => row[f] ?? null)];
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
  const setClause = SNAPSHOT_FIELDS.map((f) => `${f} = EXCLUDED.${f}`).join(", ");

  await pool.query(
    `
    INSERT INTO threshold_snapshots (${cols.join(", ")}, updated_at)
    VALUES (${placeholders}, NOW())
    ON CONFLICT (screenhouse_id) DO UPDATE SET
      ${setClause},
      updated_at = NOW()
    `,
    values
  );
}

async function upsertScreenhouseRegistry(row) {
  const screenhouseId = Number(row.screenhouse_id);
  if (!screenhouseId) return;

  await pool.query(
    `
    INSERT INTO screenhouse_registry (screenhouse_id, owner_user_id, screenhouse_name, status, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (screenhouse_id) DO UPDATE SET
      owner_user_id = EXCLUDED.owner_user_id,
      screenhouse_name = EXCLUDED.screenhouse_name,
      status = EXCLUDED.status,
      updated_at = NOW()
    `,
    [
      screenhouseId,
      row.owner_user_id ?? null,
      row.screenhouse_name ?? `Screenhouse ${screenhouseId}`,
      row.status ?? "active",
    ]
  );
}

async function createAlert({ sensorDataId, screenhouseId, sensorNodeId, message }) {
  const result = await pool.query(
    `INSERT INTO alerts (sensor_data_id, screenhouse_id, sensor_node_id, message, status)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [sensorDataId, screenhouseId, sensorNodeId, message, "active"]
  );
  console.log("ALERT CREATED:", message);

  const enriched = await pool.query(
    `SELECT a.id, a.screenhouse_id, a.sensor_node_id, a.message, a.status, a.created_at, a.sensor_data_id,
            sd.nitrogen AS actual_nitrogen,
            sd.phosphorus AS actual_phosphorus,
            sd.potassium AS actual_potassium,
            sd.soil_moisture AS actual_soil_moisture,
            sd.soil_temperature AS actual_soil_temperature,
            sd.soil_ph AS actual_soil_ph,
            sd.conductivity AS actual_conductivity,
            sd.air_temperature AS actual_air_temperature,
            sd.air_humidity AS actual_air_humidity,
            sd.light_intensity AS actual_light_intensity,
            sn.node_name AS sensor_node_name,
            sn.node_code,
            t.*,
            sr.screenhouse_name,
            sr.owner_user_id AS user_id
     FROM alerts a
     LEFT JOIN sensor_data sd ON sd.id = a.sensor_data_id
     LEFT JOIN sensor_nodes sn ON sn.id = a.sensor_node_id
     LEFT JOIN threshold_snapshots t ON t.screenhouse_id = a.screenhouse_id
     LEFT JOIN screenhouse_registry sr ON sr.screenhouse_id = a.screenhouse_id
     WHERE a.id = $1`,
    [result.rows[0].id]
  );

  await publisher.publish("alert-created", JSON.stringify(enriched.rows[0]));
}

async function handleSensorDataCreated(message) {
  const { sensorDataId, screenhouseId, sensorNodeId, data: sensorData } = JSON.parse(message);
  console.log("Checking threshold...");

  const thresholdResult = await pool.query(
    `SELECT * FROM threshold_snapshots WHERE screenhouse_id = $1`,
    [screenhouseId]
  );
  const threshold = thresholdResult.rows[0];
  if (!threshold) return console.log("Threshold snapshot tidak ditemukan");

  for (const m of THRESHOLD_METRICS) {
    const value = sensorData[m.key];
    if (value == null) continue;

    const min = threshold[m.minCol];
    const max = threshold[m.maxCol];

    if (min != null && Number(value) < Number(min)) {
      await createAlert({
        sensorDataId,
        screenhouseId,
        sensorNodeId,
        message: `${m.label} di bawah batas minimum`,
      });
    }
    if (max != null && Number(value) > Number(max)) {
      await createAlert({
        sensorDataId,
        screenhouseId,
        sensorNodeId,
        message: `${m.label} melebihi batas maksimum`,
      });
    }
  }
}

async function startAlertWorker() {
  await subscriber.subscribe("sensor-data-created", async (message) => {
    try {
      await handleSensorDataCreated(message);
    } catch (err) {
      console.error(err);
    }
  });

  await subscriber.subscribe("threshold.updated", async (message) => {
    try {
      await upsertThresholdSnapshot(JSON.parse(message));
    } catch (err) {
      console.error("[threshold.updated]", err);
    }
  });

  await subscriber.subscribe("screenhouse.registry", async (message) => {
    try {
      await upsertScreenhouseRegistry(JSON.parse(message));
    } catch (err) {
      console.error("[screenhouse.registry]", err);
    }
  });

  console.log("Alert worker listening on Redis channels");
}

module.exports = { startAlertWorker, upsertThresholdSnapshot, upsertScreenhouseRegistry };
