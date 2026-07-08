/** Istilah ramah pengguna di seluruh UI — hindari jargon teknis WSN/IoT. */
export const FARMER_LABELS = {
  seedTray: "Rak bibit",
  seedTrays: "Rak bibit",
  traySensor: "Rak bibit",
  traySensors: "Rak bibit",
  sensorDevice: "Alat pengukur",
  sensorDevices: "Alat pengukur",
  sinkControl: "Pusat kendali",
  connected: "Terhubung",
  notConnected: "Tidak terhubung",
  offline: "Alat mati",
  offlineHint: "Alat pengukur tidak mengirim data",
  noData: "Belum ada data",
  noDataHint: "Pastikan alat sudah dinyalakan dan terhubung",
  rawSensorData: "Data teknis (lanjutan)",
  nodeCount: (n) => `${n} alat pengukur`,
  phoneNotifications: "Notifikasi",
  lastSavedData: "Data terakhir tersimpan",
  lastReading: "Pembacaan terakhir",
  safeLimit: "Batas aman",
  manageSafeLimits: "Kelola batas aman",
  autoEquipment: "Peralatan otomatis",
  autoEquipmentControl: "Kontrol peralatan",
  autoEquipmentStatus: "Status peralatan",
  refresh: "Perbarui",
  pullToRefresh: "Tarik untuk perbarui",
  releaseToRefresh: "Lepas untuk perbarui",
  refreshing: "Memperbarui...",
  formatRange: (min, max, unit = "") => {
    const suffix = unit && unit !== "%" && unit !== "°C" ? ` ${unit}` : unit || "";
    return `${min}–${max}${suffix}`;
  },
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
