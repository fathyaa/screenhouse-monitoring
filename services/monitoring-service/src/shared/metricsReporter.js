const os = require("os");
const { publishEvent, consume } = require("./events/eventBus");
const { RK } = require("./events/routingKeys");
const { drainMetricsReport, resetIngestMetrics } = require("../modules/ingest/ingestMetrics");

const REPORT_INTERVAL_MS = Number(process.env.METRICS_REPORT_INTERVAL_MS || 5000);

/**
 * Pelapor metrik per proses.
 *
 * Setelah arsitektur dipecah, counter ingest hidup di proses yang mengerjakan
 * pesannya — `persistence` untuk baris tersimpan & latency, `collector` untuk
 * pesan diterima. Role `api` yang melayani /stats/ingest tidak menyentuh satu
 * pun pesan sensor, jadi ia harus dikirimi angka itu.
 *
 * Dipilih lewat RabbitMQ, bukan HTTP antar container, karena jumlah replica
 * berubah-ubah saat pengujian (`--scale persistence=4`) dan tidak ada cara
 * andal menemukan alamat tiap replica dari luar. Broker sudah tahu semuanya.
 *
 * Biayanya kecil: satu pesan tiap 5 detik per proses. Sampel latency dikuras
 * tiap laporan, jadi ukurannya sebanding dengan throughput, bukan durasi run.
 */
function startMetricsReporter(role) {
  const instance = `${role}:${os.hostname()}:${process.pid}`;

  const send = async () => {
    try {
      const report = drainMetricsReport();
      // Proses yang tidak mengerjakan apa pun (mis. scheduler) tidak perlu
      // membanjiri antrean — tapi tetap lapor sesekali supaya RSS-nya terhitung.
      await publishEvent(RK.METRICS_REPORT, { instance, role, ...report });
    } catch (err) {
      // Metrik tidak boleh menjatuhkan pipeline yang sedang diukur.
      if (process.env.METRICS_DEBUG === "true") {
        console.warn("[metrics] gagal lapor:", err.message);
      }
    }
  };

  const timer = setInterval(send, REPORT_INTERVAL_MS);
  timer.unref?.();

  // Reset disiarkan supaya seluruh proses punya titik nol yang sama. Queue-nya
  // privat per proses dan auto-delete: perintah reset yang tidak ada
  // penerimanya memang tidak berguna disimpan.
  consume({
    queue: `q.metrics.reset.{instance}`,
    bindings: [RK.METRICS_RESET],
    durable: false,
    autoDelete: true,
    exclusive: true,
    messageTtl: 30000,
    prefetch: 1,
    handler: async ({ runId }) => {
      resetIngestMetrics(runId ?? null);
      console.log(`[metrics] counter di-reset (runId=${runId ?? "-"})`);
    },
  });

  console.log(`[metrics] pelapor aktif — ${instance}, tiap ${REPORT_INTERVAL_MS}ms`);
}

module.exports = { startMetricsReporter };
