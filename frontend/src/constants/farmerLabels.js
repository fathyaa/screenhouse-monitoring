/** Label ramah petani — hindari istilah teknis WSN/IoT di UI petani. */
export const FARMER_LABELS = {
  traySensor: "Rak bibit",
  traySensors: "Rak bibit",
  sensorDevice: "Alat pengukur",
  sensorDevices: "Alat pengukur",
  sinkControl: "Pusat kendali",
  offline: "Alat mati",
  offlineHint: "Alat pengukur tidak mengirim data",
  noData: "Belum ada data",
  noDataHint: "Pastikan alat sudah dinyalakan dan terhubung",
  rawSensorData: "Data teknis (lanjutan)",
  nodeCount: (n) => `${n} alat pengukur`,
};

export function whatsAppUrl(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  const normalized = digits.startsWith("62") ? digits : `62${digits.replace(/^0/, "")}`;
  return `https://wa.me/${normalized}`;
}

export function telUrl(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  return digits ? `tel:+${digits.startsWith("62") ? digits : `62${digits.replace(/^0/, "")}`}` : null;
}
