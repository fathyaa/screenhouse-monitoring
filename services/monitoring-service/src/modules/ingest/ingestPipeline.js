const pool = require("../../config/db");
const { publishEvent } = require("../../shared/events/eventBus");
const { RK } = require("../../shared/events/routingKeys");
const { buildClientCapabilities } = require("../../shared/actuatorCapabilities");
const { recordMqttProcessed } = require("./ingestMetrics");

// Log per-pesan dimatikan default (blocking stdout I/O jadi bottleneck saat
// throughput tinggi). Set INGEST_DEBUG=true untuk mengaktifkannya lagi.
const DEBUG = process.env.INGEST_DEBUG === "true";

// --- Cache lookup ringan -----------------------------------------------------
// Node sensor/sink & pemilik screenhouse praktis statis selama satu run, tapi
// sebelumnya di-SELECT ulang untuk SETIAP pesan. Cache ber-TTL memangkas
// mayoritas round-trip DB pada hot path ingest. Status aktuator sink_node bisa
// berubah, jadi jalur tulis aktuator (saveActuatorState) tetap baca fresh.
//
// Cache ini sekarang hidup di dalam proses masing-masing role. Menambah replica
// berarti menambah salinan cache, bukan membaginya — itu disengaja: isinya
// hanya identitas node yang praktis tidak berubah, dan cache bersama akan
// menambah satu hop jaringan di jalur terpanas.
const LOOKUP_TTL_MS = Number(process.env.INGEST_LOOKUP_TTL_MS || 60000);
const sensorNodeCache = new Map();
const sinkNodeCache = new Map();
const fallbackSinkCache = new Map();
const ownerCache = new Map();

function cacheGet(map, key) {
  const hit = map.get(key);
  if (hit && Date.now() - hit.t < LOOKUP_TTL_MS) return hit;
  return null;
}

function cacheSet(map, key, value) {
  map.set(key, { value, t: Date.now() });
  return value;
}

async function cachedSensorNodeByCode(code) {
  if (!code) return null;
  const key = String(code);
  const hit = cacheGet(sensorNodeCache, key);
  if (hit) return hit.value;
  return cacheSet(sensorNodeCache, key, await resolveSensorNodeByCode(code));
}

async function cachedSinkNodeByCode(code) {
  if (!code) return null;
  const key = String(code);
  const hit = cacheGet(sinkNodeCache, key);
  if (hit) return hit.value;
  return cacheSet(sinkNodeCache, key, await resolveSinkNodeByCode(code));
}

async function cachedFallbackSink(screenhouseId) {
  const key = String(screenhouseId);
  const hit = cacheGet(fallbackSinkCache, key);
  if (hit) return hit.value;
  const result = await pool.query(
    `SELECT id, screenhouse_id, node_code, fan_status, irrigation_status, lamp_status
     FROM sink_nodes WHERE screenhouse_id = $1 AND is_active = true LIMIT 1`,
    [screenhouseId]
  );
  return cacheSet(fallbackSinkCache, key, result.rows[0] ?? null);
}

async function cachedOwnerUserId(screenhouseId) {
  const key = String(screenhouseId);
  const hit = cacheGet(ownerCache, key);
  if (hit) return hit.value;
  return cacheSet(ownerCache, key, await getOwnerUserId(screenhouseId));
}

const INSERT_ACTUATOR_LOG = `
  INSERT INTO actuator_logs (
    sink_node_id, screenhouse_id,
    fan_status, irrigation_status, lamp_status,
    source, reason
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  RETURNING id, fan_status, irrigation_status, lamp_status, created_at
`;

const SENSOR_READING_KEYS = [
  "nitrogen",
  "phosphorus",
  "potassium",
  "soil_temperature",
  "soil_moisture",
  "soil_ph",
  "conductivity",
  "air_temperature",
  "air_humidity",
  "light_intensity",
];

function pick(data, key, fallback = null) {
  const v = data[key];
  return v === undefined || v === null ? fallback : v;
}

function hasSensorReadings(data) {
  return SENSOR_READING_KEYS.some((key) => pick(data, key) != null);
}

function hasActuatorReadings(data) {
  return (
    pick(data, "fan_status") != null ||
    pick(data, "irrigation_status") != null ||
    pick(data, "lamp_status") != null
  );
}

function readingsOf(data) {
  return Object.fromEntries(SENSOR_READING_KEYS.map((key) => [key, pick(data, key)]));
}

