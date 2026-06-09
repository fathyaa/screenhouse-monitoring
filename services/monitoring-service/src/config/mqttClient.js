const mqtt = require("mqtt");

let client = null;

function getMqttClient() {
  if (!process.env.MQTT_BROKER_URL) return null;

  if (!client) {
    client = mqtt.connect(process.env.MQTT_BROKER_URL);
    client.on("connect", () => console.log("[mqtt] connected"));
    client.on("error", (err) => console.error("[mqtt]", err.message));
  }

  return client;
}

function publishTopic(topic, payload) {
  const c = getMqttClient();
  if (!c?.connected) {
    console.warn("[mqtt] not connected — skip publish:", topic);
    return false;
  }
  c.publish(topic, JSON.stringify(payload), { qos: 1 });
  return true;
}

module.exports = { getMqttClient, publishTopic };
