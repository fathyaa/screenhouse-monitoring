const THRESHOLD_METRICS = [
  { key: "nitrogen", label: "Nitrogen", minCol: "min_nitrogen", maxCol: "max_nitrogen", actualCol: "actual_nitrogen" },
  { key: "phosphorus", label: "Phosphorus", minCol: "min_phosphorus", maxCol: "max_phosphorus", actualCol: "actual_phosphorus" },
  { key: "potassium", label: "Kalium", minCol: "min_potassium", maxCol: "max_potassium", actualCol: "actual_potassium" },
  { key: "soil_moisture", label: "Kelembapan tanah", minCol: "min_soil_moisture", maxCol: "max_soil_moisture", actualCol: "actual_soil_moisture" },
  { key: "soil_temperature", label: "Suhu tanah", minCol: "min_soil_temperature", maxCol: "max_soil_temperature", actualCol: "actual_soil_temperature" },
  { key: "soil_ph", label: "pH tanah", minCol: "min_soil_ph", maxCol: "max_soil_ph", actualCol: "actual_soil_ph" },
  { key: "conductivity", label: "Konduktivitas", minCol: "min_conductivity", maxCol: "max_conductivity", actualCol: "actual_conductivity" },
  { key: "air_temperature", label: "Suhu udara", minCol: "min_air_temperature", maxCol: "max_air_temperature", actualCol: "actual_air_temperature" },
  { key: "air_humidity", label: "Kelembapan udara", minCol: "min_air_humidity", maxCol: "max_air_humidity", actualCol: "actual_air_humidity" },
  { key: "light_intensity", label: "Intensitas cahaya", minCol: "min_light_intensity", maxCol: "max_light_intensity", actualCol: "actual_light_intensity" },
];

module.exports = { THRESHOLD_METRICS };