async function resolveSensorNodeByCode(nodeCode) {
  if (!nodeCode) return null;
  const result = await pool.query(
    `SELECT id, screenhouse_id, node_code, node_name FROM sensor_nodes WHERE node_code = $1 AND is_active = true`,
    [String(nodeCode)]
  );
  return result.rows[0] ?? null;
}

async function resolveSinkNodeByCode(nodeCode) {
  if (!nodeCode) return null;
  const result = await pool.query(
    `SELECT id, screenhouse_id, node_code, fan_status, irrigation_status, lamp_status
     FROM sink_nodes WHERE node_code = $1 AND is_active = true`,
    [String(nodeCode)]
  );
  return result.rows[0] ?? null;
}

async function resolveSensorNodeLegacy(screenhouseIdFromTopic, data, topicParts) {
  const nodeCodeFromTopic =
    topicParts[2] === "node" ? topicParts[3] : topicParts[2] === "sink" ? topicParts[3] : null;

  const nodeId =
    pick(data, "sensor_node_id") ??
    pick(data, "sensorNodeId") ??
    pick(data, "node_sensor_id") ??
    null;

  const nodeCode =
    pick(data, "node_code") ??
    pick(data, "nodeCode") ??
    pick(data, "node_id") ??
    pick(data, "nodeId") ??
    nodeCodeFromTopic;

  if (nodeId) {
    const byId = await pool.query(
      `SELECT id, screenhouse_id, node_code, node_name FROM sensor_nodes WHERE id = $1`,
      [nodeId]
    );
    if (byId.rows[0]) return byId.rows[0];
  }

  if (nodeCode) {
    const byCode = await resolveSensorNodeByCode(nodeCode);
    if (byCode) return byCode;
  }

  if (screenhouseIdFromTopic) {
    const fallback = await pool.query(
      `
      SELECT id, screenhouse_id, node_code, node_name FROM sensor_nodes
      WHERE screenhouse_id = $1 AND is_active = true
      ORDER BY id ASC
      LIMIT 1
      `,
      [screenhouseIdFromTopic]
    );
    return fallback.rows[0] ?? null;
  }

  return null;
}

async function getOwnerUserId(screenhouseId) {
  const result = await pool.query(
    `SELECT owner_user_id FROM screenhouse_registry WHERE screenhouse_id = $1`,
    [screenhouseId]
  );
  return result.rows[0]?.owner_user_id ?? null;
}

/**
 * Pastikan sensor node dengan node_code ini terdaftar di screenhouse bridge.
 * Dulu tinggal di deviceBridge.js; pindah ke sini karena collector tidak lagi
 * punya koneksi database — ia hanya menitipkan niatnya lewat `ensureNode`.
 *
 * @returns {Promise<boolean>} false bila node_code sudah dipakai screenhouse
 *          lain (jangan salah-rutekan data ke screenhouse yang keliru).
 */
