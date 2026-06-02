export const PRIMARY_SENSOR_FIELDS = [
  { key: "nitrogen", label: "Nitrogen", unit: "mg/kg" },
  { key: "phosphorus", label: "Phosphorus", unit: "mg/kg" },
  { key: "potassium", label: "Potassium", unit: "mg/kg" },
  { key: "soil_moisture", label: "Kelembapan tanah", unit: "%" },
  { key: "soil_temperature", label: "Suhu tanah", unit: "°C" },
  { key: "soil_ph", label: "pH tanah", unit: "" },
  { key: "air_temperature", label: "Suhu udara", unit: "°C" },
  { key: "air_humidity", label: "Kelembapan udara", unit: "%" },
];

export const POPUP_SENSOR_FIELDS = [
  { key: "nitrogen", label: "Nitrogen" },
  { key: "soil_moisture", label: "Kelembapan tanah", unit: "%" },
  { key: "soil_ph", label: "pH tanah" },
  { key: "air_temperature", label: "Suhu udara", unit: "°C" },
];

export const ALERT_PARAM_MAP = [
  { match: "nitrogen", param: "nitrogen", actual: "actual_nitrogen", min: "min_nitrogen", max: "max_nitrogen", unit: "mg/kg" },
  { match: "phosphorus", param: "phosphorus", actual: "actual_phosphorus", min: "min_phosphorus", max: "max_phosphorus", unit: "mg/kg" },
  { match: "potassium", param: "potassium", actual: "actual_potassium", min: "min_potassium", max: "max_potassium", unit: "mg/kg" },
  { match: "kelembapan tanah", param: "soil_moisture", actual: "actual_soil_moisture", min: "min_soil_moisture", max: "max_soil_moisture", unit: "%" },
  { match: "suhu tanah", param: "soil_temperature", actual: "actual_soil_temperature", min: "min_soil_temperature", max: "max_soil_temperature", unit: "°C" },
  { match: "ph tanah", param: "soil_ph", actual: "actual_soil_ph", min: "min_soil_ph", max: "max_soil_ph", unit: "" },
  { match: "konduktivitas", param: "conductivity", actual: "actual_conductivity", min: "min_conductivity", max: "max_conductivity", unit: "µS/cm" },
  { match: "suhu udara", param: "air_temperature", actual: "actual_air_temperature", min: "min_air_temperature", max: "max_air_temperature", unit: "°C" },
  { match: "kelembapan udara", param: "air_humidity", actual: "actual_air_humidity", min: "min_air_humidity", max: "max_air_humidity", unit: "%" },
  { match: "intensitas cahaya", param: "light_intensity", actual: "actual_light_intensity", min: "min_light_intensity", max: "max_light_intensity", unit: "lux" },
];

export function formatSensorValue(value, unit = "") {
  if (value == null || value === "") return "—";
  return `${value}${unit}`;
}
