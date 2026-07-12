/** Parameter yang masuk perhitungan Skor Kondisi Bibit (0–100). */
const STRESS_SCORE_METRICS = [
  { key: "nitrogen", minCol: "min_nitrogen", maxCol: "max_nitrogen" },
  { key: "phosphorus", minCol: "min_phosphorus", maxCol: "max_phosphorus" },
  { key: "potassium", minCol: "min_potassium", maxCol: "max_potassium" },
  { key: "soil_moisture", minCol: "min_soil_moisture", maxCol: "max_soil_moisture" },
  { key: "soil_temperature", minCol: "min_soil_temperature", maxCol: "max_soil_temperature" },
  { key: "soil_ph", minCol: "min_soil_ph", maxCol: "max_soil_ph" },
];

const CATEGORY_BANDS = [
  { min: 85, key: "excellent", label: "Sangat baik", color: "#14532d" },
  { min: 70, key: "good", label: "Baik", color: "#16a34a" },
  { min: 50, key: "attention", label: "Perlu perhatian", color: "#ca8a04" },
  { min: 30, key: "suboptimal", label: "Tidak optimal", color: "#ea580c" },
  { min: 0, key: "critical", label: "Kritis", color: "#dc2626" },
];

function getCategory(score) {
  const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  for (const band of CATEGORY_BANDS) {
    if (s >= band.min) {
      return {
        category: band.label,
        category_key: band.key,
        color: band.color,
      };
    }
  }
  return {
    category: "Kritis",
    category_key: "critical",
    color: "#dc2626",
  };
}

function scoreParameter(value, min, max) {
  if (value == null || Number.isNaN(Number(value))) return 0;
  if (min == null || max == null || Number.isNaN(Number(min)) || Number.isNaN(Number(max))) {
    return 0;
  }

  const v = Number(value);
  const lo = Number(min);
  const hi = Number(max);
  const span = hi - lo;
  if (span <= 0) return 0;

  const nearMargin = span * 0.1;

  if (v >= lo && v <= hi) {
    if (v <= lo + nearMargin || v >= hi - nearMargin) return 70;
    return 100;
  }

  const overshoot = v < lo ? lo - v : v - hi;
  const overshootPct = overshoot / span;
  if (overshootPct <= 0.2) return 40;
  return 10;
}

function zeroParams() {
  return Object.fromEntries(STRESS_SCORE_METRICS.map((m) => [m.key, 0]));
}

function computeStressScore(reading, threshold, { offline = false } = {}) {
  if (offline || !reading) {
    return {
      score: 0,
      ...getCategory(0),
      params: zeroParams(),
    };
  }

  const params = {};
  const scores = [];

  for (const m of STRESS_SCORE_METRICS) {
    const min = threshold?.[m.minCol];
    const max = threshold?.[m.maxCol];
    if (min == null || max == null) {
      params[m.key] = 0;
      continue;
    }
    const pts = scoreParameter(reading[m.key], min, max);
    params[m.key] = pts;
    scores.push(pts);
  }

  const score = scores.length
    ? Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length)
    : 0;

  return {
    score,
    ...getCategory(score),
    params,
  };
}

function computeScreenhouseStressScore(nodeReadings, threshold, { offline = false } = {}) {
  if (offline || !nodeReadings?.length) {
    return {
      score: 0,
      ...getCategory(0),
      params: zeroParams(),
      nodes: [],
    };
  }

  const nodes = nodeReadings.map((row) => ({
    node_id: row.node_id,
    node_code: row.node_code,
    node_name: row.node_name,
    offline: Boolean(row.offline),
    ...computeStressScore(row.offline ? null : row, threshold, { offline: row.offline }),
  }));

  const activeNodes = nodes.filter((n) => !n.offline);
  if (!activeNodes.length) {
    return {
      score: 0,
      ...getCategory(0),
      params: zeroParams(),
      nodes,
    };
  }

  const score = Math.round(
    activeNodes.reduce((sum, n) => sum + n.score, 0) / activeNodes.length
  );

  const params = {};
  for (const m of STRESS_SCORE_METRICS) {
    const vals = activeNodes.map((n) => n.params[m.key]).filter((v) => v != null);
    params[m.key] = vals.length
      ? Math.round(vals.reduce((sum, n) => sum + n, 0) / vals.length)
      : 0;
  }

  return {
    score,
    ...getCategory(score),
    params,
    nodes,
  };
}

module.exports = {
  STRESS_SCORE_METRICS,
  CATEGORY_BANDS,
  getCategory,
  scoreParameter,
  computeStressScore,
  computeScreenhouseStressScore,
};
