import { ALERT_PARAM_MAP } from "./sensorMetrics";

// Evaluasi kesehatan parameter sensor terhadap zona ideal (threshold) +
// rekomendasi tindakan dalam bahasa petani. Dipakai di dashboard detail &
// dashboard petani supaya angka mentah berubah jadi verdict yang actionable.

// Metadata parameter: label ringkas + fungsi singkat agar petani paham konteksnya.
export const PARAM_META = {
  nitrogen: { label: "Nitrogen (N)", unit: "mg/kg", purpose: "Daun & pertumbuhan", minCol: "min_nitrogen", maxCol: "max_nitrogen" },
  phosphorus: { label: "Fosfor (P)", unit: "mg/kg", purpose: "Akar & bunga", minCol: "min_phosphorus", maxCol: "max_phosphorus" },
  potassium: { label: "Kalium (K)", unit: "mg/kg", purpose: "Buah & ketahanan", minCol: "min_potassium", maxCol: "max_potassium" },
  soil_moisture: { label: "Kelembapan tanah", unit: "%", purpose: "Kebutuhan air", minCol: "min_soil_moisture", maxCol: "max_soil_moisture" },
  soil_temperature: { label: "Suhu tanah", unit: "°C", purpose: "Kesehatan akar", minCol: "min_soil_temperature", maxCol: "max_soil_temperature" },
  soil_ph: { label: "pH tanah", unit: "", purpose: "Penyerapan hara", minCol: "min_soil_ph", maxCol: "max_soil_ph" },
  air_temperature: { label: "Suhu udara", unit: "°C", purpose: "Lingkungan", minCol: "min_air_temperature", maxCol: "max_air_temperature" },
  air_humidity: { label: "Kelembapan udara", unit: "%", purpose: "Penguapan", minCol: "min_air_humidity", maxCol: "max_air_humidity" },
};

// Parameter inti yang ditampilkan sebagai kartu verdict (urut prioritas tani).
export const HEALTH_PARAM_KEYS = [
  "soil_moisture",
  "nitrogen",
  "phosphorus",
  "potassium",
  "soil_ph",
  "soil_temperature",
  "air_temperature",
  "air_humidity",
];

export const STATUS_STYLE = {
  ideal: { label: "Pas", color: "#40916c", badge: "bg-bl-surface-muted text-bl-primary", track: "#74c69d" },
  low: { label: "Kurang", color: "#d97706", badge: "bg-amber-50 text-amber-700", track: "#fde68a" },
  high: { label: "Berlebih", color: "#dc2626", badge: "bg-red-50 text-red-700", track: "#fecaca" },
  unknown: { label: "Belum ada", color: "#94a3b8", badge: "bg-slate-100 text-slate-600", track: "#e2e8f0" },
};

// Rekomendasi tindakan per (parameter, arah penyimpangan).
const ADVICE = {
  soil_moisture: { low: "Segera siram atau aktifkan irigasi.", high: "Kurangi penyiraman, pastikan drainase lancar." },
  nitrogen: { low: "Tambah pupuk nitrogen (urea/ZA).", high: "Tunda pupuk N, risiko tumbuh daun berlebih." },
  phosphorus: { low: "Tambah pupuk fosfor (SP-36).", high: "Kurangi pupuk fosfor." },
  potassium: { low: "Tambah pupuk kalium (KCl).", high: "Kurangi pupuk kalium." },
  soil_ph: { low: "Tanah terlalu asam, beri kapur dolomit.", high: "Tanah terlalu basa, beri belerang/pupuk asam." },
  soil_temperature: { low: "Kurangi naungan agar tanah lebih hangat.", high: "Tambah naungan / siram untuk mendinginkan tanah." },
  air_temperature: { low: "Tutup ventilasi, jaga kehangatan (terutama malam).", high: "Buka ventilasi atau nyalakan kipas." },
  air_humidity: { low: "Naikkan kelembapan (pengabutan / siram lantai).", high: "Tingkatkan sirkulasi udara untuk cegah jamur." },
};

export function evaluateParam(key, value, threshold) {
  const meta = PARAM_META[key];
  const min = threshold?.[meta?.minCol];
  const max = threshold?.[meta?.maxCol];
  const num = value == null || value === "" ? null : Number(value);

  if (num == null || Number.isNaN(num) || min == null || max == null) {
    return { status: "unknown", value: num, min: min ?? null, max: max ?? null };
  }
  if (num < Number(min)) return { status: "low", value: num, min: Number(min), max: Number(max) };
  if (num > Number(max)) return { status: "high", value: num, min: Number(min), max: Number(max) };
  return { status: "ideal", value: num, min: Number(min), max: Number(max) };
}

