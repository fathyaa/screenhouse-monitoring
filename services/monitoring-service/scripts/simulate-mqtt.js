#!/usr/bin/env node
/**
 * Simulator MQTT infra — pola topic resmi BibitLive.
 *
 * Publish telemetry tray  → screenhouse/{id}/sink/{sink}/sensor
 * Subscribe command       → screenhouse/+/sink/+/command (+ broadcast actuator)
 * Publish feedback relay  → screenhouse/{id}/sink/{sink}/sensor
 *
 *   cd services/monitoring-service
 *   cp scripts/simulate-mqtt.config.example.json scripts/simulate-mqtt.config.json
 *   npm run simulate:mqtt
 *   npm run simulate:mqtt -- --once
 *
 * Env:
 *   MQTT_BROKER_URL=mqtt://168.110.214.70:1883
 *   SIM_MQTT_CONFIG=./scripts/simulate-mqtt.config.json
 *   SIM_MQTT_INTERVAL_MS=60000
 *   SIM_MQTT_STAGGER_MS=2000
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const fs = require("fs");
const path = require("path");
const mqtt = require("mqtt");

const ONCE = process.argv.includes("--once");
const CONFIG_PATH =
  process.env.SIM_MQTT_CONFIG ||
  path.join(__dirname, "simulate-mqtt.config.json");
const BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";

/** @type {Map<string, object>} */
const trayState = new Map();

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function rnd(min, max) {
  return min + Math.random() * (max - min);
}

function initTrayState(screenhouseId, index) {
  const h = (screenhouseId + index) % 12;
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

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      `Config tidak ditemukan: ${CONFIG_PATH}\n` +
        "Salin scripts/simulate-mqtt.config.example.json → simulate-mqtt.config.json"
    );
  }

  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const intervalMs = Number(process.env.SIM_MQTT_INTERVAL_MS || raw.intervalMs || 60_000);
  const staggerMs = Number(process.env.SIM_MQTT_STAGGER_MS || raw.staggerMs || 2000);

  const screenhouses = (raw.screenhouses || []).map((sh) => {
    const screenhouseId = Number(sh.screenhouseId);
    const sinkCode = String(sh.sinkCode || "").trim();
    if (!Number.isInteger(screenhouseId) || !sinkCode) {
      throw new Error("Setiap screenhouse wajib punya screenhouseId (int) dan sinkCode");
    }

    const trays = (sh.trays || []).map((t, i) => {
      const nodeCode = String(t.nodeCode || t.node_code || "").trim();
      if (!nodeCode) throw new Error(`Tray #${i + 1} SH${screenhouseId} tanpa nodeCode`);
      return { nodeCode, nodeName: t.nodeName || t.node_name || nodeCode };
    });

    if (!trays.length) {
      throw new Error(`Screenhouse ${screenhouseId} harus punya minimal 1 tray`);
    }

    const actuators = {
      fan: Boolean(sh.actuators?.fan ?? sh.actuators?.fan_status ?? false),
      irrigation: Boolean(sh.actuators?.irrigation ?? sh.actuators?.irrigation_status ?? false),
      lamp: Boolean(sh.actuators?.lamp ?? sh.actuators?.lamp_status ?? false),
    };

    return { screenhouseId, sinkCode, trays, actuators };
  });

  if (!screenhouses.length) {
    throw new Error("Config screenhouses kosong");
  }

  return { intervalMs, staggerMs, screenhouses };
}

function sensorTopic(screenhouseId, sinkCode) {
  return `screenhouse/${screenhouseId}/sink/${sinkCode}/sensor`;
}

