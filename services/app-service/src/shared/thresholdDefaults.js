const DEFAULT_THRESHOLD = [
  20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000,
];

const THRESHOLD_COLS = [
  "min_nitrogen", "max_nitrogen",
  "min_phosphorus", "max_phosphorus",
  "min_potassium", "max_potassium",
  "min_soil_moisture", "max_soil_moisture",
  "min_soil_temperature", "max_soil_temperature",
  "min_soil_ph", "max_soil_ph",
  "min_conductivity", "max_conductivity",
  "min_air_temperature", "max_air_temperature",
  "min_air_humidity", "max_air_humidity",
  "min_light_intensity", "max_light_intensity",
];

module.exports = { DEFAULT_THRESHOLD, THRESHOLD_COLS };
