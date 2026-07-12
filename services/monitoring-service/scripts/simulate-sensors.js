#!/usr/bin/env node
/**
 * Simulator sensor live untuk semua petani approved (~29 user).
 * Menyisipkan pembacaan ke DB monitoring + publish Redis (alert worker, socket, dll.)
 *
 *   cd services/monitoring-service
 *   npm run simulate              # loop setiap 20 menit
 *   npm run simulate -- --once    # satu tick saja (uji cepat)
 *
 * Env:
 *   SIM_INTERVAL_MS=1200000       default 20 menit antar tick
 *   SIM_STAGGER_MS=4000           jeda antar node dalam satu tick (4 detik)
 *   SIM_SEND_INTERVAL_SEC=1200    update send_interval_seconds node (20 menit)
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { Pool } = require("pg");
const monPool = require("../src/config/db");
const { connectRedis } = require("../src/config/redis");
const { saveSensorReading } = require("../src/modules/ingest/ingestPipeline");

const INTERVAL_MS = Number(process.env.SIM_INTERVAL_MS || 20 * 60 * 1000);
const STAGGER_MS = Number(process.env.SIM_STAGGER_MS || 4000);
const SEND_INTERVAL_SEC = Number(process.env.SIM_SEND_INTERVAL_SEC || 1200);
const ONCE = process.argv.includes("--once");

const appPool = new Pool({
  host: process.env.APP_DB_HOST || process.env.DB_HOST || "localhost",
  port: Number(process.env.APP_DB_PORT || 5434),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.APP_DB_NAME || "screenhouse_app",
});

/** @type {Map<number, object>} */
const nodeState = new Map();

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function rnd(min, max) {
  return min + Math.random() * (max - min);
}

function initState(screenhouseId, nodeIndex) {
  const h = (screenhouseId + nodeIndex) % 12;
  return {
    nitrogen: 28 + (h % 6),
    phosphorus: 18 + (h % 5),
    potassium: 22 + (h % 6),
    soil_temperature: 26 + (h % 4) * 0.5,
    soil_moisture: 62 + (h % 8),
    soil_ph: 6.2 + (h % 2) * 0.15,
    conductivity: 420 + h * 10,
    air_temperature: 27 + (h % 3),
    air_humidity: 65 + (h % 12),
    light_intensity: 12000 + h * 400,
    stressTicks: 0,
  };
}

function nextReading(state, { forceHot = false, forceDry = false } = {}) {
  const walk = (key, delta, lo, hi) => {
    state[key] = clamp(state[key] + rnd(-delta, delta), lo, hi);
  };

  walk("nitrogen", 1.2, 15, 50);
  walk("phosphorus", 0.8, 8, 35);
  walk("potassium", 1, 12, 55);
  walk("soil_temperature", 0.4, 20, 36);
  walk("soil_moisture", 2, 35, 90);
  walk("soil_ph", 0.05, 5.2, 7.5);
  walk("conductivity", 25, 150, 950);
  walk("air_temperature", 0.6, 20, 40);
  walk("air_humidity", 2, 30, 95);
  walk("light_intensity", 800, 3000, 55000);

  if (forceHot || state.stressTicks > 0) {
    state.air_temperature = clamp(state.air_temperature + rnd(2, 5), 33, 42);
    state.stressTicks = Math.max(0, state.stressTicks - 1);
  } else if (Math.random() < 0.04) {
    state.air_temperature = rnd(36, 39);
    state.stressTicks = 2;
  }

  if (forceDry) {
    state.soil_moisture = rnd(28, 38);
  } else if (Math.random() < 0.03) {
    state.soil_moisture = rnd(30, 42);
  }

  return {
    nitrogen: Math.round(state.nitrogen),
    phosphorus: Math.round(state.phosphorus),
    potassium: Math.round(state.potassium),
    soil_temperature: Math.round(state.soil_temperature * 10) / 10,
    soil_moisture: Math.round(state.soil_moisture * 10) / 10,
    soil_ph: Math.round(state.soil_ph * 100) / 100,
    conductivity: Math.round(state.conductivity * 10) / 10,
    air_temperature: Math.round(state.air_temperature * 10) / 10,
    air_humidity: Math.round(state.air_humidity * 10) / 10,
    light_intensity: Math.round(state.light_intensity),
  };
}

