const { connectRabbitMq, INGEST_QUEUE } = require("../config/rabbitmq");
const { consume } = require("../shared/events/eventBus");
const { processIngestJob } = require("../modules/ingest/ingestPipeline");
const { recordMqttFailed } = require("../modules/ingest/ingestMetrics");
const { startHealthServer } = require("../shared/healthServer");

/**
 * PROCESSING LAYER — mengubah frame mentah jadi peristiwa yang bermakna.
 *
 * Membaca q.ingest, menyelesaikan node & screenhouse-nya, memvalidasi, lalu
 * menerbitkan `sensor.raw`. Ia TIDAK menulis sensor_data — itu tugas listener
 * persistence. Pemisahan ini yang membuat penulisan database bisa ditambah
 * replica tanpa menyentuh jalur MQTT.
 *
 * Aman dijalankan banyak replica: q.ingest adalah antrean kerja, jadi tiap
 * tugas hanya sampai ke satu consumer.
 */
async function start() {
  await connectRabbitMq();

  consume({
    queue: INGEST_QUEUE,
    handler: async (job) => {
      const ok = await processIngestJob(job);
      // `false` berarti payload tidak bisa dipetakan ke node mana pun — bukan
      // kegagalan infrastruktur, jadi pesannya tidak diulang. Sudah dilog di
      // dalam processIngestJob.
      if (ok === false) recordMqttFailed();
    },
  });

  startHealthServer("processing", process.env.HEALTH_PORT || 3011);
  console.log("[processing] siap — q.ingest → sensor.raw");
}

module.exports = { start };
