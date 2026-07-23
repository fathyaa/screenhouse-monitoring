/**
 * Kapabilitas aktuator per-screenhouse — aktuator apa yang BENAR-BENAR ada di
 * perangkat fisik, plus label tampilannya. Berbasis config (env), TANPA kolom DB baru.
 *
 * Env `ACTUATOR_CAPABILITIES` = daftar "screenhouseId:aktuator1|aktuator2".
 * Aktuator: fan, irrigation, lamp. Contoh gh01 (cuma irigasi):
 *   ACTUATOR_CAPABILITIES=700:irrigation
 *
 * Tiap aktuator boleh diberi label sendiri dengan "aktuator=Label". Dipakai gh01
 * yang punya DUA katup irigasi (tray 1 & tray 2): slot `fan` dipinjam sebagai
 * kanal katup kedua supaya tidak perlu kolom DB baru, tapi ditampilkan ke petani
 * sebagai irigasi — bukan kipas:
 *   ACTUATOR_CAPABILITIES=700:irrigation=Irigasi Tray 1|fan=Irigasi Tray 2
 *
 * Screenhouse yang TIDAK terdaftar → dianggap punya semua aktuator (default true)
 * supaya screenhouse lama & simulator tidak berubah perilaku.
 */

const ACTUATOR_KEYS = ["fan", "irrigation", "lamp"];

function parseCapabilities() {
  const raw = process.env.ACTUATOR_CAPABILITIES || "";
  const map = new Map();
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const screenhouseId = Number(trimmed.slice(0, idx).trim());
    if (!Number.isInteger(screenhouseId)) continue;

    const available = new Set();
    const labels = {};
    for (const token of trimmed.slice(idx + 1).split(/[|+]/)) {
      const part = token.trim();
      if (!part) continue;
      // "fan=Irigasi Tray 2" → slot fan dipakai, tapi diberi label lain.
      const eq = part.indexOf("=");
      const key = (eq === -1 ? part : part.slice(0, eq)).trim().toLowerCase();
      if (!ACTUATOR_KEYS.includes(key)) continue;
      available.add(key);
      const label = eq === -1 ? "" : part.slice(eq + 1).trim();
      if (label) labels[key] = label;
    }

    map.set(screenhouseId, {
      capabilities: {
        fan: available.has("fan"),
        irrigation: available.has("irrigation"),
        lamp: available.has("lamp"),
      },
      labels,
    });
  }
  return map;
}

/**
 * Screenhouse yang dikecualikan dari kontrol aktuator otomatis, terlepas dari
 * AUTO_ACTUATOR_ENABLED. Env `AUTO_ACTUATOR_EXCLUDE` = daftar id dipisah koma.
 *
 * Dipakai gh01: slot `fan` di sana sebenarnya katup air tray 2, sedangkan rule
 * otomatis memetakan suhu/kelembapan udara tinggi → fan ON. Tanpa pengecualian
 * ini, hari yang panas akan membuka katup dan membanjiri tray 2. Aturan otomatis
 * juga belum tahu tray mana yang kering (alert bawa sensor_node_id, tapi aksi
 * aktuator masih per-screenhouse), jadi irigasi gh01 sengaja manual dulu.
 */
function parseAutoExcluded() {
  const raw = process.env.AUTO_ACTUATOR_EXCLUDE || "";
  const set = new Set();
  for (const part of raw.split(",")) {
    const id = Number(part.trim());
    if (Number.isInteger(id)) set.add(id);
  }
  return set;
}

const CONFIG = parseCapabilities();
const AUTO_EXCLUDED = parseAutoExcluded();

const ALL_AVAILABLE = { fan: true, irrigation: true, lamp: true };

/** @returns {{ fan: boolean, irrigation: boolean, lamp: boolean }} */
function getActuatorCapabilities(screenhouseId) {
  return CONFIG.get(Number(screenhouseId))?.capabilities || ALL_AVAILABLE;
}

/**
 * Label khusus per aktuator (mis. gh01: fan → "Irigasi Tray 2"). Kosong berarti
 * frontend memakai label bawaan (Kipas/Irigasi/Lampu).
 * @returns {Record<string, string>}
 */
function getActuatorLabels(screenhouseId) {
  return CONFIG.get(Number(screenhouseId))?.labels || {};
}

/**
 * Kontrol aktuator otomatis dari alert aktif untuk screenhouse ini? false = app
 * tidak menyetir aktuator & tidak mengunci toggle (mis. saat uji koneksi device,
 * atau perangkat yang slot aktuatornya dipinjam untuk fungsi lain). Default aktif.
 */
function isAutoActuatorEnabled(screenhouseId) {
  if (process.env.AUTO_ACTUATOR_ENABLED === "false") return false;
  if (screenhouseId != null && AUTO_EXCLUDED.has(Number(screenhouseId))) return false;
  return true;
}

/**
 * Kapabilitas + label + status auto untuk dikirim ke frontend. `autoEnabled=false`
 * membuat UI tidak menampilkan lock "dikontrol otomatis".
 */
function buildClientCapabilities(screenhouseId) {
  return {
    ...getActuatorCapabilities(screenhouseId),
    labels: getActuatorLabels(screenhouseId),
    autoEnabled: isAutoActuatorEnabled(screenhouseId),
  };
}

module.exports = {
  getActuatorCapabilities,
  getActuatorLabels,
  isAutoActuatorEnabled,
  buildClientCapabilities,
  ACTUATOR_KEYS,
};
