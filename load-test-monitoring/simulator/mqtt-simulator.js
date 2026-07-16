/**
 * MQTT IoT sensor simulator backed by real sensor_nodes from PostgreSQL.
 *
 * The simulator publishes sensor telemetry only for active nodes that already
 * exist in the application/monitoring databases. MQTT is used as a sensor
 * transport emulator; backend processing metrics are the measured target.
 */

import mqtt from "mqtt";
import { buildSensorPayload, buildTopic } from "./payload-generator.js";
import { loadActiveSensorNodes, staggerInitialDelay } from "./sensor-registry.js";

export class MqttSimulator {
  constructor({
    brokerUrl,
    topicPattern = "screenhouse/{screenhouseId}/sink/{sinkCode}/sensor",
    runId = "manual",
    poolSize = 32,
    env = process.env,
  }) {
    this.brokerUrl = brokerUrl;
    this.topicPattern = topicPattern;
    this.runId = runId;
    this.poolSize = poolSize;
    this.env = env;
    this.clients = [];
    this.running = false;
    this.stats = this._initialStats();
    this._seq = 0;
    this._timer = null;
    this._sensors = [];
    this._intervalSec = 1;
  }

  _initialStats() {
    return {
      published: 0,
      publishErrors: 0,
      startedAt: null,
      finishedAt: null,
    };
  }

  async prepareSensors(sensorCount, intervalSec) {
    const nodes = await loadActiveSensorNodes({ env: this.env, limit: sensorCount });
    this._sensors = staggerInitialDelay(nodes, intervalSec);
    this._intervalSec = intervalSec;
    return this.getSensors();
  }

  getSensors() {
    return this._sensors.map((sensor) => ({ ...sensor }));
  }

  getSensorNodeIds() {
    return this._sensors.map((sensor) => sensor.sensorNodeId);
  }

  async connect() {
    const clients = Array.from({ length: this.poolSize }, (_, i) => this._connectClient(i));
    this.clients = await Promise.all(clients);
  }

  _connectClient(index) {
    return new Promise((resolve, reject) => {
      const client = mqtt.connect(this.brokerUrl, {
        clientId: `loadtest-${this.runId}-${index}-${Math.random().toString(16).slice(2)}`,
        reconnectPeriod: 2000,
        connectTimeout: 10_000,
        clean: true,
      });

      const onError = (err) => {
        client.removeListener("connect", onConnect);
        reject(err);
      };
      const onConnect = () => {
        client.removeListener("error", onError);
        resolve(client);
      };

      client.once("connect", onConnect);
      client.once("error", onError);
    });
  }

  async disconnect() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this.running = false;

    await Promise.all(
      this.clients.map(
        (client) =>
          new Promise((resolve) => {
            client.end(false, {}, resolve);
          })
      )
    );
    this.clients = [];
  }

  async start({ sensors, intervalSec, durationSec, onTick }) {
    if (this.running) throw new Error("Simulator already running");
    if (!this.clients.length) throw new Error("Simulator is not connected to MQTT broker");

    if (!this._sensors.length || this._sensors.length !== sensors) {
      await this.prepareSensors(sensors, intervalSec);
    } else {
      staggerInitialDelay(this._sensors, intervalSec);
      this._intervalSec = intervalSec;
    }

    this.running = true;
    this.stats = this._initialStats();
    this.stats.startedAt = Date.now();
    this._seq = 0;

    const endAt = Date.now() + durationSec * 1000;
    const tickMs = Number(this.env.LOADTEST_SIM_TICK_MS || 10);

    return new Promise((resolve) => {
      this._timer = setInterval(() => {
        const now = Date.now();
        if (now >= endAt) {
          clearInterval(this._timer);
          this._timer = null;
          this.running = false;
          this.stats.finishedAt = now;
          resolve(this.getStats());
          return;
        }

        const due = this._sensors.filter((sensor) => sensor.nextSendAt <= now);
        if (due.length) {
          void Promise.all(due.map((sensor) => this._publishScheduled(sensor, now, intervalSec)));
        }

        if (onTick) onTick({ ...this.getStats(), activeSensors: this._sensors.length });
      }, tickMs);
    });
  }

  async _publishScheduled(sensor, now, intervalSec) {
    sensor.nextSendAt += intervalSec * 1000;
    if (sensor.nextSendAt <= now) {
      sensor.nextSendAt = now + intervalSec * 1000;
    }

    await this._publishOne(sensor);
    sensor.messagesSent += 1;
  }

  async _publishOne(sensor) {
    this._seq += 1;
    const payload = buildSensorPayload({
      nodeCode: sensor.nodeCode,
      sinkCode: sensor.sinkCode,
      seq: this._seq,
      runId: this.runId,
    });
    const topic = buildTopic(this.topicPattern, sensor);
    const client = this.clients[this._seq % this.clients.length];
    const body = JSON.stringify(payload);

    try {
      await new Promise((resolve, reject) => {
        client.publish(topic, body, { qos: 0 }, (err) => (err ? reject(err) : resolve()));
      });
      this.stats.published += 1;
    } catch {
      this.stats.publishErrors += 1;
    }
  }

  getStats() {
    const elapsedSec = this.stats.startedAt
      ? Math.max((Date.now() - this.stats.startedAt) / 1000, 0.001)
      : 0;
    return {
      ...this.stats,
      elapsedSec,
      publishRatePerSec: this.stats.published / elapsedSec,
      expectedTotal: this._sensors.length
        ? Math.floor((elapsedSec / this._intervalSec) * this._sensors.length)
        : 0,
    };
  }
}

function parseArgs() {
  return Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, value] = arg.replace(/^--/, "").split("=");
      return [key, value ?? true];
    })
  );
}

async function main() {
  const args = parseArgs();
  const sensors = Number(args.sensors || 80);
  const intervalSec = Number(args.interval || 1);
  const durationSec = Number(args.duration || 60);

  const sim = new MqttSimulator({
    brokerUrl: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
    runId: args["run-id"] || "cli",
    poolSize: Number(args["pool-size"] || process.env.LOADTEST_MQTT_POOL_SIZE || 32),
  });

  const selected = await sim.prepareSensors(sensors, intervalSec);
  console.log(
    `[simulator] ${selected.length} active DB sensors, interval=${intervalSec}s, duration=${durationSec}s`
  );

  await sim.connect();
  const result = await sim.start({
    sensors,
    intervalSec,
    durationSec,
    onTick: (stats) => {
      if (Math.floor(stats.elapsedSec) % 10 === 0 && stats.elapsedSec % 1 < 0.05) {
        console.log(`  published=${stats.published} rate=${stats.publishRatePerSec.toFixed(1)}/s`);
      }
    },
  });

  await sim.disconnect();
  console.log("[simulator] done", result);
}

if (process.argv[1]?.endsWith("mqtt-simulator.js")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
