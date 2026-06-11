#!/usr/bin/env node
/**
 * Simulasi WSN berkelanjutan — publish telemetry MQTT ke semua tray sensor.
 * Pipeline penuh: MQTT → monitoring-service → DB → alert → Socket.IO → dashboard.
 *
 * Prasyarat:
 *   - docker compose up (Mosquitto, Redis, PostgreSQL)
 *   - monitoring-service jalan (MQTT_BROKER_URL=mqtt://localhost:1883)
 *   - database/monitoring/seed.sql sudah di-import
 *
 * Usage:
 *   cd docs/evaluasi-kualitas && npm install
 *   npm run sim              # interval default 20 menit
 *   npm run sim:demo         # interval 2 menit (coba cepat)
 *   npm run sim:once         # satu siklus lalu exit
 *   SIM_INTERVAL_SEC=600 npm run sim
 */

import mqtt from "mqtt";

const BROKER = process.env.MQTT_BROKER_URL || process.env.MQTT_BROKER || "mqtt://localhost:1883";
const INTERVAL_SEC = Number(process.env.SIM_INTERVAL_SEC || 20 * 60);
const ONCE = process.argv.includes("--once");

/** Tray sensor + sink gateway (sesuai database/monitoring/seed.sql) */
const NODES = [
  { screenhouseId: 1, nodeId: "SH01-T01", sinkId: "SH01-SINK", label: "SH01 Tray A1" },
  { screenhouseId: 1, nodeId: "SH01-T02", sinkId: "SH01-SINK", label: "SH01 Tray B1" },
  { screenhouseId: 2, nodeId: "SH02-T01", sinkId: "SH02-SINK", label: "SH02 Tray A1" },
  { screenhouseId: 3, nodeId: "SH03-T01", sinkId: "SH03-SINK", label: "SH03 Tray A1" },
];

const THRESHOLD = {
  min_nitrogen: 20,
  max_nitrogen: 45,
  min_phosphorus: 10,
  max_phosphorus: 30,
  min_potassium: 15,
  max_potassium: 50,
  min_soil_moisture: 50,
  max_soil_moisture: 80,
  min_soil_temperature: 20,
  max_soil_temperature: 35,
  min_soil_ph: 5.5,
  max_soil_ph: 7.0,
  min_conductivity: 200,
  max_conductivity: 800,
  min_air_temperature: 22,
  max_air_temperature: 35,
  min_air_humidity: 40,
  max_air_humidity: 85,
  min_light_intensity: 5000,
  max_light_intensity: 50000,
};

