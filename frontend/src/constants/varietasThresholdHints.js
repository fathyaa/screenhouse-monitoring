const HINT_TEMPLATES = {
  nitrogen: (min, max, nama) =>
    `Nitrogen ${min}–${max} mg/kg optimal untuk pertumbuhan daun fase pembibitan ${nama}.`,
  phosphorus: (min, max, nama) =>
    `Fosfor ${min}–${max} mg/kg mendukung akar dan jaringan awal varietas ${nama}.`,
  potassium: (min, max, nama) =>
    `Kalium ${min}–${max} mg/kg membantu turgiditas dan ketahanan bibit ${nama}.`,
  soil_moisture: (min, max, nama) =>
    `Kelembapan tanah ${min}–${max}% menjaga semai ${nama} tidak kering atau kebasahan.`,
  soil_ph: (min, max, nama) =>
    `pH tanah ${min}–${max} sesuai kisaran optimal serap hara fase pembibitan ${nama}.`,
  soil_temperature: (min, max, nama) =>
    `Suhu tanah ${min}–${max}°C mendukung perkecambahan seragam bibit ${nama}.`,
  conductivity: (min, max, nama) =>
    `Konduktivitas ${min}–${max} µS/cm mengindikasikan ketersediaan ion hara untuk ${nama}.`,
  air_temperature: (min, max, nama) =>
    `Suhu udara ${min}–${max}°C nyaman untuk pertumbuhan awal ${nama} di screenhouse.`,
  air_humidity: (min, max, nama) =>
    `Kelembapan udara ${min}–${max}% mencegah transpirasi berlebih pada bibit ${nama}.`,
  light_intensity: (min, max, nama) =>
    `Cahaya ${min}–${max} lux cukup untuk fotosintesis tanpa stress pada ${nama}.`,
};

export function getThresholdHint(key, varietasName, min, max) {
  if (!varietasName || min == null || max == null) return null;
  const fn = HINT_TEMPLATES[key];
  if (fn) return fn(min, max, varietasName);
  return `Batas ${min}–${max} mengacu standar pembibitan ${varietasName}.`;
}

export function formatVarietasSourceLabel(varietasName, sumberReferensi, manualOverride) {
  if (!varietasName) return null;
  const source = sumberReferensi || "Balitbangtan";
  if (manualOverride) {
    return `Standar ${varietasName} (${source}) · Diubah manual`;
  }
  return `Berdasarkan standar ${varietasName} (${source}) · Ubah manual`;
}
