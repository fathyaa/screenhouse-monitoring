const { getMqttClient } = require("../../config/mqttClient");
const { isRabbitMqEnabled } = require("../../config/rabbitmq");
const { handleMqttPayload } = require("./ingestPipeline");
const { recordMqttReceived, recordMqttFailed } = require("./ingestMetrics");

function connectMQTT() {
  const client = getMqttClient();
  if (!client) {
    console.warn("[mqtt] MQTT_BROKER_URL not set — ingest disabled");
    return;
  }

  const topics = [
    "screenhouse/+/sensor",
    "screenhouse/+/node/+/sensor",
    "screenhouse/+/sink/+/sensor",
    "node/+/telemetry",
  ];

  client.on("connect", () => {
    const mode = isRabbitMqEnabled() ? "RabbitMQ queue" : "direct DB";
    console.log(`Connected to MQTT Broker (ingest mode: ${mode})`);
    topics.forEach((topic) => {
      client.subscribe(topic, (err) => {
        if (!err) console.log("Subscribed:", topic);
      });
    });
  });

  client.on("message", async (topic, message) => {
    recordMqttReceived();
    try {
      const data = JSON.parse(message.toString());
      const parts = topic.split("/");
      const screenhouseIdFromTopic = parts[0] === "screenhouse" ? parts[1] : null;
      const ok = await handleMqttPayload(data, parts, screenhouseIdFromTopic);
      if (ok === false) recordMqttFailed();
    } catch (err) {
      recordMqttFailed();
      console.log("Error processing MQTT message:", err);
    }
  });
}

module.exports = connectMQTT;
