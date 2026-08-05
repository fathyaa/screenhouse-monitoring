const { connectRabbitMq } = require("../config/rabbitmq");
const { consume } = require("../shared/events/eventBus");
const { BINDINGS } = require("../shared/events/routingKeys");
const { saveSensorReading } = require("../modules/ingest/ingestPipeline");
const { startHealthServer } = require("../shared/healthServer");

/**
 * LISTENER PERSISTENCE — satu-satunya penulis tabel sensor_data.
 *
 * Konsumen `sensor.raw`, lalu menerbitkan `sensor.persisted` yang membawa id
 * baris hasil INSERT. Listener alert menunggu peristiwa kedua itu, bukan yang
 * pertama, karena alerts.sensor_data_id adalah foreign key sungguhan.
 *
 * Aman dijalankan banyak replica — inilah sumbu skala utama untuk kapasitas
 * ingest. Urutan antar-pesan tidak dijamin saat replica > 1, dan itu tidak
 * masalah: tiap pembacaan berdiri sendiri, waktunya sudah ada di created_at.
 */
async function start() {
  await connectRabbitMq();

  consume({
    queue: process.env.QUEUE_PERSIST || "q.persist",
    bindings: BINDINGS.PERSIST,
    handler: async ({ sensorNode, sinkNode, data }) => {
      await saveSensorReading({ sensorNode, sinkNode, data });
    },
  });

  startHealthServer("persistence", process.env.HEALTH_PORT || 3012);
  console.log("[persistence] siap — sensor.raw → sensor_data → sensor.persisted");
}

module.exports = { start };
