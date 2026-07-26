export const THRESHOLD_METRICS = [
  { key: "nitrogen", label: "Nitrogen (N)", unit: "mg/kg", minCol: "min_nitrogen", maxCol: "max_nitrogen" },
  { key: "phosphorus", label: "Phosphorus (P)", unit: "mg/kg", minCol: "min_phosphorus", maxCol: "max_phosphorus" },
  { key: "potassium", label: "Kalium (K)", unit: "mg/kg", minCol: "min_potassium", maxCol: "max_potassium" },
  { key: "soil_moisture", label: "Kelembapan tanah", unit: "%", minCol: "min_soil_moisture", maxCol: "max_soil_moisture" },
  { key: "soil_temperature", label: "Suhu tanah", unit: "°C", minCol: "min_soil_temperature", maxCol: "max_soil_temperature" },
  { key: "soil_ph", label: "pH tanah", unit: "pH", minCol: "min_soil_ph", maxCol: "max_soil_ph" },
  { key: "conductivity", label: "Konduktivitas", unit: "µS/cm", minCol: "min_conductivity", maxCol: "max_conductivity" },
  { key: "air_temperature", label: "Suhu udara", unit: "°C", minCol: "min_air_temperature", maxCol: "max_air_temperature" },
  { key: "air_humidity", label: "Kelembapan udara", unit: "%", minCol: "min_air_humidity", maxCol: "max_air_humidity" },
  { key: "light_intensity", label: "Intensitas cahaya", unit: "lux", minCol: "min_light_intensity", maxCol: "max_light_intensity" },
];

export const DEFAULT_THRESHOLD = {
  min_nitrogen: 20, max_nitrogen: 45,
  min_phosphorus: 10, max_phosphorus: 30,
  min_potassium: 40, max_potassium: 120,
  min_soil_moisture: 50, max_soil_moisture: 80,
  min_soil_temperature: 20, max_soil_temperature: 35,
  min_soil_ph: 5.5, max_soil_ph: 7.0,
  min_conductivity: 200, max_conductivity: 800,
  min_air_temperature: 22, max_air_temperature: 35,
  min_air_humidity: 40, max_air_humidity: 85,
  min_light_intensity: 5000, max_light_intensity: 50000,
};
