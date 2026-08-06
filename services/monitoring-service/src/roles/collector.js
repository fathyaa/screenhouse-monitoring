const { connectRabbitMq, INGEST_QUEUE, COMMAND_QUEUE } = require("../config/rabbitmq");
const { sendToQueue, consume } = require("../shared/events/eventBus");
const { publishTopic } = require("../config/mqttClient");
const connectMQTT = require("../modules/ingest/mqttService");
const { connectDeviceBridge, publishValveControl } = require("../modules/ingest/deviceBridge");
const { recordMqttEnqueued, recordMqttFailed } = require("../modules/ingest/ingestMetrics");
const { startHealthServer } = require("../shared/healthServer");
const { startMetricsReporter } = require("../shared/metricsReporter");

/**
 * COLLECTOR — satu-satunya pemegang koneksi MQTT.
 *
 * Sengaja tidak punya koneksi database: tugasnya cuma memindahkan frame dari
 * broker ke q.ingest secepat mungkin, dan meneruskan perintah aktuator ke arah
 * sebaliknya. Semua kerja mahal (resolusi node, INSERT) terjadi di hilir, di
 * consumer yang boleh ditambah replica-nya.
 *
 * JANGAN dijalankan lebih dari satu instance untuk broker yang sama. Subscriber
 * MQTT biasa menerima setiap pesan yang cocok, jadi replica kedua menggandakan
 * seluruh data sensor. Untuk lebih dari satu, pakai shared subscription MQTT v5
 * (`$share/grup/topik`) — bukan load balancer.
 */
async function start() {
  await connectRabbitMq();

  const enqueue = async (job) => {
    try {
      await sendToQueue(INGEST_QUEUE, job);
      recordMqttEnqueued();
    } catch (err) {
      recordMqttFailed();
      console.error("[collector] gagal menaruh ke antrean:", err.message);
      throw err;
    }
  };

  connectMQTT(enqueue);
  connectDeviceBridge(enqueue);

  // Perintah aktuator datang dari role lain (api untuk kendali manual, alert
  // untuk kendali otomatis) yang tidak punya koneksi MQTT. Perintah menunggu di
  // antrean kalau collector sedang restart, jadi tidak ada yang hilang.
  consume({
    queue: COMMAND_QUEUE,
    prefetch: 1,
    handler: async ({ screenhouseId, sinkCode, topics = [], payload, valve = {} }) => {
      for (const topic of topics) {
        publishTopic(topic, payload);
      }

      // Perangkat ber-bridge memakai format plain "0"/"1" per kanal katup.
      // No-op untuk screenhouse non-bridge (mis. simulator).
      publishValveControl({
        screenhouseId,
        sinkCode,
        irrigation: valve.irrigation,
        fan: valve.fan,
      });

      console.log(`[collector] perintah aktuator diteruskan → sh ${screenhouseId}`);
    },
  });

  startMetricsReporter("collector");
  startHealthServer("collector", process.env.HEALTH_PORT || 3010);
  console.log("[collector] siap — MQTT → q.ingest, q.device.command → MQTT");
}

module.exports = { start };
