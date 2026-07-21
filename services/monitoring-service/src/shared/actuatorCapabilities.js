/**
 * Kapabilitas aktuator per-screenhouse — aktuator apa yang BENAR-BENAR ada di
 * perangkat fisik. Berbasis config (env), TANPA kolom DB baru.
 *
 * Env `ACTUATOR_CAPABILITIES` = daftar "screenhouseId:aktuator1|aktuator2".
 * Aktuator: fan, irrigation, lamp. Contoh gh01 (cuma irigasi):
 *   ACTUATOR_CAPABILITIES=700:irrigation
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
    const available = new Set(
      trimmed
        .slice(idx + 1)
        .split(/[|+]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );
    map.set(screenhouseId, {
      fan: available.has("fan"),
      irrigation: available.has("irrigation"),
      lamp: available.has("lamp"),
    });
  }
  return map;
}

const CAPABILITIES = parseCapabilities();

/** @returns {{ fan: boolean, irrigation: boolean, lamp: boolean }} */
function getActuatorCapabilities(screenhouseId) {
  return (
    CAPABILITIES.get(Number(screenhouseId)) || { fan: true, irrigation: true, lamp: true }
  );
}

/**
 * Kontrol aktuator otomatis dari alert aktif? false = app tidak menyetir aktuator
 * & tidak mengunci toggle (mis. saat uji koneksi device). Default aktif.
 */
function isAutoActuatorEnabled() {
  return process.env.AUTO_ACTUATOR_ENABLED !== "false";
}

/**
 * Kapabilitas + status auto untuk dikirim ke frontend. `autoEnabled=false`
 * membuat UI tidak menampilkan lock "dikontrol otomatis".
 */
function buildClientCapabilities(screenhouseId) {
  return { ...getActuatorCapabilities(screenhouseId), autoEnabled: isAutoActuatorEnabled() };
}

module.exports = {
  getActuatorCapabilities,
  isAutoActuatorEnabled,
  buildClientCapabilities,
  ACTUATOR_KEYS,
};