async function loadTargets() {
  const farmers = await appPool.query(
    `SELECT id, name FROM users WHERE role = 'petani' AND status = 'approved' ORDER BY id`
  );
  const ownerIds = farmers.rows.map((r) => r.id);
  if (!ownerIds.length) {
    throw new Error("Tidak ada petani approved di app DB");
  }

  const shRes = await appPool.query(
    `
    SELECT id, name, owner_user_id
    FROM screenhouses
    WHERE status = 'active' AND owner_user_id = ANY($1::int[])
    ORDER BY id
    `,
    [ownerIds]
  );
  const shIds = shRes.rows.map((r) => r.id);
  if (!shIds.length) {
    throw new Error("Tidak ada screenhouse aktif untuk petani approved");
  }

  await monPool.query(
    `
    UPDATE sensor_nodes
    SET send_interval_seconds = $1
    WHERE screenhouse_id = ANY($2::int[]) AND is_active = true
    `,
    [SEND_INTERVAL_SEC, shIds]
  );

  const nodeRes = await monPool.query(
    `
    SELECT
      sn.id,
      sn.screenhouse_id,
      sn.node_code,
      sn.node_name,
      sn.send_interval_seconds,
      sk.id AS sink_id,
      sk.node_code AS sink_node_code,
      sk.fan_status,
      sk.irrigation_status,
      sk.lamp_status,
      sr.screenhouse_name,
      sr.owner_user_id
    FROM sensor_nodes sn
    INNER JOIN screenhouse_registry sr ON sr.screenhouse_id = sn.screenhouse_id
    LEFT JOIN sink_nodes sk ON sk.screenhouse_id = sn.screenhouse_id AND sk.is_active = true
    WHERE sn.is_active = true AND sn.screenhouse_id = ANY($1::int[])
    ORDER BY sn.screenhouse_id, sn.id
    `,
    [shIds]
  );

  return {
    farmers: farmers.rows,
    screenhouses: shRes.rows,
    nodes: nodeRes.rows,
  };
}

async function injectReading(node, data) {
  const sensorNode = {
    id: node.id,
    screenhouse_id: node.screenhouse_id,
    node_code: node.node_code,
  };
  const sinkNode = node.sink_id
    ? {
        id: node.sink_id,
        screenhouse_id: node.screenhouse_id,
        node_code: node.sink_node_code,
        fan_status: node.fan_status,
        irrigation_status: node.irrigation_status,
        lamp_status: node.lamp_status,
      }
    : null;

  await saveSensorReading({ sensorNode, sinkNode, data });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTick(nodes, tickIndex) {
  const ts = new Date().toISOString();
  console.log(`\n[simulate] tick #${tickIndex + 1} @ ${ts} — ${nodes.length} node`);

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (!nodeState.has(node.id)) {
      nodeState.set(node.id, initState(node.screenhouse_id, i));
    }
    const state = nodeState.get(node.id);

    const forceHot = tickIndex > 0 && i === tickIndex % nodes.length;
    const forceDry = tickIndex > 1 && i === (tickIndex + 3) % nodes.length;
    const reading = nextReading(state, { forceHot, forceDry });

    try {
      await injectReading(node, reading);
      console.log(
        `[simulate] ✓ ${node.screenhouse_name} / ${node.node_code} ` +
          `(su:${reading.air_temperature.toFixed(1)}°C km:${reading.soil_moisture.toFixed(0)}%)`
      );
    } catch (err) {
      console.error(`[simulate] ✗ ${node.node_code}:`, err.message);
    }

    if (i < nodes.length - 1 && STAGGER_MS > 0) {
      await sleep(STAGGER_MS);
    }
  }
}

async function main() {
  await connectRedis();

  const { farmers, screenhouses, nodes } = await loadTargets();

  console.log("[simulate] BibitLive sensor simulator");
  console.log(`  Petani approved : ${farmers.length}`);
  console.log(`  Screenhouse     : ${screenhouses.length}`);
  console.log(`  Sensor node     : ${nodes.length}`);
  console.log(`  Interval tick   : ${Math.round(INTERVAL_MS / 60000)} menit`);
  console.log(`  Stagger/node    : ${STAGGER_MS / 1000}s`);
  console.log(`  send_interval   : ${SEND_INTERVAL_SEC}s (${SEND_INTERVAL_SEC / 60} menit)`);
  console.log("  Pastikan monitoring-service (npm run dev) + Redis aktif.\n");

  let tick = 0;
  await runTick(nodes, tick);
  tick += 1;

  if (ONCE) {
    console.log("\n[simulate] --once selesai.");
    await shutdown();
    return;
  }

  console.log(`\n[simulate] Menunggu ${Math.round(INTERVAL_MS / 60000)} menit untuk tick berikutnya…`);

  setInterval(async () => {
    try {
      await runTick(nodes, tick);
      tick += 1;
      console.log(`\n[simulate] Tick berikutnya dalam ${Math.round(INTERVAL_MS / 60000)} menit…`);
    } catch (err) {
      console.error("[simulate] tick error:", err.message);
    }
  }, INTERVAL_MS);
}

async function shutdown() {
  await appPool.end().catch(() => {});
  process.exit(0);
}

process.on("SIGINT", () => {
  console.log("\n[simulate] dihentikan.");
  shutdown();
});

main().catch((err) => {
  console.error("[simulate] gagal:", err.message);
  shutdown();
});
