const pool = require("../../config/db");
const { publishTopic } = require("../../config/mqttClient");
const { publisher } = require("../../config/redis");

const INSERT_ACTUATOR_LOG = `
  INSERT INTO actuator_logs (
    sink_node_id, screenhouse_id,
    fan_status, irrigation_status, lamp_status,
    source, reason
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  RETURNING id, fan_status, irrigation_status, lamp_status, created_at
`;

async function getSinkNode(screenhouseId) {
  const result = await pool.query(
    `
    SELECT id, screenhouse_id, node_code, node_name, relay_channels,
           fan_status, irrigation_status, lamp_status
    FROM sink_nodes
    WHERE screenhouse_id = $1 AND is_active = true
    LIMIT 1
    `,
    [screenhouseId]
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
 * Set actuator state for a screenhouse via its sink node.
 * Publishes MQTT command + logs to actuator_logs + updates sink_nodes.
 */
async function setActuators({
  screenhouseId,
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

  const sink = await getSinkNode(shId);
  if (!sink) {
    throw Object.assign(new Error("Sink node tidak ditemukan"), { status: 404 });
  }

  const nextFan = fan ?? sink.fan_status ?? false;
  const nextIrrigation = irrigation ?? sink.irrigation_status ?? false;
  const nextLamp = lamp ?? sink.lamp_status ?? false;

  const unchanged =
    Boolean(sink.fan_status) === Boolean(nextFan) &&
    Boolean(sink.irrigation_status) === Boolean(nextIrrigation) &&
    Boolean(sink.lamp_status) === Boolean(nextLamp);

  if (unchanged) {
    return {
      screenhouse_id: shId,
      sink_node_id: sink.id,
      node_code: sink.node_code,
      fan_status: nextFan,
      irrigation_status: nextIrrigation,
      lamp_status: nextLamp,
      source,
      reason,
      unchanged: true,
    };
  }

  const commandPayload = {
    node_id: sink.node_code,
    destination_id: sink.node_code,
    fan_status: nextFan,
    irrigation_status: nextIrrigation,
    lamp_status: nextLamp,
    source,
    reason,
  };

  publishTopic(`screenhouse/${shId}/sink/${sink.node_code}/command`, commandPayload);
  publishTopic(`screenhouse/${shId}/actuator`, commandPayload);

  await pool.query(
    `
    UPDATE sink_nodes
    SET fan_status = $2, irrigation_status = $3, lamp_status = $4, updated_at = NOW()
    WHERE id = $1
    `,
    [sink.id, nextFan, nextIrrigation, nextLamp]
  );

  const saved = await pool.query(INSERT_ACTUATOR_LOG, [
    sink.id,
    shId,
    nextFan,
    nextIrrigation,
    nextLamp,
    source,
    reason,
  ]);

  const ownerUserId = (await getOwnerUserId(shId)) ?? userId;
  const payload = {
    screenhouse_id: shId,
    sink_node_id: sink.id,
    node_code: sink.node_code,
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

module.exports = { setActuators, getSinkNode };
