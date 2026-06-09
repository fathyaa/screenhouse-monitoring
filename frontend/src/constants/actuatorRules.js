/** Label aktuator yang direkomendasikan otomatis saat alert (mirror backend rules). */
export const ACTUATOR_HINTS = {
  soil_moisture: { low: "Irigasi dinyalakan otomatis", high: "Irigasi dimatikan otomatis" },
  air_temperature: { high: "Kipas dinyalakan otomatis", low: "Kipas dimatikan otomatis" },
  air_humidity: { high: "Kipas dinyalakan otomatis", low: "Kipas dimatikan otomatis" },
  soil_temperature: { high: "Kipas dinyalakan otomatis", low: "Lampu dinyalakan otomatis" },
  light_intensity: { low: "Lampu dinyalakan otomatis", high: "Lampu dimatikan otomatis" },
};

export function getActuatorHintForAlert(alert) {
  const lower = alert?.message?.toLowerCase() ?? "";
  const direction = lower.includes("maksimum") || lower.includes("melebihi")
    ? "high"
    : lower.includes("minimum") || lower.includes("bawah")
    ? "low"
    : null;
  if (!direction) return null;

  const param =
    lower.includes("kelembapan tanah") ? "soil_moisture"
    : lower.includes("suhu udara") ? "air_temperature"
    : lower.includes("kelembapan udara") ? "air_humidity"
    : lower.includes("suhu tanah") ? "soil_temperature"
    : lower.includes("intensitas cahaya") ? "light_intensity"
    : null;

  return param ? ACTUATOR_HINTS[param]?.[direction] ?? null : null;
}
