const pool = require("../../config/db");
const { publishTopic } = require("../../config/mqttClient");
const { publisher } = require("../../config/redis");

const INSERT_SENSOR_DATA = `
  INSERT INTO sensor_data (
    sensor_node_id,
    nitrogen, phosphorus, potassium,
    soil_temperature, soil_moisture, soil_ph, conductivity,
    air_temperature, air_humidity, light_intensity,
    fan_status, irrigation_status, lamp_status
  )
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
  RETURNING id, fan_status, irrigation_status, lamp_status, created_at
`;

async function getSensorNode(screenhouseId, sensorNodeId) {
  const result = await pool.query(
    `
    SELECT id, screenhouse_id, node_code, node_name
    FROM sensor_nodes
    WHERE screenhouse_id = $1 AND is_active = true
      AND ($2::int IS NULL OR id = $2)
    ORDER BY CASE WHEN id = $2 THEN 0 ELSE 1 END, id ASC
    LIMIT 1
    `,
    [screenhouseId, sensorNodeId ?? null]
  );
  return result.rows[0] ?? null;
}

async function getLatestReading(sensorNodeId) {
  const result = await pool.query(
    `
    SELECT *
    FROM sensor_data
    WHERE sensor_node_id = $1
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [sensorNodeId]
  );
  return result.rows[0] ?? null;
}

async function getOwnerUserId(screenhouseId) {
  const result = await pool.query(
    `SELECT owner_user_id FROM screenhouse_registry WHERE screenhouse_id = $1`,
    [screenhouseId]
  );
  return result.rows[0]?.owner_user_id ?? null;
}

/**
 * Set actuator state for a screenhouse node.
 * Partial updates merge with latest reading. Publishes MQTT command + inserts
 * a sensor_data row so UI reflects change immediately.
 */
async function setActuators({
  screenhouseId,
  sensorNodeId = null,
  fan,
  irrigation,
  lamp,
  source = "manual",
  reason = null,
  userId = null,
}) {
  const shId = Number(screenhouseId);
  if (!Number.isInteger(shId)) {
    throw Object.assign(new Error("screenhouseId tidak valid"), { status: 400 });
  }

  const node = await getSensorNode(shId, sensorNodeId ? Number(sensorNodeId) : null);
  if (!node) {
    throw Object.assign(new Error("Sensor node tidak ditemukan"), { status: 404 });
  }

  const latest = await getLatestReading(node.id);
  const nextFan = fan ?? latest?.fan_status ?? false;
  const nextIrrigation = irrigation ?? latest?.irrigation_status ?? false;
  const nextLamp = lamp ?? latest?.lamp_status ?? false;

  const unchanged =
    latest &&
    Boolean(latest.fan_status) === Boolean(nextFan) &&
    Boolean(latest.irrigation_status) === Boolean(nextIrrigation) &&
    Boolean(latest.lamp_status) === Boolean(nextLamp);

  if (unchanged) {
    return {
      screenhouse_id: shId,
      sensor_node_id: node.id,
      node_code: node.node_code,
      fan_status: nextFan,
      irrigation_status: nextIrrigation,
      lamp_status: nextLamp,
      source,
      reason,
      unchanged: true,
    };
  }

  publishTopic(`screenhouse/${shId}/node/${node.node_code}/command`, {
    fan_status: nextFan,
    irrigation_status: nextIrrigation,
    lamp_status: nextLamp,
    source,
    reason,
  });

  publishTopic(`screenhouse/${shId}/actuator`, {
    node_code: node.node_code,
    fan_status: nextFan,
    irrigation_status: nextIrrigation,
    lamp_status: nextLamp,
    source,
    reason,
  });

  const saved = await pool.query(INSERT_SENSOR_DATA, [
    node.id,
    latest?.nitrogen ?? null,
    latest?.phosphorus ?? null,
    latest?.potassium ?? null,
    latest?.soil_temperature ?? null,
    latest?.soil_moisture ?? null,
    latest?.soil_ph ?? null,
    latest?.conductivity ?? null,
    latest?.air_temperature ?? null,
    latest?.air_humidity ?? null,
    latest?.light_intensity ?? null,
    nextFan,
    nextIrrigation,
    nextLamp,
  ]);

  const ownerUserId = (await getOwnerUserId(shId)) ?? userId;
  const payload = {
    screenhouse_id: shId,
    sensor_node_id: node.id,
    node_code: node.node_code,
    fan_status: saved.rows[0].fan_status,
    irrigation_status: saved.rows[0].irrigation_status,
    lamp_status: saved.rows[0].lamp_status,
    source,
    reason,
    user_id: ownerUserId,
    created_at: saved.rows[0].created_at,
  };

  await publisher.publish("actuator-updated", JSON.stringify(payload));

  return { ...payload, unchanged: false };
}

module.exports = { setActuators };
