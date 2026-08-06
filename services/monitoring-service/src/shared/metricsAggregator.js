const { consume, publishEvent } = require("./events/eventBus");
const { RK } = require("./events/routingKeys");

const MAX_LATENCY_SAMPLES = 200_000;
// Proses yang tidak melapor selama ini dianggap sudah mati; kontribusinya
// dibekukan pada nilai terakhir, bukan dihapus, supaya total tidak menyusut
// mendadak di tengah run (mis. saat satu replica di-restart).
const STALE_AFTER_MS = Number(process.env.METRICS_STALE_MS || 60_000);

/** instance → laporan terakhir */
const instances = new Map();
let latencyMs = [];
let timeSeries = [];
let runId = null;
let startedAt = Date.now();

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function latencyStats() {
  const sorted = [...latencyMs].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    count: sorted.length,
    avgMs: sorted.length ? sum / sorted.length : null,
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    minMs: sorted.length ? sorted[0] : null,
    maxMs: sorted.length ? sorted[sorted.length - 1] : null,
  };
}

function startMetricsAggregator() {
  consume({
    queue: process.env.QUEUE_METRICS || "q.metrics",
    bindings: [RK.METRICS_REPORT],
    durable: false,
    autoDelete: true,
    messageTtl: 60_000,
    prefetch: 50,
    handler: async (report) => {
      instances.set(report.instance, { ...report, receivedAt: Date.now() });

      // Sampel latency sudah dikuras di sisi pengirim, jadi menggabungkannya
      // di sini tidak menghitung ganda.
      if (Array.isArray(report.latencySamples) && report.latencySamples.length) {
        latencyMs.push(...report.latencySamples);
        if (latencyMs.length > MAX_LATENCY_SAMPLES) {
          latencyMs = latencyMs.slice(-MAX_LATENCY_SAMPLES);
        }
      }
    },
  });

  console.log("[metrics] agregator aktif — menunggu laporan dari role lain");
}

/**
 * Jumlahkan kontribusi seluruh proses jadi satu snapshot.
 *
 * @param {number|null} queueDepth kedalaman q.ingest saat ini, untuk deret waktu
 */
function aggregateSnapshot(queueDepth = null) {
  const now = Date.now();
  const totals = {
    mqttReceived: 0,
    mqttProcessed: 0,
    mqttEnqueued: 0,
    mqttFailed: 0,
    mqttDeadLettered: 0,
    mqttRequeued: 0,
  };
  let rssMb = 0;
  let heapUsedMb = 0;
  const roles = {};

  for (const [instance, report] of instances) {
    for (const key of Object.keys(totals)) {
      totals[key] += Number(report.counters?.[key] ?? 0);
    }
    // RSS dijumlahkan, bukan dirata-rata: yang dibandingkan dengan arsitektur
    // lama adalah TOTAL memori yang dipakai pipeline, dan di arsitektur lama
    // itu satu proses.
    rssMb += Number(report.rssMb ?? 0);
    heapUsedMb += Number(report.heapUsedMb ?? 0);

    roles[report.role] ??= { instances: 0, rssMb: 0, processed: 0, stale: 0 };
    roles[report.role].instances += 1;
    roles[report.role].rssMb += Number(report.rssMb ?? 0);
    roles[report.role].processed += Number(report.counters?.mqttProcessed ?? 0);
    if (now - report.receivedAt > STALE_AFTER_MS) {
      roles[report.role].stale += 1;
    }
    void instance;
  }

  const snapshot = {
    totals,
    rssMb: Math.round(rssMb * 10) / 10,
    heapUsedMb: Math.round(heapUsedMb * 10) / 10,
    roles,
    instanceCount: instances.size,
    latency: latencyStats(),
    runId,
    startedAt,
  };

  timeSeries.push({
    t: now,
    elapsedSec: (now - startedAt) / 1000,
    mqttReceived: totals.mqttReceived,
    mqttProcessed: totals.mqttProcessed,
    mqttEnqueued: totals.mqttEnqueued,
    mqttFailed: totals.mqttFailed,
    mqttNacked: totals.mqttDeadLettered,
    mqttDeadLettered: totals.mqttDeadLettered,
    mqttRequeued: totals.mqttRequeued,
    queueDepth,
    rssMb: snapshot.rssMb,
    heapUsedMb: snapshot.heapUsedMb,
  });
  if (timeSeries.length > 7200) timeSeries.shift();

  snapshot.timeSeries = timeSeries;
  return snapshot;
}

/** Siarkan reset ke semua proses, lalu bersihkan agregat lokal. */
async function broadcastReset(nextRunId) {
  runId = nextRunId ?? null;
  startedAt = Date.now();
  latencyMs = [];
  timeSeries = [];
  instances.clear();
  await publishEvent(RK.METRICS_RESET, { runId: runId });
}

module.exports = { startMetricsAggregator, aggregateSnapshot, broadcastReset };