function rand(min, max, decimals = 0) {
  const v = min + Math.random() * (max - min);
  if (decimals === 0) return Math.round(v);
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

function inRange(value, min, max) {
  return value >= min && value <= max;
}

/** Skenario bacaan — sebagian sengaja di luar threshold untuk trigger alert */
function pickScenario() {
  const r = Math.random();
  if (r < 0.62) return "normal";
  if (r < 0.72) return "kering";
  if (r < 0.82) return "panas";
  if (r < 0.9) return "npk_tinggi";
  if (r < 0.95) return "lembab_tinggi";
  return "offline";
}

function buildReading(scenario) {
  const base = {
    nitrogen: rand(24, 36),
    phosphorus: rand(14, 24),
    potassium: rand(20, 38),
    soil_temperature: rand(24, 31, 1),
    soil_moisture: rand(55, 72, 1),
    soil_ph: rand(5.9, 6.7, 2),
    conductivity: rand(380, 620),
    air_temperature: rand(25, 31),
    air_humidity: rand(55, 72),
    light_intensity: rand(12000, 28000),
  };

  switch (scenario) {
    case "kering":
      return {
        ...base,
        soil_moisture: rand(32, 46, 1),
        air_humidity: rand(45, 58),
      };
    case "panas":
      return {
        ...base,
        air_temperature: rand(36, 41),
        soil_temperature: rand(33, 36, 1),
      };
    case "npk_tinggi":
      return {
        ...base,
        nitrogen: rand(48, 58),
        phosphorus: rand(32, 38),
      };
    case "lembab_tinggi":
      return {
        ...base,
        soil_moisture: rand(82, 92, 1),
        air_humidity: rand(88, 94),
      };
    default:
      return base;
  }
}

function topicFor(node) {
  return `screenhouse/${node.screenhouseId}/sink/${node.sinkId}/sensor`;
}

function formatDuration(sec) {
  if (sec >= 3600) return `${(sec / 3600).toFixed(1)} jam`;
  if (sec >= 60) return `${Math.round(sec / 60)} menit`;
  return `${sec} detik`;
}

function describeReading(reading) {
  const flags = [];
  if (!inRange(reading.soil_moisture, THRESHOLD.min_soil_moisture, THRESHOLD.max_soil_moisture)) {
    flags.push(`kelembapan ${reading.soil_moisture}%`);
  }
  if (!inRange(reading.air_temperature, THRESHOLD.min_air_temperature, THRESHOLD.max_air_temperature)) {
    flags.push(`suhu udara ${reading.air_temperature}°C`);
  }
  if (!inRange(reading.nitrogen, THRESHOLD.min_nitrogen, THRESHOLD.max_nitrogen)) {
    flags.push(`N ${reading.nitrogen}`);
  }
  return flags.length ? flags.join(", ") : "normal";
}

function publish(client, node, scenario) {
  if (scenario === "offline") {
    console.log(`  ⊘ ${node.label} — skip (simulasi offline)`);
    return Promise.resolve();
  }

  const reading = buildReading(scenario);
  const payload = {
    node_id: node.nodeId,
    destination_id: node.sinkId,
    ...reading,
  };

  return new Promise((resolve, reject) => {
    client.publish(topicFor(node), JSON.stringify(payload), { qos: 0 }, (err) => {
      if (err) return reject(err);
      console.log(`  ✓ ${node.label} [${scenario}] → ${describeReading(reading)}`);
      resolve();
    });
  });
}

async function runCycle(client, cycleNum) {
  const ts = new Date().toLocaleString("id-ID");
  console.log(`\n── Siklus #${cycleNum} · ${ts} ──`);

  /** Rotasi: screenhouse 3 kadang full offline agar peta punya marker abu-abu */
  const sh3Offline = Math.random() < 0.12;

  for (const node of NODES) {
    let scenario = pickScenario();
    if (node.screenhouseId === 3 && sh3Offline) {
      scenario = "offline";
    }
    await publish(client, node, scenario);
    await new Promise((r) => setTimeout(r, 400));
  }

  if (sh3Offline) {
    console.log("  ℹ Screenhouse 3 sengaja tidak kirim — marker offline di peta operator");
  }
}

function connectBroker() {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(BROKER, {
      reconnectPeriod: 5000,
      connectTimeout: 10000,
    });
    client.on("connect", () => {
      console.log(`Terhubung ke MQTT: ${BROKER}`);
      resolve(client);
    });
    client.on("error", reject);
    setTimeout(() => reject(new Error("Timeout koneksi MQTT")), 15000);
  });
}

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  Live simulasi WSN — Screenhouse Monitoring      ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`Interval: ${formatDuration(INTERVAL_SEC)}`);
  console.log("Node:", NODES.map((n) => n.nodeId).join(", "));
  console.log("");
  console.log("Pastikan monitoring-service aktif. Dashboard operator refresh peta ~30 detik.");
  console.log("Alert masuk realtime ke petani (Socket.IO) bila melebihi threshold.");
  if (INTERVAL_SEC > 900) {
    console.log("");
    console.log(
      "Catatan: interval > 15 menit → marker bisa sempat 'offline' antar siklus",
      "(sesuai aturan stale di map-summary). Pakai npm run sim:demo untuk uji cepat."
    );
  }

  const client = await connectBroker();
  let cycle = 0;

  const tick = async () => {
    cycle += 1;
    try {
      await runCycle(client, cycle);
    } catch (err) {
      console.error("Gagal publish siklus:", err.message);
    }
  };

  await tick();

  if (ONCE) {
    console.log("\nSelesai (--once).");
    client.end();
    process.exit(0);
  }

  console.log(`\nSiklus berikutnya dalam ${formatDuration(INTERVAL_SEC)}… (Ctrl+C stop)`);
  setInterval(tick, INTERVAL_SEC * 1000);
}

main().catch((err) => {
  console.error("Simulasi gagal:", err.message);
  console.error("Cek Mosquitto (docker compose) dan MQTT_BROKER_URL.");
  process.exit(1);
});
