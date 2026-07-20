/**
 * Jembatan ingest untuk perangkat sensor sungguhan lewat HiveMQ Cloud.
 *
 * SENGAJA TERPISAH dari mqttService.js (jalur simulator / broker lokal):
 *  - Broker berbeda (HiveMQ Cloud, TLS + auth) → koneksi MQTT sendiri.
 *  - Payload berformat CSV (bukan JSON) sesuai struct firmware perangkat.
 *  - Topik berpola `gh01/...`, bukan `screenhouse/...`.
 *
 * Persistensi TIDAK diduplikasi: setelah CSV di-parse & di-normalisasi ke
 * kontrak internal, payload diteruskan ke handleMqttPayload() yang sama dipakai
 * jalur simulator (insert sensor_data, event Redis, trigger alert, dst).
 *
 * Kontrak topik (dari spec firmware):
 *   SUB  gh01/node/+/parameter              → CSV telemetri sensor
 *   SUB  gh01/node/<sink>/status/valve{1,2} → status katup (0/1)
 *   PUB  gh01/node/<sink>/control/valve{1,2} ← perintah katup (payload "0"/"1")
 *
 * valve1 = irigasi tray 1, valve2 = irigasi tray 2. Untuk saat ini keduanya
 * diperlakukan sebagai satu "Irigasi" logis (kontrol serempak, status OR).
 *
 * Urutan kolom CSV "parameter" (struct PayloadData + timestamp & nodeTarget):
 *   0 timestamp, 1 nodeId, 2 nodeTarget, 3 soilMoisture, 4 soilTemperature,
 *   5 conductivity, 6 soilPh, 7 nitrogen, 8 phosporus, 9 kalium,
 *   10 airTemperature, 11 airHumidity, 12 lightIntensity
 */

const mqtt = require("mqtt");
const pool = require("../../config/db");
const { handleMqttPayload } = require("./ingestPipeline");

const DEBUG = process.env.HIVEMQ_DEBUG === "true";

// Katup irigasi: valve1 = tray 1, valve2 = tray 2. Untuk saat ini keduanya
// diperlakukan sebagai SATU "Irigasi" logis (kontrol serempak, status ON bila
// salah satu valve ON) — lihat model "A" di keputusan integrasi gh01.
const IRRIGATION_VALVES = ["valve1", "valve2"];

// State valve terakhir per sink (in-memory) untuk menghitung OR valve1||valve2.
// Hilang saat restart; valve yang belum pernah dilaporkan dianggap OFF sampai
// device mengirim status berikutnya.
const valveStateBySink = new Map(); // sinkCode -> { valve1: bool, valve2: bool }

// Kolom CSV → key kontrak internal (index sesuai struct firmware).
const CSV_SENSOR_COLUMNS = [
  [3, "soil_moisture"],
  [4, "soil_temperature"],
  [5, "conductivity"],
  [6, "soil_ph"],
  [7, "nitrogen"],
  [8, "phosphorus"],
  [9, "potassium"],
  [10, "air_temperature"],
  [11, "air_humidity"],
  [12, "light_intensity"],
];

let client = null;
/** prefix (mis. "gh01") → { prefix, screenhouseId } */
const bridgesByPrefix = new Map();
/** screenhouseId (number) → { prefix, screenhouseId } */
const bridgesByScreenhouse = new Map();

/** Parse HIVEMQ_BRIDGES = "gh01:700[,gh02:701...]" (prefix:screenhouseId). */
function parseBridges() {
  const raw = process.env.HIVEMQ_BRIDGES || "";
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const [prefix, idRaw] = trimmed.split(":").map((s) => s.trim());
    const screenhouseId = Number(idRaw);
    if (!prefix || !Number.isInteger(screenhouseId)) {
      console.warn("[hivemq] entri HIVEMQ_BRIDGES tidak valid, dilewati:", entry);
      continue;
    }
    const bridge = { prefix, screenhouseId };
    bridgesByPrefix.set(prefix, bridge);
    bridgesByScreenhouse.set(screenhouseId, bridge);
  }
}

