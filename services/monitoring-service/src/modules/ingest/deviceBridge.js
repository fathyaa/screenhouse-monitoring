/**
 * Jembatan ingest untuk perangkat sensor sungguhan lewat broker MQTT mana pun
 * (HiveMQ Cloud maupun broker lokal — ditentukan env DEVICE_BRIDGE_URL).
 *
 * SENGAJA TERPISAH dari mqttService.js (jalur simulator / broker lokal default):
 *  - Koneksi MQTT sendiri (URL + auth dari env; TLS otomatis bila skema mqtts://).
 *  - Payload berformat CSV (bukan JSON) sesuai struct firmware perangkat.
 *  - Topik berpola `gh01/...`, bukan `screenhouse/...`.
 *
 * Persistensi TIDAK diduplikasi: setelah CSV di-parse & di-normalisasi ke
 * kontrak internal, payload dititipkan ke antrean lewat callback yang sama
 * dipakai jalur simulator (q.ingest → processing → persistence → alert).
 * Modul ini hidup di role `collector` dan tidak punya koneksi database.
 *
 * Kontrak topik (dari spec firmware):
 *   SUB  gh01/node/+/parameter              → CSV telemetri sensor
 *   SUB  gh01/node/<sink>/status/valve{1,2} → status katup (0/1)
 *   PUB  gh01/node/<sink>/control/valve{1,2} ← perintah katup (payload "0"/"1")
 *
 * valve1 = irigasi tray 1, valve2 = irigasi tray 2, dikontrol TERPISAH. Karena
 * sink_nodes cuma punya tiga kolom status (fan/irrigation/lamp), katup kedua
 * meminjam slot `fan` — lihat VALVE_BY_ACTUATOR di bawah.
 *
 * Urutan kolom CSV "parameter" (dipisah ";", minimal 12 kolom; light opsional):
 *   0 timestamp, 1 nodeId, 2 nodeTarget, 3 soilMoisture(÷10), 4 soilTemperature(÷10),
 *   5 conductivity, 6 soilPh(÷10), 7 nitrogen, 8 phosporus, 9 kalium,
 *   10 airTemperature(÷10), 11 airHumidity(÷10), 12 lightIntensity (boleh tidak dikirim)
 */

const os = require("os");
const mqtt = require("mqtt");

const DEBUG = process.env.DEVICE_BRIDGE_DEBUG === "true";

// Diisi connectDeviceBridge(). Jembatan ini hidup di role `collector`, yang
// tidak punya koneksi database sama sekali — tiap frame cuma dititipkan ke
// antrean lewat callback ini.
let emitJob = async () => {};

// Katup irigasi dikontrol per tray. Perangkat punya dua katup, sedangkan
// sink_nodes hanya menyediakan tiga slot status boolean (fan/irrigation/lamp) —
// jadi katup tray 2 MEMINJAM slot `fan`. gh01 tidak punya kipas fisik, jadi slot
// itu menganggur. Konsekuensinya: gh01 wajib dikecualikan dari aktuator otomatis
// (AUTO_ACTUATOR_EXCLUDE) karena rule bawaan memetakan suhu udara tinggi → fan ON,
// yang di sini berarti "buka katup tray 2". Label untuk petani di-override lewat
// ACTUATOR_CAPABILITIES (fan=Irigasi Tray 2).
const VALVE_BY_ACTUATOR = { irrigation: "valve1", fan: "valve2" };
const ACTUATOR_BY_VALVE = { valve1: "irrigation_status", valve2: "fan_status" };

