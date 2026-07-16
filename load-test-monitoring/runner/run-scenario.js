/**
 * Run one standard backend ingest load-test scenario.
 *
 *   node runner/run-scenario.js S1
 *   node runner/run-scenario.js --id=S3 --output=results/S3.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { MqttSimulator } from "../simulator/mqtt-simulator.js";
import { MetricsCollector } from "../collectors/metrics-collector.js";
import { ensureCleanQueue } from "../collectors/rabbitmq-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RESULTS_DIR = path.join(ROOT, "results");

dotenv.config({ path: path.join(ROOT, ".env") });

function loadScenarioConfig() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "config/scenarios.json"), "utf8"));
}

function parseArgs() {
  const args = {};
  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith("--")) {
      const [key, value] = raw.slice(2).split("=");
      args[key] = value ?? true;
    } else {
      args.id = raw;
    }
  }
  return args;
}

function buildRunId(scenarioId) {
  return `${scenarioId}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

async function fetchIngestMode(env) {
  const base = env.MONITORING_URL || "http://localhost:3001";
  const res = await fetch(`${base}/`);
  if (!res.ok) throw new Error(`Monitoring service HTTP ${res.status}`);
  const data = await res.json();
  return data.ingestMode || "direct";
}

function resolveCooldownSec(scenario, defaults) {
  return Number(scenario.cooldownSec ?? defaults.cooldownSec ?? 60);
}

function createSimulator({ env, defaults, runId }) {
  return new MqttSimulator({
    brokerUrl: env.MQTT_BROKER_URL || "mqtt://localhost:1883",
    topicPattern: defaults.topicPattern || "screenhouse/{screenhouseId}/sink/{sinkCode}/sensor",
    runId,
    poolSize: Number(env.LOADTEST_MQTT_POOL_SIZE || defaults.mqttPoolSize || 32),
    env,
  });
}

async function waitForBackendCatchUp({ metrics, maxSec, pollSec, published, direct }) {
  if (maxSec <= 0) return { elapsedSec: 0, drained: false };

  console.log(
    direct
      ? `Cooldown ${maxSec}s — waiting for direct inserts to settle...`
      : `Cooldown ${maxSec}s — waiting for RabbitMQ queue and DB inserts...`
  );

  const start = Date.now();
  let lastLogSec = -30;

  while ((Date.now() - start) / 1000 < maxSec) {
    const elapsedSec = Math.floor((Date.now() - start) / 1000);
    const snapshot = await readCooldownSnapshot(metrics);
    const queueOk = direct || snapshot.queueDepth == null || snapshot.queueDepth === 0;
    const dbOk = published > 0 && snapshot.dbRows != null && snapshot.dbRows >= published * 0.99;

    if (queueOk && dbOk) {
      console.log(
        `  ok after ${elapsedSec}s (processed=${snapshot.processed ?? "?"}, db=${snapshot.dbRows}/${published})`
      );
      return { elapsedSec, drained: true, ...snapshot };
    }

    if (elapsedSec - lastLogSec >= 30) {
      lastLogSec = elapsedSec;
      console.log(
        `  [cooldown ${elapsedSec}s/${maxSec}s] queue=${snapshot.queueDepth ?? "?"} ` +
          `processed=${snapshot.processed ?? "?"} db=${snapshot.dbRows ?? "?"}/${published}`
      );
    }

    await sleep(pollSec * 1000);
  }

  const elapsedSec = Math.floor((Date.now() - start) / 1000);
  console.log(`  cooldown finished after ${elapsedSec}s; backend may still be catching up`);
  return { elapsedSec, drained: false };
}

async function readCooldownSnapshot(metrics) {
  const snapshot = {
    queueDepth: null,
    processed: null,
    dbRows: null,
  };

  try {
    const backend = await metrics.backend.fetchOnce();
    snapshot.processed = backend.mqttProcessed;
    snapshot.queueDepth = backend.queueDepth;
  } catch {
    // Keep cooldown resilient so the final report can still show DB metrics.
  }

  try {
    snapshot.dbRows = await metrics.database.countDelta();
  } catch {
    // Same reason as above: do not abort just because one polling pass failed.
  }

  return snapshot;
}

async function prepareInfrastructure({ env, defaults, direct }) {
  if (direct) {
    console.log("  Direct ingest mode: RabbitMQ queue checks skipped");
    return;
  }

  const queuePrep = await ensureCleanQueue(env, defaults);
  if (queuePrep.backlogAtStart > 0 && !queuePrep.drained) {
    console.warn("  Warning: queue still had backlog; this run may include previous data.");
  }
}

async function waitForDirectBackendIdle({ backend, runId, defaults }) {
  const maxSec = Number(defaults.directPreflightMaxSec ?? 180);
  const idleSec = Number(defaults.directPreflightIdleSec ?? 15);
  const pollSec = Number(defaults.directPreflightPollSec ?? 5);

  console.log(`  Direct preflight: checking backend idle state (max ${maxSec}s)...`);
  await backend.reset(`${runId}-preflight`);

  const start = Date.now();
  let stableStartedAt = null;
  let previousTotal = null;

  while ((Date.now() - start) / 1000 < maxSec) {
    await sleep(pollSec * 1000);

    let snapshot;
    try {
      snapshot = await backend.fetchOnce();
    } catch (err) {
      console.warn(`  Direct preflight warning: backend stats unavailable (${err.message})`);
      continue;
    }

    const total =
      Number(snapshot.mqttReceived || 0) +
      Number(snapshot.mqttProcessed || 0) +
      Number(snapshot.mqttFailed || 0) +
      Number(snapshot.mqttNacked || 0);

    if (previousTotal != null && total === previousTotal) {
      stableStartedAt ??= Date.now();
      const stableForSec = (Date.now() - stableStartedAt) / 1000;
      if (stableForSec >= idleSec) {
        await backend.reset(runId);
        console.log("  Direct preflight: backend idle, starting clean run");
        return { idle: true };
      }
    } else {
      stableStartedAt = null;
      if (total > 0) {
        console.log(
          `  Direct preflight: backend still moving ` +
            `(received=${snapshot.mqttReceived}, processed=${snapshot.mqttProcessed})`
        );
      }
    }

    previousTotal = total;
  }

  console.warn(
    "  Direct preflight timeout: backend may still be processing a previous run. " +
      "Restart monitoring-service before thesis data collection if this repeats."
  );
  await backend.reset(runId);
  return { idle: false };
}

function summarizeResult({ scenario, runId, selectedSensors, simulatorStats, metrics, startedAt, finishedAt }) {
  const sent = simulatorStats.published;
  const processed = metrics.backend.mqttProcessed;
  const dbRows = metrics.database.dbRowsFinal;
  const failed = metrics.backend.mqttFailed + metrics.backend.mqttNacked + simulatorStats.publishErrors;
  const missing = Math.max(sent - dbRows, 0);

  return {
    runId,
    scenario: {
      id: scenario.id,
      name: scenario.name,
      activeSensors: scenario.sensors,
      sensors: scenario.sensors,
      intervalSec: scenario.intervalSec,
      durationSec: scenario.durationSec,
      description: scenario.description,
    },
    timing: {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationSec: (finishedAt - startedAt) / 1000,
    },
    mqtt: {
      messagesSent: sent,
      publishErrors: simulatorStats.publishErrors,
      publishRatePerSec: simulatorStats.publishRatePerSec,
    },
    backend: {
      ingestMode: metrics.backend.ingestMode,
      messagesReceived: metrics.backend.mqttReceived,
      messagesProcessed: processed,
      messagesEnqueued: metrics.backend.mqttEnqueued,
      messagesFailed: metrics.backend.mqttFailed,
      messagesNacked: metrics.backend.mqttNacked,
      receiveRatePerSec: metrics.backend.receiveRatePerSec,
      processRatePerSec: metrics.backend.processRatePerSec,
      successRatePct: metrics.backend.successRatePct,
      errorRatePct: sent > 0 ? (failed / sent) * 100 : null,
      latencyAvgMs: metrics.backend.latency?.avgMs,
      latencyP95Ms: metrics.backend.latency?.p95Ms,
      latencyP99Ms: metrics.backend.latency?.p99Ms,
      rssMbMax: metrics.backend.rssMbMax,
      rssMbAvg: metrics.backend.rssMbAvg,
    },
    rabbitmq: {
      queueDepthMax: metrics.rabbitmq.queueDepthMax,
      queueDepthAvg: metrics.rabbitmq.queueDepthAvg,
      publishRateAvg: metrics.rabbitmq.publishRateAvg,
      consumeRateAvg: metrics.rabbitmq.consumeRateAvg,
    },
    database: {
      rowsInserted: dbRows,
      insertRateAvg: metrics.database.insertRateAvg,
      insertRateMax: metrics.database.insertRateMax,
    },
    validation: {
      publishVsReceived: sent - metrics.backend.mqttReceived,
      publishVsProcessed: sent - processed,
      publishVsDb: sent - dbRows,
      deliveryRatePct: sent > 0 ? (processed / sent) * 100 : null,
      databaseDeliveryRatePct: sent > 0 ? (dbRows / sent) * 100 : null,
      errorRatePct: sent > 0 ? (failed / sent) * 100 : null,
      missingMessages: missing,
      missingPct: sent > 0 ? (missing / sent) * 100 : 0,
      allProcessed: missing === 0 && processed >= sent * 0.99,
    },
    selectedSensors: selectedSensors.map((sensor) => ({
      sensorNodeId: sensor.sensorNodeId,
      screenhouseId: sensor.screenhouseId,
      nodeCode: sensor.nodeCode,
      sinkCode: sensor.sinkCode,
    })),
    timeSeries: {
      backend: metrics.backend.samples,
      rabbitmq: metrics.rabbitmq.samples,
      database: metrics.database.samples,
    },
  };
}

async function runScenario({ scenario, defaults, env, runId }) {
  const ingestMode = await fetchIngestMode(env);
  const direct = ingestMode === "direct";
  const metrics = new MetricsCollector(env);
  const simulator = createSimulator({ env, defaults, runId });

  console.log(`\n=== ${scenario.id}: ${scenario.sensors} active sensors ===`);
  console.log(`Interval: ${scenario.intervalSec}s, duration: ${scenario.durationSec}s`);
  console.log(`Ingest mode: ${ingestMode}`);

  const selectedSensors = await simulator.prepareSensors(scenario.sensors, scenario.intervalSec);
  metrics.database.setSensorNodeIds(simulator.getSensorNodeIds());
  console.log(`Selected ${selectedSensors.length} real active sensor_nodes from PostgreSQL`);

  try {
    await prepareInfrastructure({ env, defaults, direct });
    if (direct) {
      await waitForDirectBackendIdle({ backend: metrics.backend, runId, defaults });
    }
    await metrics.prepareRun(runId);
    await simulator.connect();

    const startedAt = new Date();
    metrics.database.setRunStart(startedAt);
    await metrics.database.captureBaseline();
    metrics.start(startedAt);

    const simulatorStats = await simulator.start({
      sensors: scenario.sensors,
      intervalSec: scenario.intervalSec,
      durationSec: scenario.durationSec,
      onTick: createProgressLogger(scenario.id),
    });

    await waitForBackendCatchUp({
      metrics,
      maxSec: resolveCooldownSec(scenario, defaults),
      pollSec: Number(defaults.cooldownPollSec || 5),
      published: simulatorStats.published,
      direct,
    });

    metrics.stop();
    const metricsResult = await metrics.finalize();
    const finishedAt = new Date();

    return summarizeResult({
      scenario,
      runId,
      selectedSensors,
      simulatorStats,
      metrics: metricsResult,
      startedAt,
      finishedAt,
    });
  } finally {
    metrics.stop();
    await Promise.allSettled([simulator.disconnect(), metrics.close()]);
  }
}

function createProgressLogger(scenarioId) {
  let lastLoggedSec = -30;
  return (stats) => {
    const elapsedSec = Math.floor(stats.elapsedSec);
    if (elapsedSec - lastLoggedSec >= 30) {
      lastLoggedSec = elapsedSec;
      console.log(
        `  [${scenarioId} ${elapsedSec}s] published=${stats.published} ` +
          `rate=${stats.publishRatePerSec.toFixed(1)}/s`
      );
    }
  };
}

function writeResult(result, outputPath) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const outFile = outputPath || path.join(RESULTS_DIR, `${result.runId}.json`);
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  return outFile;
}

function printSummaryTable(result) {
  const delivery = result.validation.deliveryRatePct;
  const avgLatency = result.backend.latencyAvgMs;
  const p95 = result.backend.latencyP95Ms;
  const throughput = result.backend.processRatePerSec;
  const rssMax = result.backend.rssMbMax;

  console.log("\n| Scenario | Active Sensors | Messages Sent | Messages Processed | Delivery Rate | Avg Latency | P95 | Throughput | RSS Max | Missing |");
  console.log("| -------- | -------------- | ------------- | ------------------ | ------------- | ----------- | --- | ---------- | ------- | ------- |");
  console.log(
    `| ${result.scenario.id} | ${result.scenario.activeSensors} | ${result.mqtt.messagesSent} | ` +
      `${result.backend.messagesProcessed} | ${formatPct(delivery)} | ${formatMs(avgLatency)} | ` +
      `${formatMs(p95)} | ${formatRate(throughput)} | ${formatMb(rssMax)} | ` +
      `${result.validation.missingMessages} |`
  );
}

function formatPct(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}%` : "-";
}

function formatMs(value) {
  return Number.isFinite(value) ? `${value.toFixed(0)} ms` : "-";
}

function formatRate(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}/s` : "-";
}

function formatMb(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} MB` : "-";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs();
  const config = loadScenarioConfig();
  const scenarioId = args.id || args.scenario || "S1";
  const scenario = config.scenarios.find((item) => item.id === scenarioId);

  if (!scenario) {
    console.error(`Scenario "${scenarioId}" not found. Available: ${config.scenarios.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }

  const result = await runScenario({
    scenario,
    defaults: config.defaults || {},
    env: process.env,
    runId: buildRunId(scenario.id),
  });
  const outFile = writeResult(result, args.output);

  printSummaryTable(result);
  console.log(`\nResult saved: ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