// Posisi marker + lebar zona ideal (dalam persen 0–100) untuk bar visual.
// pH dipetakan ke skala tetap 0–14; parameter lain pakai rentang + bantalan.
export function markerPosition(key, value, min, max) {
  if (value == null || min == null || max == null) return null;
  const isPh = key === "soil_ph";
  const span = Math.max(max - min, 1);
  const lo = isPh ? 0 : min - span * 0.6;
  const hi = isPh ? 14 : max + span * 0.6;
  const range = hi - lo || 1;
  const idealStart = Math.max(0, ((min - lo) / range) * 100);
  const idealEnd = Math.min(100, ((max - lo) / range) * 100);
  return {
    pos: Math.min(100, Math.max(0, ((value - lo) / range) * 100)),
    idealStart,
    idealWidth: Math.max(0, idealEnd - idealStart),
  };
}

export function buildHealthList(latest, threshold, keys = HEALTH_PARAM_KEYS) {
  if (!latest) return [];
  return keys
    .filter((key) => PARAM_META[key])
    .map((key) => {
      const meta = PARAM_META[key];
      const evals = evaluateParam(key, latest[key], threshold);
      const style = STATUS_STYLE[evals.status];
      const advice =
        evals.status === "low" || evals.status === "high"
          ? ADVICE[key]?.[evals.status] ?? null
          : null;
      return { key, ...meta, ...evals, style, advice };
    });
}

// Daftar tindakan (hanya parameter yang menyimpang), urut: Berlebih dulu lalu Kurang.
export function getActions(healthList) {
  return healthList
    .filter((h) => h.advice)
    .sort((a, b) => (a.status === "high" ? -1 : 1) - (b.status === "high" ? -1 : 1));
}

// Tingkat keparahan untuk membandingkan kondisi antar node.
const STATUS_RANK = { high: 3, low: 2, ideal: 1, unknown: 0 };

/**
 * Roll-up kondisi terburuk antar node dalam satu screenhouse.
 * Untuk tiap parameter, ambil node dengan verdict paling parah (Berlebih > Kurang
 * > Ideal). Jadi kalau satu node bermasalah, screenhouse ikut ditandai.
 * `nodes` = array dengan field `latest_data` & `node_name`.
 */
export function buildWorstCaseHealth(nodes, threshold, keys = HEALTH_PARAM_KEYS) {
  const valid = (nodes || []).filter((n) => n && n.latest_data);
  if (!valid.length) return [];

  return keys
    .filter((key) => PARAM_META[key])
    .map((key) => {
      const meta = PARAM_META[key];
      let worst = null;
      for (const node of valid) {
        const evals = evaluateParam(key, node.latest_data[key], threshold);
        if (
          !worst ||
          STATUS_RANK[evals.status] > STATUS_RANK[worst.evals.status]
        ) {
          worst = { evals, node };
        }
      }
      if (!worst) return null;

      const style = STATUS_STYLE[worst.evals.status];
      const advice =
        worst.evals.status === "low" || worst.evals.status === "high"
          ? ADVICE[key]?.[worst.evals.status] ?? null
          : null;

      return {
        key,
        ...meta,
        ...worst.evals,
        style,
        advice,
        nodeName: worst.node.node_name,
        multiNode: valid.length > 1,
      };
    })
    .filter(Boolean);
}

/** Saran tindakan dari pesan peringatan sistem (alerts API). */
export function getAdviceForAlert(alert) {
  const lower = alert?.message?.toLowerCase() ?? "";
  if (lower.includes("tidak mengirim data sensor")) {
    return "Periksa daya ESP/node, jarak ke gateway, atau koneksi jaringan WSN.";
  }
  const row = ALERT_PARAM_MAP.find((r) => lower.includes(r.match));
  if (!row) return null;
  const status = lower.includes("maksimum") ? "high" : lower.includes("minimum") ? "low" : null;
  if (!status) return null;
  return ADVICE[row.param]?.[status] ?? null;
}

export function isAlertCritical(alert) {
  return alert?.message?.toLowerCase().includes("maksimum") ?? false;
}
