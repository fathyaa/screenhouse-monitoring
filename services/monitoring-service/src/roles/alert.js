const { connectRabbitMq } = require("../config/rabbitmq");
const { consume } = require("../shared/events/eventBus");
const { RK, BINDINGS } = require("../shared/events/routingKeys");
const {
  handleSensorPersisted,
  upsertThresholdSnapshot,
  upsertScreenhouseRegistry,
} = require("../modules/alerting/alertEngine");
const { startHealthServer } = require("../shared/healthServer");

/**
 * LISTENER ALERT — evaluasi ambang, histeresis, dan aktuator otomatis.
 *
 * Dua sumber masuk:
 *   q.alert  ← sensor.persisted  (pembacaan yang sudah punya id baris)
 *   q.config ← config.*          (perubahan ambang & registry dari app-service)
 *
 * JALANKAN SATU INSTANCE. Alasannya bukan cuma cache ambang yang lokal:
 * histeresis membaca status alert lalu menulisnya, dan dua consumer yang
 * memproses dua pembacaan dari node yang sama secara bersamaan bisa saling
 * mendahului. Unique constraint di tabel alerts menahan duplikat yang paling
 * kasar (ditangani sebagai 23505), tapi urutan create-vs-resolve belum diuji
 * untuk jalan paralel.
 */
async function start() {
  await connectRabbitMq();

  consume({
    queue: process.env.QUEUE_ALERT || "q.alert",
    bindings: BINDINGS.ALERT,
    handler: handleSensorPersisted,
  });

  consume({
    queue: process.env.QUEUE_CONFIG || "q.config",
    bindings: BINDINGS.CONFIG,
    prefetch: 1,
    handler: async (payload, msg) => {
      const key = msg.fields.routingKey;
      if (key === RK.CONFIG_THRESHOLD) await upsertThresholdSnapshot(payload);
      else if (key === RK.CONFIG_REGISTRY) await upsertScreenhouseRegistry(payload);
    },
  });

  startHealthServer("alert", process.env.HEALTH_PORT || 3013);
  console.log("[alert] siap — sensor.persisted → alerts → alert.created");
}

module.exports = { start };