function commandTopic(screenhouseId, sinkCode) {
  return `screenhouse/${screenhouseId}/sink/${sinkCode}/command`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function publishJson(client, topic, payload) {
  return new Promise((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function buildTrayPayload(trayCode, sinkCode, reading) {
  return {
    node_id: trayCode,
    destination_id: sinkCode,
    ...reading,
  };
}

function buildActuatorPayload(sinkCode, actuators) {
  return {
    node_id: sinkCode,
    destination_id: sinkCode,
    fan_status: actuators.fan,
    irrigation_status: actuators.irrigation,
    lamp_status: actuators.lamp,
  };
}

function findScreenhouse(config, screenhouseId, sinkCode) {
  return config.screenhouses.find(
    (sh) => sh.screenhouseId === screenhouseId && sh.sinkCode === sinkCode
  );
}

async function publishTrayReadings(client, config, tickIndex) {
  const ts = new Date().toISOString();
  let total = 0;

  for (const sh of config.screenhouses) {
    const topic = sensorTopic(sh.screenhouseId, sh.sinkCode);

    for (let i = 0; i < sh.trays.length; i += 1) {
      const tray = sh.trays[i];
      const stateKey = `${sh.screenhouseId}:${tray.nodeCode}`;

      if (!trayState.has(stateKey)) {
        trayState.set(stateKey, initTrayState(sh.screenhouseId, i));
      }

      const forceHot = tickIndex > 0 && total === tickIndex % 10;
      const forceDry = tickIndex > 1 && total === (tickIndex + 3) % 10;
      const reading = nextReading(trayState.get(stateKey), { forceHot, forceDry });
      const payload = buildTrayPayload(tray.nodeCode, sh.sinkCode, reading);

      await publishJson(client, topic, payload);
      console.log(
        `[simulate-mqtt] ✓ tray ${tray.nodeCode} → ${topic} ` +
          `(km:${reading.soil_moisture}% N:${reading.nitrogen})`
      );

      total += 1;
      if (config.staggerMs > 0) await sleep(config.staggerMs);
    }
  }

  console.log(`[simulate-mqtt] tick #${tickIndex + 1} @ ${ts} — ${total} tray`);
}

async function publishActuatorFeedback(client, sh, reason = "telemetry") {
  const topic = sensorTopic(sh.screenhouseId, sh.sinkCode);
  const payload = buildActuatorPayload(sh.sinkCode, sh.actuators);
  await publishJson(client, topic, payload);
  console.log(
    `[simulate-mqtt] ↩ actuator ${sh.sinkCode} → ${topic} ` +
      `(fan:${payload.fan_status} irig:${payload.irrigation_status} lamp:${payload.lamp_status})` +
      (reason ? ` [${reason}]` : "")
  );
}

function parseCommandTopic(topic) {
  const parts = topic.split("/");
  if (parts[0] !== "screenhouse") return null;

  if (parts.length >= 5 && parts[2] === "sink" && parts[4] === "command") {
    return {
      screenhouseId: Number(parts[1]),
      sinkCode: parts[3],
      kind: "sink-command",
    };
  }

  if (parts.length === 3 && parts[2] === "actuator") {
    return {
      screenhouseId: Number(parts[1]),
      sinkCode: null,
      kind: "broadcast",
    };
  }

  return null;
}

function applyCommand(sh, data) {
  const sinkCode = data.destination_id ?? data.destinationId ?? data.node_id ?? data.nodeId;
  if (sinkCode && String(sinkCode) !== sh.sinkCode) return false;

  if (data.fan_status != null) sh.actuators.fan = Boolean(data.fan_status);
  if (data.irrigation_status != null) sh.actuators.irrigation = Boolean(data.irrigation_status);
  if (data.lamp_status != null) sh.actuators.lamp = Boolean(data.lamp_status);
  return true;
}

async function handleCommandMessage(client, config, topic, message) {
  let data;
  try {
    data = JSON.parse(message.toString());
  } catch {
    console.warn("[simulate-mqtt] command bukan JSON:", topic);
    return;
  }

  const parsed = parseCommandTopic(topic);
  if (!parsed || !Number.isInteger(parsed.screenhouseId)) {
    return;
  }

  if (parsed.kind === "broadcast") {
    const sh = config.screenhouses.find((s) => s.screenhouseId === parsed.screenhouseId);
    if (!sh) return;
    const targetSink = data.destination_id ?? data.destinationId ?? data.node_id ?? data.nodeId;
    if (targetSink && String(targetSink) !== sh.sinkCode) return;
    if (!applyCommand(sh, data)) return;
    await publishActuatorFeedback(client, sh, data.source || "command");
    return;
  }

  const sh = findScreenhouse(config, parsed.screenhouseId, parsed.sinkCode);
  if (!sh) {
    console.warn(`[simulate-mqtt] command untuk sink tidak dikenal: ${topic}`);
    return;
  }

  if (!applyCommand(sh, data)) return;

  console.log(
    `[simulate-mqtt] ⚡ command ${topic} ` +
      `fan=${sh.actuators.fan} irig=${sh.actuators.irrigation} lamp=${sh.actuators.lamp}`
  );
  await publishActuatorFeedback(client, sh, data.source || "command");
}

async function main() {
  const config = loadConfig();

  console.log("[simulate-mqtt] BibitLive MQTT infra simulator");
  console.log(`  Broker    : ${BROKER_URL}`);
  console.log(`  Config    : ${CONFIG_PATH}`);
  console.log(`  Interval  : ${Math.round(config.intervalMs / 1000)}s`);
  console.log(`  Stagger   : ${config.staggerMs / 1000}s antar tray`);
  console.log(`  Sites     : ${config.screenhouses.length}`);
  for (const sh of config.screenhouses) {
    const trays = sh.trays.map((t) => t.nodeCode).join(", ");
    console.log(
      `    SH${sh.screenhouseId} sink=${sh.sinkCode} trays=[${trays}] ` +
        `cmd=${commandTopic(sh.screenhouseId, sh.sinkCode)}`
    );
  }
  console.log("");

  const client = mqtt.connect(BROKER_URL);

  await new Promise((resolve, reject) => {
    client.once("connect", resolve);
    client.once("error", reject);
  });

  const subscribeTopics = [
    "screenhouse/+/sink/+/command",
    "screenhouse/+/actuator",
  ];

  for (const topic of subscribeTopics) {
    await new Promise((resolve, reject) => {
      client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) reject(err);
        else {
          console.log(`[simulate-mqtt] subscribed: ${topic}`);
          resolve();
        }
      });
    });
  }

  client.on("message", (topic, message) => {
    handleCommandMessage(client, config, topic, message).catch((err) => {
      console.error("[simulate-mqtt] command handler:", err.message);
    });
  });

  let tick = 0;
  await publishTrayReadings(client, config, tick);
  tick += 1;

  if (ONCE) {
    console.log("\n[simulate-mqtt] --once selesai.");
    client.end();
    return;
  }

  const timer = setInterval(async () => {
    try {
      await publishTrayReadings(client, config, tick);
      tick += 1;
    } catch (err) {
      console.error("[simulate-mqtt] tick error:", err.message);
    }
  }, config.intervalMs);

  process.on("SIGINT", () => {
    console.log("\n[simulate-mqtt] dihentikan.");
    clearInterval(timer);
    client.end();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[simulate-mqtt] gagal:", err.message);
  process.exit(1);
});
