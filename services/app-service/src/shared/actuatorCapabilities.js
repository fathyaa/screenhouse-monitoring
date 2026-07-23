/**
 * Aktuator fisik apa yang benar-benar ada di sebuah screenhouse.
 *
 * Sumber kebenarannya ada di monitoring-service (`src/shared/actuatorCapabilities.js`)
 * yang memakai env `ACTUATOR_CAPABILITIES` yang SAMA. Di sini cuma dibaca ulang
 * (parser minimal, tanpa label) supaya laporan & analytics siklus tidak
 * menghitung aktuator yang tidak ada — mis. gh01 meminjam slot `fan` untuk katup
 * irigasi tray 2, jadi kolom fan_status di actuator_logs-nya bukan kipas dan
 * tidak boleh muncul sebagai "Kipas" di laporan wilayah / analytics siklus.
 *
 * Format: "screenhouseId:aktuator1|aktuator2", aktuator boleh berlabel
 * ("fan=Irigasi Tray 2" — label diabaikan di sini). Screenhouse yang tidak
 * terdaftar dianggap punya semua aktuator.
 */

const ACTUATOR_KEYS = ["fan", "irrigation", "lamp"];
const ALL_AVAILABLE = { fan: true, irrigation: true, lamp: true };

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
        .map((token) => token.split("=")[0].trim().toLowerCase())
        .filter((key) => ACTUATOR_KEYS.includes(key))
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
  return CAPABILITIES.get(Number(screenhouseId)) || ALL_AVAILABLE;
}

module.exports = { getActuatorCapabilities, ACTUATOR_KEYS };
