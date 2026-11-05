/**
 * Kontrak MQTT model kolaborasi robot ↔ sistem monitoring melalui sink node
 * (proposal tesis, Tabel 3.3). Semua topik bisa diganti lewat env.
 *
 *   telemetry/env     sink → cloud   {h_id, n_id, seq, ts, sn, sm, ah, t, uv}
 *   mission/command   cloud → sink   {m_id, h_id, cmd, trays, crit_lvl, ts}
 *   mission/status    sink → cloud   {m_id, r_id, st, cur_tray, pct, bat, seq, ts}
 *   mission/result    sink → cloud   {m_id, h_id, tray_id, label, conf, h_cm, anom, seq, ts}
 *   actuator/control  sink → cloud   {h_id, act_id, action, dur_s, trig, seq, ts}
 *
 * Telemetri diterjemahkan ke bentuk internal lalu masuk jalur ingest yang sudah
 * ada (q.ingest → processing → persistence). Pesan misi & aktuasi masuk antrean
 * kerja q.collab yang dikonsumsi role `collaboration`.
 *
 * Penamaan node mengikuti konvensi repo: sink = `<h_id>-SINK`, tray = n_id apa
 * adanya (mis. "SH90-T01"), sehingga node_id di payload = node_code di DB.
 */

const TOPICS = {
  telemetry: process.env.COLLAB_TOPIC_TELEMETRY || "telemetry/env",
  command: process.env.COLLAB_TOPIC_COMMAND || "mission/command",
  status: process.env.COLLAB_TOPIC_STATUS || "mission/status",
  result: process.env.COLLAB_TOPIC_RESULT || "mission/result",
  actuator: process.env.COLLAB_TOPIC_ACTUATOR || "actuator/control",
};

const SINK_SUFFIX = process.env.COLLAB_SINK_SUFFIX ?? "-SINK";
const ENABLED = process.env.COLLAB_ENABLED !== "false";

/** Kode sink node dari house id (h_id). */
function sinkCodeOf(houseCode) {
  return `${houseCode}${SINK_SUFFIX}`;
}

/** Kebalikan sinkCodeOf: "SH90-SINK" → "SH90". */
function houseCodeOf(sinkCode) {
  const s = String(sinkCode || "");
  return SINK_SUFFIX && s.endsWith(SINK_SUFFIX) ? s.slice(0, -SINK_SUFFIX.length) : s;
}

/** Epoch detik/milidetik → milidetik; null bila tidak valid. */
function toMillis(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1e11 ? n * 1000 : n;
}

/** Epoch → ISO, hanya bila masuk akal (tidak lebih dari 1 hari ke depan / 1 tahun ke belakang). */
function toIsoOrNull(ts) {
  const ms = toMillis(ts);
  if (ms == null) return null;
  const now = Date.now();
  if (ms > now + 86400e3 || ms < now - 365 * 86400e3) return null;
  return new Date(ms).toISOString();
}

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Kunci idempotensi — identik dengan spsbench (repo tesis) agar bisa dicocokkan. */
const idempKey = {
  telemetry: (m) => `${m.h_id}/${m.n_id}/tel/${m.seq}`,
  status: (m) => `${m.m_id}/${m.r_id}/st/${m.seq}`,
  result: (m) => `${m.h_id}/${m.m_id}/res/${m.seq}`,
  actuator: (m) => `${m.h_id}/${m.act_id}/act/${m.seq}`,
};

/**
 * Terjemahkan telemetry/env (kunci ringkas) ke payload ingest internal.
 * sn → nutrient, sm → soil_moisture, ah → air_humidity, t → air_temperature, uv → uv_index.
 */
function adaptTelemetry(msg) {
  if (!msg || !msg.h_id || !msg.n_id) return null;
  return {
    node_id: String(msg.n_id),
    destination_id: sinkCodeOf(msg.h_id),
    nutrient: num(msg.sn),
    soil_moisture: num(msg.sm),
    air_humidity: num(msg.ah),
    air_temperature: num(msg.t),
    uv_index: num(msg.uv),
    measured_at: toIsoOrNull(msg.ts),
    idemp_key: msg.seq != null ? idempKey.telemetry(msg) : null,
  };
}

/** Topik → jenis pesan kolaborasi (atau null). */
function kindOf(topic) {
  for (const [kind, t] of Object.entries(TOPICS)) {
    if (t === topic) return kind;
  }
  return null;
}

module.exports = {
  TOPICS,
  ENABLED,
  sinkCodeOf,
  houseCodeOf,
  toMillis,
  toIsoOrNull,
  num,
  idempKey,
  adaptTelemetry,
  kindOf,
};
