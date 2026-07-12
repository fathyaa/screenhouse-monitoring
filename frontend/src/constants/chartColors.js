/**
 * Palet warna chart terpusat — selaras dengan token bl-* di index.css (@theme).
 * Recharts butuh nilai warna konkret (bukan kelas Tailwind), jadi nilai token
 * hijau brand di-mirror di sini. Semua chart mengimpor dari sini supaya tidak
 * ada lagi hex yang tersebar & tak konsisten.
 */

// Token brand (mirror dari --color-bl-* di index.css)
export const BL = {
  primary: "#40916c",
  primaryHover: "#2d6a4f",
  accent: "#52b788",
  mint: "#74c69d",
  live: "#e63946",
};

// Status terhadap ambang aman
export const CHART_STATUS = {
  below: "#d97706", // di bawah minimum (kurang) — amber
  normal: "#16a34a", // dalam zona aman — hijau
  above: "#dc2626", // di atas maksimum (berlebih) — merah
  neutral: "#94a3b8", // tak ada data / di luar konteks
};

// Zona ambang (ReferenceArea) — shade lembut untuk area kurang/optimal/berlebih
export const CHART_ZONE = {
  below: "#fecaca", // kurang (di bawah minimum)
  optimal: "#bbf7d0", // zona aman
  above: "#fef08a", // berlebih (di atas maksimum)
};

// Warna garis per parameter (small-multiples & tren).
// Nilai mempertahankan warna chart yang sudah dipakai supaya migrasi tidak
// mengubah tampilan; token brand BL.* tersedia di atas untuk elemen ber-brand.
export const PARAM_COLORS = {
  nitrogen: "#16a34a",
  soil_moisture: "#2563eb",
  phosphorus: "#2563eb",
  potassium: "#ca8a04",
  soil_temperature: "#ea580c",
  soil_ph: "#7c3aed",
  conductivity: "#0891b2",
  air_temperature: "#dc2626",
  air_humidity: "#2563eb",
  light_intensity: "#d97706",
};

// Palet kategorikal (mis. distribusi varietas) — dipakai berurutan per kategori.
export const CATEGORICAL_PALETTE = [
  "#16a34a", "#2563eb", "#ca8a04", "#9333ea",
  "#0891b2", "#64748b", "#dc2626", "#7c3aed",
];

// Netral bersama
export const CHART_GRID = "#f0f0f0";
export const CHART_AXIS = "#4b5563";
export const CHART_REFLINE = "#9ca3af";