async function ensureSensorNode(screenhouseId, nodeCode) {
  const existing = await pool.query(
    `SELECT screenhouse_id FROM sensor_nodes WHERE node_code = $1`,
    [nodeCode]
  );
  if (existing.rows[0]) {
    if (Number(existing.rows[0].screenhouse_id) !== Number(screenhouseId)) {
      console.warn(
        `[processing] node_code ${nodeCode} sudah dipakai screenhouse ${existing.rows[0].screenhouse_id} ` +
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
  console.log(`[processing] sensor node baru didaftarkan: node_code=${nodeCode} → screenhouse ${screenhouseId}`);
  return true;
}

// === PERSISTENCE ============================================================
// Dijalankan role `persistence`. Satu-satunya tempat yang menulis sensor_data.

async function saveSensorReading({ sensorNode, sinkNode, data }) {
  const saved = await pool.query(
    `
    INSERT INTO sensor_data (
      sensor_node_id, sink_node_id,
      nitrogen, phosphorus, potassium,
      soil_temperature, soil_moisture, soil_ph, conductivity,
      air_temperature, air_humidity, light_intensity,
      created_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, COALESCE($13, NOW()))
    RETURNING *
    `,
    [
      sensorNode.id,
      sinkNode?.id ?? null,
      pick(data, "nitrogen"),
      pick(data, "phosphorus"),
      pick(data, "potassium"),
      pick(data, "soil_temperature"),
      pick(data, "soil_moisture"),
      pick(data, "soil_ph"),
      pick(data, "conductivity"),
      pick(data, "air_temperature"),
      pick(data, "air_humidity"),
      pick(data, "light_intensity"),
      // Waktu ukur dari payload bila ada & valid → jadi created_at.
      // null (simulator / timestamp ngawur) → COALESCE pakai NOW() waktu terima.
      pick(data, "measured_at", null),
    ]
  );

  const row = saved.rows[0];

  // Baris sudah commit — sejak titik ini pesan TIDAK BOLEH gagal ke pemanggil.
  // Consumer mengembalikan pesan yang error ke queue, jadi melempar di sini
  // (mis. RabbitMQ mati) akan menyisipkan baris yang sama dua kali. Event yang
  // hilang cuma bikin dashboard telat satu tick dan satu alert terlewat;
  // duplikat data sensor merusak laporan.
  recordMqttProcessed(data);

  try {
    await publishEvent(RK.SENSOR_PERSISTED, await buildPersistedEvent({ row, sensorNode, sinkNode, data }));
  } catch (err) {
    console.error("[persistence] baris tersimpan, publish event gagal:", err.message);
  }

  if (DEBUG) console.log("Sensor data saved & event published:", sensorNode.node_code);
  return row;
}

/**
 * Satu peristiwa, dua pemakai:
 *   `data`     → listener alert (evaluasi ambang, butuh sensorDataId untuk FK)
 *   `realtime` → gateway Socket.IO (payload siap kirim ke browser)
 *
 * Disatukan supaya urutan alert-vs-tampilan tidak pernah berbeda: keduanya
 * membaca peristiwa yang sama persis.
 */
async function buildPersistedEvent({ row, sensorNode, sinkNode, data }) {
  // Payload realtime disusun dari data yang sudah ada di memori (row hasil
  // INSERT + node terselesaikan), menggantikan SELECT 3-JOIN per pesan.
  // owner_user_id di-cache; status aktuator sink display-only (dijaga fresh
  // lewat event actuator.updated).
  const realtime = {
    ...row,
    screenhouse_id: sensorNode.screenhouse_id,
    node_code: sensorNode.node_code,
    node_name: sensorNode.node_name ?? null,
    fan_status: sinkNode?.fan_status ?? null,
    irrigation_status: sinkNode?.irrigation_status ?? null,
    lamp_status: sinkNode?.lamp_status ?? null,
    capabilities: buildClientCapabilities(sensorNode.screenhouse_id),
    user_id: await cachedOwnerUserId(sensorNode.screenhouse_id),
  };

  return {
    sensorDataId: row.id,
    screenhouseId: String(sensorNode.screenhouse_id),
    sensorNodeId: sensorNode.id,
    nodeCode: sensorNode.node_code,
    sinkNodeId: sinkNode?.id ?? null,
    data: readingsOf(data),
    realtime,
  };
}

// === AKTUATOR DARI TELEMETRI ================================================
// Perangkat melaporkan posisi katup/relay-nya sendiri. Ditangani processing
// karena ia yang sudah memegang hasil resolusi node.

async function saveActuatorState({ sinkNode, data, source = "telemetry", reason = null }) {
  // sinkNode bisa berasal dari cache (status aktuator mungkin basi), jadi baca
  // status terkini langsung dari DB sebelum membandingkan perubahan.
  const current = (await resolveSinkNodeByCode(sinkNode.node_code)) ?? sinkNode;

  const nextFan = Boolean(pick(data, "fan_status", current.fan_status ?? false));
  const nextIrrigation = Boolean(
    pick(data, "irrigation_status", current.irrigation_status ?? false)
  );
  const nextLamp = Boolean(pick(data, "lamp_status", current.lamp_status ?? false));

  const unchanged =
    Boolean(current.fan_status) === nextFan &&
    Boolean(current.irrigation_status) === nextIrrigation &&
    Boolean(current.lamp_status) === nextLamp;

  if (unchanged) return;

  // Status berubah → cache identitas sink boleh tetap, tapi status basi harus
  // dibuang supaya payload berikutnya tidak menampilkan nilai lama.
  sinkNodeCache.delete(String(sinkNode.node_code));
  if (sinkNode.screenhouse_id != null) {
    fallbackSinkCache.delete(String(sinkNode.screenhouse_id));
  }

  await pool.query(
    `
    UPDATE sink_nodes
    SET fan_status = $2, irrigation_status = $3, lamp_status = $4, updated_at = NOW()
    WHERE id = $1
    `,
    [sinkNode.id, nextFan, nextIrrigation, nextLamp]
  );

  const saved = await pool.query(INSERT_ACTUATOR_LOG, [
    sinkNode.id,
    sinkNode.screenhouse_id,
    nextFan,
    nextIrrigation,
    nextLamp,
    source,
    reason,
  ]);

  const ownerUserId = await getOwnerUserId(sinkNode.screenhouse_id);
  await publishEvent(RK.ACTUATOR_UPDATED, {
    screenhouse_id: sinkNode.screenhouse_id,
    sink_node_id: sinkNode.id,
    node_code: sinkNode.node_code,
    fan_status: saved.rows[0].fan_status,
    irrigation_status: saved.rows[0].irrigation_status,
    lamp_status: saved.rows[0].lamp_status,
    source,
    reason,
    user_id: ownerUserId,
    created_at: saved.rows[0].created_at,
  });

  if (DEBUG) console.log("Actuator state saved:", sinkNode.node_code);
}

// === PROCESSING =============================================================
// Dijalankan role `processing`: satu tugas dari q.ingest → satu peristiwa.

/**
 * @param {object} job payload dari q.ingest (lihat roles/collector.js)
 * @returns {Promise<boolean>} false bila payload tidak bisa dipetakan ke node
 */
async function processIngestJob(job) {
  const {
    data,
    topicParts = [],
    screenhouseIdFromTopic = null,
    ensureNode = null,
  } = job;

  // Perangkat ber-bridge mendaftarkan node-nya sendiri saat frame pertama.
  if (ensureNode) {
    const registered = await ensureSensorNode(ensureNode.screenhouseId, ensureNode.nodeCode);
    if (!registered) return false;
  }

  const nodeIdRaw =
    pick(data, "node_id") ??
    pick(data, "nodeId") ??
    pick(data, "node_code") ??
    pick(data, "nodeCode");

  const destinationIdRaw =
    pick(data, "destination_id") ??
    pick(data, "destinationId") ??
    pick(data, "destination_code");

  const [sinkByDestination, asSensor, asSink] = await Promise.all([
    destinationIdRaw ? cachedSinkNodeByCode(destinationIdRaw) : null,
    nodeIdRaw ? cachedSensorNodeByCode(nodeIdRaw) : null,
    nodeIdRaw ? cachedSinkNodeByCode(nodeIdRaw) : null,
  ]);

  let sinkNode = sinkByDestination;

  let sensorNode = null;
  if (nodeIdRaw) {
    if (asSensor && (!asSink || asSensor.node_code !== asSink.node_code)) {
      sensorNode = asSensor;
    }
    if (!sinkNode && asSink) {
      sinkNode = asSink;
    }
  }

  if (!sensorNode) {
    sensorNode = await resolveSensorNodeLegacy(screenhouseIdFromTopic, data, topicParts);
  }

  if (!sinkNode && sensorNode) {
    sinkNode = await cachedFallbackSink(sensorNode.screenhouse_id);
  }

  const isSinkOrigin =
    sinkNode &&
    nodeIdRaw &&
    String(nodeIdRaw) === String(destinationIdRaw ?? sinkNode.node_code);

  if (sensorNode && hasSensorReadings(data) && !isSinkOrigin) {
    if (
      screenhouseIdFromTopic &&
      String(sensorNode.screenhouse_id) !== String(screenhouseIdFromTopic)
    ) {
      console.log("Screenhouse topic tidak cocok dengan sensor node");
      return false;
    }
    if (sinkNode && sensorNode.screenhouse_id !== sinkNode.screenhouse_id) {
      console.log("Sensor node dan sink node beda screenhouse — dibuang");
      return false;
    }

    // Node sudah terselesaikan, payload sudah bersih — tapi belum masuk DB.
    // Yang menulis adalah listener persistence.
    await publishEvent(RK.SENSOR_RAW, { sensorNode, sinkNode, data });
    return true;
  }

  if (sinkNode && hasActuatorReadings(data) && (isSinkOrigin || !hasSensorReadings(data))) {
    await saveActuatorState({
      sinkNode,
      data,
      source: pick(data, "source", "telemetry"),
      reason: pick(data, "reason"),
    });
    return true;
  }

  if (!sensorNode && !sinkNode) {
    console.log("Node tidak ditemukan untuk payload:", { nodeIdRaw, destinationIdRaw });
    return false;
  }

  if (hasSensorReadings(data)) {
    return false;
  }

  return true;
}

module.exports = {
  processIngestJob,
  saveSensorReading,
  saveActuatorState,
  ensureSensorNode,
  getOwnerUserId,
};