function toNumberOrNull(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** CSV "parameter" → objek data kontrak internal (+ node_id / destination_id). */
function parseParameterCsv(payload) {
  const cols = String(payload).trim().split(",");
  // 13 kolom sesuai struct. Frame lebih pendek = rusak; lebih panjang = kolom
  // ekstra di ujung diabaikan (posisi 0-12 tetap valid).
  if (cols.length < 13) return null;

  const nodeId = String(cols[1]).trim();
  const nodeTarget = String(cols[2]).trim();
  if (!nodeId) return null;

  const data = { node_id: nodeId, destination_id: nodeTarget || null };
  for (const [index, key] of CSV_SENSOR_COLUMNS) {
    data[key] = toNumberOrNull(cols[index]);
  }
  return data;
}

/**
 * Pastikan sensor node dengan node_code ini terdaftar di screenhouse bridge.
 * @returns {Promise<boolean>} false bila node_code sudah dipakai screenhouse lain
 *          (jangan salah-rutekan data ke screenhouse yang keliru).
 */
async function ensureSensorNode(screenhouseId, nodeCode) {
  const existing = await pool.query(
    `SELECT screenhouse_id FROM sensor_nodes WHERE node_code = $1`,
    [nodeCode]
  );
  if (existing.rows[0]) {
    if (Number(existing.rows[0].screenhouse_id) !== Number(screenhouseId)) {
      console.warn(
        `[hivemq] node_code ${nodeCode} sudah dipakai screenhouse ${existing.rows[0].screenhouse_id} ` +
          `(diharapkan ${screenhouseId}) — frame diabaikan agar tidak salah rute.`
      );
      return false;
    }
    return true;
  }

  await pool.query(
    `INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, send_interval_seconds, is_active)
     VALUES ($1, $2, $3, 60, true)
     ON CONFLICT (node_code) DO NOTHING`,
    [screenhouseId, nodeCode, `GH node ${nodeCode}`]
  );
  console.log(`[hivemq] sensor node baru didaftarkan: node_code=${nodeCode} → screenhouse ${screenhouseId}`);
  return true;
}

async function onParameter(bridge, topicParts, payload) {
  const data = parseParameterCsv(payload);
  if (!data) {
    console.warn("[hivemq] frame parameter tidak valid:", String(payload).slice(0, 80));
    return;
  }

  const ok = await ensureSensorNode(bridge.screenhouseId, data.node_id);
  if (!ok) return;

  await handleMqttPayload(data, topicParts, String(bridge.screenhouseId));
  if (DEBUG) console.log(`[hivemq] parameter node=${data.node_id} → sh ${bridge.screenhouseId}`);
}

async function onStatus(bridge, topicParts, payload) {
  const valve = topicParts[4];
  if (!IRRIGATION_VALVES.includes(valve)) {
    if (DEBUG) console.log(`[hivemq] status ${valve} diabaikan (belum dihandle)`);
    return;
  }
  const sinkCode = String(topicParts[2]).trim();
  const on = String(payload).trim() === "1";

  // Gabungkan status kedua valve → irigasi ON bila salah satu valve ON.
  const state = valveStateBySink.get(sinkCode) || {};
  state[valve] = on;
  valveStateBySink.set(sinkCode, state);
  const irrigationOn = IRRIGATION_VALVES.some((v) => state[v] === true);

  const data = {
    node_id: sinkCode,
    destination_id: sinkCode,
    irrigation_status: irrigationOn,
  };
  // screenhouseIdFromTopic = null → resolusi sink lewat node_code (jalur aktuator).
  await handleMqttPayload(data, topicParts, null);
  if (DEBUG)
    console.log(
      `[hivemq] status ${valve}=${on ? 1 : 0} sink=${sinkCode} → irigasi ${irrigationOn ? "ON" : "OFF"}`
    );
}

function handleMessage(topic, message) {
  const parts = topic.split("/");
  const bridge = bridgesByPrefix.get(parts[0]);
  if (!bridge) return;

  const kind = parts[3]; // gh01 / node / <id> / <kind>
  const handler =
    kind === "parameter" && parts.length === 4
      ? onParameter
      : kind === "status" && parts.length === 5
      ? onStatus
      : null;
  if (!handler) return;

  handler(bridge, parts, message.toString()).catch((err) =>
    console.error("[hivemq] gagal memproses pesan:", topic, err.message)
  );
}

function connectHiveMq() {
  const url = process.env.HIVEMQ_URL;
  if (!url) {
    console.log("[hivemq] HIVEMQ_URL tidak diset — jembatan HiveMQ nonaktif.");
    return;
  }

  parseBridges();
  if (bridgesByPrefix.size === 0) {
    console.warn("[hivemq] HIVEMQ_BRIDGES kosong — tidak ada topik yang di-subscribe.");
    return;
  }

  client = mqtt.connect(url, {
    username: process.env.HIVEMQ_USERNAME,
    password: process.env.HIVEMQ_PASSWORD,
    reconnectPeriod: 5000,
  });

  client.on("connect", () => {
    console.log("[hivemq] terhubung ke", url);
    for (const { prefix } of bridgesByPrefix.values()) {
      for (const topic of [`${prefix}/node/+/parameter`, `${prefix}/node/+/status/+`]) {
        client.subscribe(topic, { qos: 1 }, (err) => {
          if (err) console.error("[hivemq] gagal subscribe", topic, err.message);
          else console.log("[hivemq] subscribed:", topic);
        });
      }
    }
  });

  client.on("message", handleMessage);
  client.on("error", (err) => console.error("[hivemq]", err.message));
  client.on("reconnect", () => DEBUG && console.log("[hivemq] reconnecting…"));
}

/**
 * Publish perintah katup ke perangkat (payload plain "0"/"1").
 * Dipanggil dari actuatorService saat status irigasi berubah.
 * @returns {boolean} true bila screenhouse ini memang perangkat HiveMQ & terkirim.
 */
function publishValveControl({ screenhouseId, sinkCode, irrigation }) {
  if (irrigation === undefined) return false;
  const bridge = bridgesByScreenhouse.get(Number(screenhouseId));
  if (!bridge) return false;
  if (!client?.connected) {
    console.warn("[hivemq] tidak terhubung — perintah valve dilewati:", screenhouseId);
    return false;
  }
  // Satu "Irigasi" logis → kontrol serempak valve1 (tray 1) & valve2 (tray 2).
  const payload = irrigation ? "1" : "0";
  for (const valve of IRRIGATION_VALVES) {
    const topic = `${bridge.prefix}/node/${sinkCode}/control/${valve}`;
    client.publish(topic, payload, { qos: 1 });
    if (DEBUG) console.log(`[hivemq] control → ${topic} = ${payload}`);
  }
  return true;
}

function isHiveMqScreenhouse(screenhouseId) {
  return bridgesByScreenhouse.has(Number(screenhouseId));
}

module.exports = { connectHiveMq, publishValveControl, isHiveMqScreenhouse };