// Kolom CSV → [index, key, divisor, min, max]. index sesuai struct firmware; divisor
// untuk nilai satuan ×10 (mis. "546" = 54,6). [min,max] SENGAJA dibuat = kapasitas
// kolom DB (NUMERIC(5,2)=±999.99, NUMERIC(4,2)=±99.99, NUMERIC(10,2)=±99jt), BUKAN
// rentang fisik: tujuannya cuma mencegah "numeric field overflow". Nilai ngawur yang
// MASIH MUAT tetap disimpan & ditampilkan apa adanya, biar ketahuan sensor bermasalah.
// Integer (NPK) tidak dibatasi. light_intensity (index 12) opsional.
const CSV_SENSOR_COLUMNS = [
  [3, "soil_moisture", 10, -999.99, 999.99],
  [4, "soil_temperature", 10, -999.99, 999.99],
  [5, "conductivity", 1, -99999999.99, 99999999.99],
  [6, "soil_ph", 10, -99.99, 99.99],
  [7, "nitrogen", 1],
  [8, "phosphorus", 1],
  [9, "potassium", 1],
  [10, "air_temperature", 10, -999.99, 999.99],
  [11, "air_humidity", 10, -999.99, 999.99],
  [12, "light_intensity", 1, -99999999.99, 99999999.99],
];

let client = null;
/** prefix (mis. "gh01") → { prefix, screenhouseId } */
const bridgesByPrefix = new Map();
/** screenhouseId (number) → { prefix, screenhouseId } */
const bridgesByScreenhouse = new Map();

