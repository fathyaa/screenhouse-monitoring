const mqtt = require("mqtt");
const { TOPICS, ENABLED, adaptTelemetry, kindOf } = require("./collabTopics");
const { recordMqttReceived, recordMqttFailed } = require("../ingest/ingestMetrics");

/**
 * Langganan MQTT kontrak kolaborasi robot — hidup di role `collector`.
 *
 * Sengaja memakai koneksi MQTT SENDIRI (bukan klien sensor milik mqttService):
 * handler pesan klien itu memproses semua topik yang diterimanya sebagai frame
 * sensor, sehingga menumpang langganan di sana akan menyeret pesan misi ke
 * q.ingest. Seperti collector, JANGAN dijalankan lebih dari satu instance per
 * broker (atau pakai shared subscription MQTT v5).
 *
 * @param {(job:object)=>Promise} enqueueIngest  telemetri → q.ingest (jalur sensor yang ada)
 * @param {(job:object)=>Promise} enqueueCollab  misi & aktuasi → q.collab
 */
function connectCollabMqtt(enqueueIngest, enqueueCollab) {
  if (!ENABLED || !process.env.MQTT_BROKER_URL) {
    console.warn("[collab-mqtt] nonaktif (COLLAB_ENABLED=false atau MQTT_BROKER_URL kosong)");
    return null;
  }
  const client = mqtt.connect(process.env.MQTT_BROKER_URL, {
    clientId: `shms-collab-${process.pid}-${Math.random().toString(16).slice(2, 8)}`,
  });
  const topics = Object.values(TOPICS);

  client.on("connect", () => {
    client.subscribe(topics, { qos: 1 }, (err) => {
      if (err) console.error("[collab-mqtt] gagal subscribe:", err.message);
      else console.log("[collab-mqtt] subscribed:", topics.join(", "));
    });
  });
  client.on("error", (err) => console.error("[collab-mqtt]", err.message));

  client.on("message", async (topic, message) => {
    const kind = kindOf(topic);
    if (!kind) return;
    recordMqttReceived();
    try {
      const payload = JSON.parse(message.toString());
      const receivedAt = new Date().toISOString();
      if (kind === "telemetry") {
        const data = adaptTelemetry(payload);
        if (!data) throw new Error("telemetry tanpa h_id/n_id");
        await enqueueIngest({ source: "mqtt-collab", data, topicParts: topic.split("/"),
          screenhouseIdFromTopic: null, receivedAt });
      } else {
        await enqueueCollab({ kind, topic, payload, receivedAt });
      }
    } catch (err) {
      recordMqttFailed();
      console.log(`[collab-mqtt] gagal memproses ${topic}:`, err.message);
    }
  });
  return client;
}

module.exports = { connectCollabMqtt };
