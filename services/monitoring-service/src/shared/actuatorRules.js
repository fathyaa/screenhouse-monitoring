/** Pemetaan parameter threshold → aksi aktuator (ON/OFF). */
const ACTUATOR_RULES = {
  soil_moisture: {
    low: { irrigation: true },
    high: { irrigation: false },
  },
  air_temperature: {
    high: { fan: true },
    low: { fan: false },
  },
  air_humidity: {
    high: { fan: true },
    low: { fan: false },
  },
  soil_temperature: {
    high: { fan: true },
    low: { lamp: true },
  },
  light_intensity: {
    low: { lamp: true },
    high: { lamp: false },
  },
};

const LABEL_TO_KEY = {
  nitrogen: "nitrogen",
  phosphorus: "phosphorus",
  kalium: "potassium",
  "kelembapan tanah": "soil_moisture",
  "suhu tanah": "soil_temperature",
  "ph tanah": "soil_ph",
  konduktivitas: "conductivity",
  "suhu udara": "air_temperature",
  "kelembapan udara": "air_humidity",
  "intensitas cahaya": "light_intensity",
};

function paramKeyFromLabel(label) {
  const lower = (label || "").toLowerCase();
  for (const [match, key] of Object.entries(LABEL_TO_KEY)) {
    if (lower.includes(match)) return key;
  }
  return null;
}

function resolveActuatorActions(violations) {
  const out = {};
  for (const { key, direction } of violations) {
    const rule = ACTUATOR_RULES[key]?.[direction];
    if (!rule) continue;
    if (rule.fan != null) out.fan = rule.fan;
    if (rule.irrigation != null) out.irrigation = rule.irrigation;
    if (rule.lamp != null) out.lamp = rule.lamp;
  }
  return out;
}

/**
 * Aksi aktuator saat parameter pulih ke rentang ideal (bukan cuma pindah ke
 * arah pelanggaran sebaliknya). Membalik rule ON (`true`) dari arah yang baru
 * saja resolve jadi OFF — rule yang sudah OFF di arah itu tidak perlu dibalik
 * karena aktuator memang seharusnya sudah mati.
 */
function resolveActuatorRecoveryActions(recoveries) {
  const out = {};
  for (const { key, direction } of recoveries) {
    const rule = ACTUATOR_RULES[key]?.[direction];
    if (!rule) continue;
    if (rule.fan === true) out.fan = false;
    if (rule.irrigation === true) out.irrigation = false;
    if (rule.lamp === true) out.lamp = false;
  }
  return out;
}

function resolveActuatorActionsFromAlertMessage(message) {
  const lower = (message || "").toLowerCase();
  const key = paramKeyFromLabel(lower);
  if (!key) return {};

  let direction = null;
  if (lower.includes("minimum") || lower.includes("bawah")) direction = "low";
  if (lower.includes("maksimum") || lower.includes("melebihi")) direction = "high";
  if (!direction) return {};

  return resolveActuatorActions([{ key, direction }]);
}

module.exports = {
  ACTUATOR_RULES,
  resolveActuatorActions,
  resolveActuatorRecoveryActions,
  resolveActuatorActionsFromAlertMessage,
  paramKeyFromLabel,
};