/** Parse DEVICE_BRIDGE_MAP = "gh01:700[,gh02:701...]" (prefix:screenhouseId). */
function parseBridges() {
  const raw = process.env.DEVICE_BRIDGE_MAP || "";
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const [prefix, idRaw] = trimmed.split(":").map((s) => s.trim());
    const screenhouseId = Number(idRaw);
    if (!prefix || !Number.isInteger(screenhouseId)) {
      console.warn("[device-bridge] entri DEVICE_BRIDGE_MAP tidak valid, dilewati:", entry);
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
  // Delimiter kolom = ";", jadi koma di dalam nilai adalah pemisah desimal (mis. "26,5").
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Batas kewajaran waktu ukur: 2020-01-01 s.d. 2100-01-01. Di luar itu dianggap
// jam perangkat belum diset / counter uptime → tak dipakai (created_at fallback
// ke NOW() waktu terima), bukan menyimpan tanggal ngawur.
const MIN_TS_MS = Date.UTC(2020, 0, 1);
const MAX_TS_MS = Date.UTC(2100, 0, 1);

// Cek rentang 2020-2100 saja tidak cukup: RTC gh01 pernah keset ~22 jam di
// belakang jam sebenarnya — tanggalnya "wajar" tapi salah hari. Akibatnya
// created_at mundur sehari, sehingga "terakhir alat ukur aktif" di dashboard
// bilang kemarin walau data baru masuk, node selalu dinilai offline oleh
// checkOfflineNodes (yang membandingkan MAX(created_at) dengan jam server), dan
// grafik/stress score mendarat di tanggal yang salah.
// Jadi waktu perangkat cuma dipercaya bila selisihnya dengan jam server masih
// wajar (sekadar latensi kirim/antrean); lebih dari itu → dianggap jam perangkat
// belum sinkron, created_at balik ke NOW() waktu terima.
const MAX_CLOCK_SKEW_MS =
  Math.max(Number(process.env.DEVICE_MAX_CLOCK_SKEW_SEC) || 900, 60) * 1000;

// Jam perangkat yang keset akan meleset di SETIAP frame; jangan banjiri log.
let lastSkewWarnAt = 0;
const SKEW_WARN_INTERVAL_MS = 5 * 60 * 1000;

function warnClockSkew(deviceDate, now) {
  if (now - lastSkewWarnAt < SKEW_WARN_INTERVAL_MS) return;
  lastSkewWarnAt = now;
  const skewMin = Math.round((now - deviceDate.getTime()) / 60000);
  console.warn(
    `[device-bridge] jam perangkat meleset ${skewMin} menit dari server ` +
      `(payload ${deviceDate.toISOString()}) — created_at pakai waktu terima. ` +
      `Setel ulang RTC/NTP perangkat, atau naikkan DEVICE_MAX_CLOCK_SKEW_SEC bila memang disengaja.`
  );
}

/**
 * Timestamp dari kolom 0 payload → Date, atau null bila tidak valid, di luar
 * rentang wajar, atau terlalu jauh dari jam server. Format firmware belum
 * dipastikan, jadi parser ini toleran:
 *  - epoch detik / milidetik (dibedakan dari besarannya)
 *  - string tanggal (mis. ISO) — bila tanpa zona, diparse sesuai runtime.
 */
function parseDeviceTimestamp(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;

  let d = null;

  if (/^\d+$/.test(s)) {
    // Nilai < 1e11 diperlakukan sebagai epoch DETIK (epoch milidetik jaman ini
    // ~1.7e12), jadi dikali 1000. Counter uptime kecil akan jatuh sebelum 2020
    // dan tersaring oleh cek rentang di bawah.
    let ms = Number(s);
    if (ms < 1e11) ms *= 1000;
    d = new Date(ms);
  } else {
    // Format firmware gh01: "YYYY-MM-DD HH:MM:SS" — waktu LOKAL WIB tanpa zona.
    // Tempelkan offset +07:00 eksplisit supaya hasilnya benar di server zona mana
    // pun (tanpa ini, di server UTC `new Date` menafsirkannya UTC → meleset 7 jam).
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    d = m
      ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+07:00`)
      : new Date(s); // fallback: string ISO yang sudah ber-zona, dll.
  }

  const t = d.getTime();
  if (!Number.isFinite(t) || t < MIN_TS_MS || t >= MAX_TS_MS) return null;

  const now = Date.now();
  if (Math.abs(now - t) > MAX_CLOCK_SKEW_MS) {
    warnClockSkew(d, now);
    return null;
  }

  return d;
}

/** CSV "parameter" → objek data kontrak internal (+ node_id / destination_id). */
function parseParameterCsv(payload) {
  // Firmware perangkat gh01 memakai pemisah kolom ";" (bukan ",").
  const cols = String(payload).trim().split(";");
  // Minimal 12 kolom (0..11): timestamp, nodeId, nodeTarget, + 9 nilai sensor s.d.
  // air_humidity. light_intensity (kolom 12) opsional. Frame lebih pendek = rusak;
  // kolom ekstra di ujung diabaikan.
  if (cols.length < 12) return null;

  const nodeId = String(cols[1]).trim();
  const nodeTarget = String(cols[2]).trim();
  if (!nodeId) return null;

  const data = {
    node_id: nodeId,
    destination_id: nodeTarget || null,
    // Kolom 0 = waktu ukur di perangkat → dipakai sebagai created_at sensor_data.
    // null bila tak terkirim/ngawur → saveSensorReading fallback ke NOW() (waktu terima).
    measured_at: parseDeviceTimestamp(cols[0]),
  };
  for (const [index, key, divisor, min, max] of CSV_SENSOR_COLUMNS) {
    let value = toNumberOrNull(cols[index]);
    if (value != null && divisor) value = value / divisor;
    // Hanya null-kan bila melewati kapasitas kolom DB (kalau tidak → overflow &
    // seluruh frame gagal). Nilai ngawur yang masih muat sengaja dibiarkan tampil.
    if (value != null && ((min != null && value < min) || (max != null && value > max))) {
      value = null;
    }
    data[key] = value;
  }
  return data;
}

async function onParameter(bridge, topicParts, payload) {
  const data = parseParameterCsv(payload);
  if (!data) {
    console.warn("[device-bridge] frame parameter tidak valid:", String(payload).slice(0, 80));
    return;
  }

  // Pendaftaran node dititipkan ke processing lewat `ensureNode` — collector
  // tidak menyentuh database. Kalau node_code ternyata milik screenhouse lain,
  // processing yang menolak framenya.
  await emitJob({
    source: "device-bridge",
    data,
    topicParts,
    screenhouseIdFromTopic: String(bridge.screenhouseId),
    ensureNode: { screenhouseId: bridge.screenhouseId, nodeCode: data.node_id },
    receivedAt: new Date().toISOString(),
  });

  // Log hasil parse + keputusan waktu: measured_at valid → itu yang jadi created_at,
  // null → created_at fallback ke NOW() (waktu terima server).
  const waktu = data.measured_at
    ? `created_at←payload ${data.measured_at.toISOString()}`
    : "created_at←NOW (timestamp payload kosong/ngawur)";
  console.log(
    `[device-bridge] parameter node=${data.node_id} → sh ${bridge.screenhouseId} | ${waktu}`
  );
}

async function onStatus(bridge, topicParts, payload) {
  const valve = topicParts[4];
  const statusField = ACTUATOR_BY_VALVE[valve];
  if (!statusField) {
    if (DEBUG) console.log(`[device-bridge] status ${valve} diabaikan (belum dihandle)`);
    return;
  }
  const sinkCode = String(topicParts[2]).trim();
  // Perangkat gh01 mengirim status katup sebagai teks "ON"/"OFF" (bukan "1"/"0").
  // Terima juga "1"/"true" agar kompatibel dengan format lama.
  const raw = String(payload).trim().toLowerCase();
  const on = raw === "on" || raw === "1" || raw === "true";

  // Hanya kirim kolom katup yang dilaporkan — processing mempertahankan status
  // kanal lain apa adanya, jadi kedua katup tidak saling menimpa.
  const data = {
    node_id: sinkCode,
    destination_id: sinkCode,
    [statusField]: on,
  };
  // screenhouseIdFromTopic = null → resolusi sink lewat node_code (jalur aktuator).
  await emitJob({
    source: "device-bridge",
    data,
    topicParts,
    screenhouseIdFromTopic: null,
    receivedAt: new Date().toISOString(),
  });
  if (DEBUG)
    console.log(`[device-bridge] status ${valve}=${on ? 1 : 0} sink=${sinkCode} → ${statusField}`);
}

function handleMessage(topic, message) {
  const parts = topic.split("/");
  const bridge = bridgesByPrefix.get(parts[0]);
  if (!bridge) return;

  // Log tiap payload masuk (device-bridge low-volume, ~1 frame/menit) supaya
  // gampang debug: kelihatan persis apa yang dikirim gh01, termasuk frame yang
  // nanti di-drop karena topik/format tak dikenali.
  const raw = message.toString();
  console.log(`[device-bridge] payload masuk: ${topic} = ${raw}`);

  const kind = parts[3]; // gh01 / node / <id> / <kind>
  const handler =
    kind === "parameter" && parts.length === 4
      ? onParameter
      : kind === "status" && parts.length === 5
      ? onStatus
      : null;
  if (!handler) {
    console.log(`[device-bridge] topik tidak dikenali, dilewati: ${topic}`);
    return;
  }

  handler(bridge, parts, message.toString()).catch((err) =>
    console.error(
      "[device-bridge] gagal memproses pesan:",
      topic,
      "| payload:",
      message.toString().slice(0, 120),
      "|",
      err.message
    )
  );
}

function connectDeviceBridge(onJob) {
  if (typeof onJob === "function") emitJob = onJob;

  const url = process.env.DEVICE_BRIDGE_URL;
  if (!url) {
    console.log("[device-bridge] DEVICE_BRIDGE_URL tidak diset — jembatan perangkat nonaktif.");
    return;
  }

  parseBridges();
  if (bridgesByPrefix.size === 0) {
    console.warn("[device-bridge] DEVICE_BRIDGE_MAP kosong — tidak ada topik yang di-subscribe.");
    return;
  }

  // Perangkat publish QoS 0, jadi pesan yang lewat saat kita disconnect HILANG
  // permanen (broker tidak mengantrekannya, sesi persisten pun tak menolong).
  // Keepalive default mqtt.js 60s berarti koneksi yang mati diam-diam (tanpa FIN,
  // mis. NAT/jalur putus) baru ketahuan setelah ~90s + 5s reconnect — cukup lama
  // untuk menelan beberapa frame. Keepalive lebih pendek mempersempit jendela itu.
  const keepalive = Math.max(Number(process.env.DEVICE_BRIDGE_KEEPALIVE_SEC) || 30, 5);

  client = mqtt.connect(url, {
    username: process.env.DEVICE_BRIDGE_USERNAME,
    password: process.env.DEVICE_BRIDGE_PASSWORD,
    reconnectPeriod: 5000,
    keepalive,
    // Sengaja unik per proses (bukan clientId tetap): kalau bridge kebetulan
    // jalan dua kali — mis. container + `npm run dev` di host — clientId sama
    // membuat broker saling menendang keduanya berulang kali.
    clientId: `bibitlive-bridge-${os.hostname()}-${process.pid}`,
  });

  let connectedSince = null;

  client.on("connect", () => {
    connectedSince = Date.now();
    console.log(`[device-bridge] terhubung ke ${url} (keepalive ${keepalive}s)`);
    for (const { prefix } of bridgesByPrefix.values()) {
      for (const topic of [`${prefix}/node/+/parameter`, `${prefix}/node/+/status/+`]) {
        client.subscribe(topic, { qos: 1 }, (err) => {
          if (err) console.error("[device-bridge] gagal subscribe", topic, err.message);
          else console.log("[device-bridge] subscribed:", topic);
        });
      }
    }
  });

  client.on("message", handleMessage);
  client.on("error", (err) => console.error("[device-bridge]", err.message));
  client.on("reconnect", () => DEBUG && console.log("[device-bridge] reconnecting…"));

  // Putusnya koneksi = jendela kehilangan data (QoS 0), jadi selalu dicatat —
  // bukan cuma saat DEBUG — supaya lubang data di grafik bisa ditelusuri.
  client.on("close", () => {
    const uptime = connectedSince ? Math.round((Date.now() - connectedSince) / 1000) : null;
    connectedSince = null;
    console.warn(
      `[device-bridge] koneksi terputus${uptime != null ? ` setelah ${uptime}s tersambung` : ""}` +
        " — frame yang dikirim perangkat selama terputus tidak tersimpan (QoS 0)."
    );
  });
}

/**
 * Publish perintah katup ke perangkat (payload plain "0"/"1").
 * Dipanggil dari actuatorService saat status aktuator berubah — hanya kanal yang
 * benar-benar berubah yang dikirim, jadi menyalakan tray 1 tidak ikut menyentuh tray 2.
 * @param {boolean|undefined} irrigation status katup tray 1 (valve1); undefined = tidak berubah.
 * @param {boolean|undefined} fan        status katup tray 2 (valve2); undefined = tidak berubah.
 * @returns {boolean} true bila screenhouse ini memang perangkat ber-bridge & ada yang terkirim.
 */
function publishValveControl({ screenhouseId, sinkCode, irrigation, fan }) {
  const commands = { irrigation, fan };
  if (Object.values(commands).every((v) => v === undefined)) return false;

  const bridge = bridgesByScreenhouse.get(Number(screenhouseId));
  if (!bridge) return false;
  if (!client?.connected) {
    console.warn("[device-bridge] tidak terhubung — perintah valve dilewati:", screenhouseId);
    return false;
  }

  let sent = false;
  for (const [actuator, value] of Object.entries(commands)) {
    if (value === undefined) continue;
    const topic = `${bridge.prefix}/node/${sinkCode}/control/${VALVE_BY_ACTUATOR[actuator]}`;
    const payload = value ? "1" : "0";
    client.publish(topic, payload, { qos: 1 });
    sent = true;
    if (DEBUG) console.log(`[device-bridge] control → ${topic} = ${payload}`);
  }
  return sent;
}

function isDeviceBridgeScreenhouse(screenhouseId) {
  return bridgesByScreenhouse.has(Number(screenhouseId));
}

module.exports = {
  connectDeviceBridge,
  publishValveControl,
  isDeviceBridgeScreenhouse,
  // Diekspos untuk unit test parsing (bukan API publik).
  __test: { parseDeviceTimestamp, parseParameterCsv },
};
