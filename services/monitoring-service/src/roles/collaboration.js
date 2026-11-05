const { connectRabbitMq, COLLAB_QUEUE } = require("../config/rabbitmq");
const { consume } = require("../shared/events/eventBus");
const { processCollabJob } = require("../modules/collaboration/collaborationService");
const { startHealthServer } = require("../shared/healthServer");
const { startMetricsReporter } = require("../shared/metricsReporter");

/**
 * LISTENER KOLABORASI ROBOT — satu-satunya penulis tabel robot_missions,
 * robot_mission_events, tray_inspections, dan actuation_events.
 *
 * Konsumen q.collab (diisi collector dari topik mission/* dan actuator/control),
 * lalu menerbitkan mission.updated / inspection.recorded / actuation.recorded
 * untuk gateway realtime.
 *
 * Boleh lebih dari satu replica: setiap tulisan idempoten (idemp_key UNIQUE) dan
 * ringkasan misi hanya maju menurut seq, jadi urutan antar-replica tidak merusak
 * hasil akhir.
 */
async function start() {
  await connectRabbitMq();

  consume({
    queue: COLLAB_QUEUE,
    prefetch: Number(process.env.RABBITMQ_PREFETCH || 20),
    handler: async (job) => {
      await processCollabJob(job);
    },
  });

  startMetricsReporter("collaboration");
  startHealthServer("collaboration", process.env.HEALTH_PORT || 3016);
  console.log("[collaboration] siap — q.collab → misi/inspeksi/aktuasi → mission.updated");
}

module.exports = { start };
