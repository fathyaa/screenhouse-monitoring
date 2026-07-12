/** Gaya UI kategori Skor Kondisi Bibit — selaras backend CATEGORY_BANDS. */
export const STRESS_SCORE_CATEGORIES = {
  excellent: {
    label: "Sangat baik",
    color: "#14532d",
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-900",
    badge: "bg-green-100 text-green-900",
  },
  good: {
    label: "Baik",
    color: "#16a34a",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-900",
    badge: "bg-emerald-100 text-emerald-800",
  },
  attention: {
    label: "Perlu perhatian",
    color: "#ca8a04",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    badge: "bg-amber-100 text-amber-800",
  },
  suboptimal: {
    label: "Tidak optimal",
    color: "#ea580c",
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-900",
    badge: "bg-orange-100 text-orange-800",
  },
  critical: {
    label: "Kritis",
    color: "#dc2626",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-900",
    badge: "bg-red-100 text-red-800",
  },
};

export function getStressScoreStyle(scoreData) {
  if (!scoreData) {
    return STRESS_SCORE_CATEGORIES.critical;
  }
  const key = scoreData.category_key ?? categoryKeyFromScore(scoreData.score);
  return STRESS_SCORE_CATEGORIES[key] ?? STRESS_SCORE_CATEGORIES.critical;
}

export function categoryKeyFromScore(score) {
  const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  if (s >= 85) return "excellent";
  if (s >= 70) return "good";
  if (s >= 50) return "attention";
  if (s >= 30) return "suboptimal";
  return "critical";
}

export function categoryLabelFromScore(score) {
  return getStressScoreStyle({ score, category_key: categoryKeyFromScore(score) }).label
    ?? STRESS_SCORE_CATEGORIES.critical.label;
}
