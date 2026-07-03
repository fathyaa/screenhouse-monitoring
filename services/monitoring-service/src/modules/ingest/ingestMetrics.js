const MAX_LATENCY_SAMPLES = 50000;

const state = {
  runId: null,
  startedAt: Date.now(),
  mqttReceived: 0,
  mqttProcessed: 0,
  mqttEnqueued: 0,
  mqttFailed: 0,
  mqttNacked: 0,
  latencyMs: [],
  timeSeries: [],
};

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function latencyStats() {
  const sorted = [...state.latencyMs].sort((a, b) => a - b);
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

function recordMqttReceived() {
  state.mqttReceived += 1;
}

function recordMqttProcessed(data) {
  state.mqttProcessed += 1;
  const publishedAt = data?._loadtest?.publishedAt;
  if (publishedAt) {
    const ms = Date.now() - Number(publishedAt);
    if (Number.isFinite(ms) && ms >= 0 && ms < 600_000) {
      if (state.latencyMs.length >= MAX_LATENCY_SAMPLES) {
        state.latencyMs.shift();
      }
      state.latencyMs.push(ms);
    }
  }
}

function recordMqttEnqueued() {
  state.mqttEnqueued += 1;
}

function recordMqttFailed() {
  state.mqttFailed += 1;
}

function recordMqttNacked() {
  state.mqttNacked += 1;
}

function appendTimeSeriesSample({ queueDepth }) {
  const mem = process.memoryUsage();
  const elapsedSec = (Date.now() - state.startedAt) / 1000;
  state.timeSeries.push({
    t: Date.now(),
    elapsedSec,
    mqttReceived: state.mqttReceived,
    mqttProcessed: state.mqttProcessed,
    mqttEnqueued: state.mqttEnqueued,
    mqttFailed: state.mqttFailed,
    mqttNacked: state.mqttNacked,
    queueDepth: queueDepth ?? null,
    rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
    heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
  });
  if (state.timeSeries.length > 7200) {
    state.timeSeries.shift();
  }
}

function getIngestMetricsSnapshot() {
  const lat = latencyStats();
  const elapsedSec = Math.max((Date.now() - state.startedAt) / 1000, 0.001);
  const successCount = state.mqttProcessed;
  const errorCount = state.mqttFailed + state.mqttNacked;
  const totalHandled = successCount + errorCount;

  return {
    runId: state.runId,
    uptimeSec: elapsedSec,
    mqttReceived: state.mqttReceived,
    mqttProcessed: successCount,
    mqttEnqueued: state.mqttEnqueued,
    mqttFailed: state.mqttFailed,
    mqttNacked: state.mqttNacked,
    successRatePct: totalHandled ? (successCount / totalHandled) * 100 : null,
    errorRatePct: totalHandled ? (errorCount / totalHandled) * 100 : null,
    receiveRatePerSec: state.mqttReceived / elapsedSec,
    processRatePerSec: successCount / elapsedSec,
    latency: lat,
    timeSeries: state.timeSeries,
    memory: {
      rssMb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10,
      heapUsedMb: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 10) / 10,
    },
  };
}

function resetIngestMetrics(runId = null) {
  state.runId = runId;
  state.startedAt = Date.now();
  state.mqttReceived = 0;
  state.mqttProcessed = 0;
  state.mqttEnqueued = 0;
  state.mqttFailed = 0;
  state.mqttNacked = 0;
  state.latencyMs = [];
  state.timeSeries = [];
}

module.exports = {
  recordMqttReceived,
  recordMqttProcessed,
  recordMqttEnqueued,
  recordMqttFailed,
  recordMqttNacked,
  appendTimeSeriesSample,
  getIngestMetricsSnapshot,
  resetIngestMetrics,
};
