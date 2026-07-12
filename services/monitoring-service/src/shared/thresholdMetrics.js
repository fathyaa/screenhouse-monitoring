/** Pemetaan field sensor_data ↔ kolom thresholds (schema terbaru) */
const THRESHOLD_METRICS = [
  { key: "nitrogen", label: "Nitrogen", minCol: "min_nitrogen", maxCol: "max_nitrogen" },
  { key: "phosphorus", label: "Phosphorus", minCol: "min_phosphorus", maxCol: "max_phosphorus" },
  { key: "potassium", label: "Kalium", minCol: "min_potassium", maxCol: "max_potassium" },
  { key: "soil_moisture", label: "Kelembapan tanah", minCol: "min_soil_moisture", maxCol: "max_soil_moisture" },
  { key: "soil_temperature", label: "Suhu tanah", minCol: "min_soil_temperature", maxCol: "max_soil_temperature" },
  { key: "soil_ph", label: "pH tanah", minCol: "min_soil_ph", maxCol: "max_soil_ph" },
  { key: "conductivity", label: "Konduktivitas", minCol: "min_conductivity", maxCol: "max_conductivity" },
  { key: "air_temperature", label: "Suhu udara", minCol: "min_air_temperature", maxCol: "max_air_temperature" },
  { key: "air_humidity", label: "Kelembapan udara", minCol: "min_air_humidity", maxCol: "max_air_humidity" },
  { key: "light_intensity", label: "Intensitas cahaya", minCol: "min_light_intensity", maxCol: "max_light_intensity" },
];

// Parameter yang menentukan status/insight screenhouse (selaras frontend paramHealth).
// Cahaya & konduktivitas tetap dipakai alert worker, tapi tidak memicu banner "tidak sehat".
const HEALTH_STATUS_KEYS = new Set([
  "nitrogen",
  "phosphorus",
  "potassium",
  "soil_moisture",
  "soil_temperature",
  "soil_ph",
  "air_temperature",
  "air_humidity",
]);

const HEALTH_STATUS_METRICS = THRESHOLD_METRICS.filter((m) =>
  HEALTH_STATUS_KEYS.has(m.key)
);

module.exports = { THRESHOLD_METRICS, HEALTH_STATUS_METRICS };
