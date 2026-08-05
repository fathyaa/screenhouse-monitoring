const { getMqttClient } = require("../../config/mqttClient");
const { recordMqttReceived, recordMqttFailed } = require("./ingestMetrics");
const { adaptMqttMessage, getInfraSubscribeTopics } = require("./infraMqttAdapter");

/**
 * Berlangganan topik sensor dan menyerahkan tiap frame ke `onJob`.
 *
 * Modul ini sengaja tidak tahu apa-apa soal database: ia hidup di role
 * `collector`, yang tugasnya cuma memindahkan pesan dari MQTT ke antrean.
 * Parsing topik tetap di sini karena bentuk topik adalah urusan protokol, bukan
 * urusan domain.
 *
 * CATATAN SKALA: jangan menjalankan lebih dari satu collector untuk broker yang
 * sama. Subscriber MQTT biasa menerima SETIAP pesan pada topik yang cocok, jadi
 * replica kedua menggandakan seluruh data. Kalau butuh lebih dari satu, pakai
 * shared subscription MQTT v5 (`$share/grup/topik`) — bukan load balancer.
 */
function connectMQTT(onJob) {
  const client = getMqttClient();
  if (!client) {
    console.warn("[mqtt] MQTT_BROKER_URL not set — ingest disabled");
    return null;
  }

  const topics = [
    "screenhouse/+/sensor",
    "screenhouse/+/node/+/sensor",
    "screenhouse/+/sink/+/sensor",
    "node/+/telemetry",
    ...getInfraSubscribeTopics(),
  ];

  client.on("connect", () => {
    console.log("[mqtt] tersambung ke broker — meneruskan ke q.ingest");
    topics.forEach((topic) => {
      client.subscribe(topic, (err) => {
        if (!err) console.log("[mqtt] subscribed:", topic);
      });
    });
  });

  client.on("message", async (topic, message) => {
    recordMqttReceived();
    try {
      const rawData = JSON.parse(message.toString());
      const { data, parts, screenhouseIdFromTopic } = adaptMqttMessage(topic, rawData);
      await onJob({
        source: "mqtt",
        data,
        topicParts: parts,
        screenhouseIdFromTopic,
        receivedAt: new Date().toISOString(),
      });
    } catch (err) {
      recordMqttFailed();
      console.log("[mqtt] gagal memproses pesan:", err.message);
    }
  });

  return client;
}

module.exports = connectMQTT;
