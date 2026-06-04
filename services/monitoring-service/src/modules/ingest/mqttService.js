const mqtt = require("mqtt");
const pool = require("../../config/db");
const { redisClient } = require("../../config/redis");

const INSERT_SENSOR_DATA = `
  INSERT INTO sensor_data (
    sensor_node_id,
    nitrogen, phosphorus, potassium,
    soil_temperature, soil_moisture, soil_ph, conductivity,
    air_temperature, air_humidity, light_intensity,
    fan_status, irrigation_status, lamp_status
  )
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
  RETURNING id
`;

function pick(data, key, fallback = null) {
  const v = data[key];
  return v === undefined || v === null ? fallback : v;
}

async function resolveSensorNode(screenhouseIdFromTopic, data, topicParts) {
  const nodeCodeFromTopic =
    topicParts[2] === "node" ? topicParts[3] : null;

  const nodeId =
    pick(data, "sensor_node_id") ??
    pick(data, "sensorNodeId") ??
    pick(data, "node_sensor_id") ??
    null;

  const nodeCode =
    pick(data, "node_code") ?? pick(data, "nodeCode") ?? nodeCodeFromTopic;

  if (nodeId) {
    const byId = await pool.query(
      `SELECT id, screenhouse_id, node_code FROM sensor_nodes WHERE id = $1`,
      [nodeId]
    );
    if (byId.rows[0]) return byId.rows[0];
  }

  if (nodeCode) {
    const byCode = await pool.query(
      `SELECT id, screenhouse_id, node_code FROM sensor_nodes WHERE node_code = $1`,
      [nodeCode]
    );
    if (byCode.rows[0]) return byCode.rows[0];
  }

  if (screenhouseIdFromTopic) {
    const fallback = await pool.query(
      `
      SELECT id, screenhouse_id, node_code FROM sensor_nodes
      WHERE screenhouse_id = $1 AND is_active = true
      ORDER BY id ASC
      LIMIT 1
      `,
      [screenhouseIdFromTopic]
    );
    return fallback.rows[0] ?? null;
  }

  return null;
}

function connectMQTT() {
  const client = mqtt.connect(process.env.MQTT_BROKER_URL);

  client.on("connect", () => {
    console.log("Connected to MQTT Broker");

    ["screenhouse/+/sensor", "screenhouse/+/node/+/sensor", "node/+/telemetry"].forEach(
      (topic) => {
        client.subscribe(topic, (err) => {
          if (!err) console.log("Subscribed:", topic);
        });
      }
    );
  });

  client.on("message", async (topic, message) => {
    console.log("TOPIC:", topic);

    try {
      const data = JSON.parse(message.toString());
      const parts = topic.split("/");
      const screenhouseIdFromTopic =
        parts[0] === "screenhouse" ? parts[1] : null;

      const node = await resolveSensorNode(screenhouseIdFromTopic, data, parts);

      if (!node) {
        console.log("Sensor node tidak ditemukan untuk topic:", topic);
        return;
      }

      if (
        screenhouseIdFromTopic &&
        String(node.screenhouse_id) !== String(screenhouseIdFromTopic)
      ) {
        console.log("Screenhouse topic tidak cocok dengan sensor node");
        return;
      }

      const saved = await pool.query(INSERT_SENSOR_DATA, [
        node.id,
        pick(data, "nitrogen"),
        pick(data, "phosphorus"),
        pick(data, "potassium"),
        pick(data, "soil_temperature"),
        pick(data, "soil_moisture"),
        pick(data, "soil_ph"),
        pick(data, "conductivity"),
        pick(data, "air_temperature"),
        pick(data, "air_humidity"),
        pick(data, "light_intensity"),
        pick(data, "fan_status", false),
        pick(data, "irrigation_status", false),
        pick(data, "lamp_status", false),
      ]);

      const sensorDataId = saved.rows[0].id;
      const screenhouseId = String(node.screenhouse_id);

      const payload = {
        nitrogen: pick(data, "nitrogen"),
        phosphorus: pick(data, "phosphorus"),
        potassium: pick(data, "potassium"),
        soil_temperature: pick(data, "soil_temperature"),
        soil_moisture: pick(data, "soil_moisture"),
        soil_ph: pick(data, "soil_ph"),
        conductivity: pick(data, "conductivity"),
        air_temperature: pick(data, "air_temperature"),
        air_humidity: pick(data, "air_humidity"),
        light_intensity: pick(data, "light_intensity"),
        fan_status: pick(data, "fan_status", false),
        irrigation_status: pick(data, "irrigation_status", false),
        lamp_status: pick(data, "lamp_status", false),
      };

      await redisClient.publish(
        "sensor-data-created",
        JSON.stringify({
          sensorDataId,
          screenhouseId,
          sensorNodeId: node.id,
          nodeCode: node.node_code,
          data: payload,
        })
      );

      console.log("Sensor data saved & event published");
    } catch (err) {
      console.log("Error processing MQTT message:", err);
    }
  });
}

module.exports = connectMQTT;
