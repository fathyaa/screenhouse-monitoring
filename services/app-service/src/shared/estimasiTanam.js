const { computeScreenhouseStressScore } = require("./stressScore");

// Jendela transplantasi bibit padi — SAMA untuk semua varietas (bukan per-varietas).
// Bibit padi dipindah-tanam pada 15–21 HSS (hari setelah sebar) terlepas dari varietas;
// angka durasi_pembibitan_hari per-varietas (22–28) mengacaukan durasi tanaman utuh
// dengan durasi persemaian, jadi tidak lagi dipakai untuk estimasi.
//   - MULAI_SIAP  (15 HSS): bibit sudah boleh ditanam (panduan PTT, bibit muda 10–15 hari).
//   - TARGET      (18 HSS): titik tengah rentang 14–21, target praktis-konservatif.
//   - BATAS_AKHIR (21 HSS): lewat ini bibit terlalu tua (rekomendasi umum padi sawah).
const MULAI_SIAP_HSS = 15;
const TARGET_OPTIMAL_HSS = 18;
const BATAS_AKHIR_HSS = 21;

function wibDateStr(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(date);
}

function parseDateOnly(str) {
  if (!str) return null;
  const d = new Date(`${String(str).slice(0, 10)}T12:00:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addCalendarDays(dateStr, days) {
  const d = parseDateOnly(dateStr);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + Number(days));
  return wibDateStr(d);
}

function diffCalendarDays(fromStr, toStr) {
  const from = parseDateOnly(fromStr);
  const to = parseDateOnly(toStr);
  if (!from || !to) return null;
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / 86400000);
}

function lastNDaysWib(n) {
  const days = [];
  const anchor = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(anchor);
    d.setDate(d.getDate() - i);
    days.push(wibDateStr(d));
  }
  return days;
}

function stressAdjustment(avgScore) {
  if (avgScore == null || Number.isNaN(avgScore)) {
    return {
      days: 7,
      status: "perlu_evaluasi",
      alasan: ["Tidak ada data skor kondisi 7 hari terakhir"],
    };
  }
  const s = Math.round(avgScore);
  if (s >= 85) {
    return { days: 0, status: "on_track", alasan: [] };
  }
  if (s >= 70) {
    return {
      days: 1,
      status: "terlambat",
      alasan: [`Skor kondisi rata-rata ${s} (70–84): +1 hari`],
    };
  }
  if (s >= 50) {
    return {
      days: 3,
      status: "terlambat",
      alasan: [`Skor kondisi rata-rata ${s} (50–69): +3 hari`],
    };
  }
  return {
    days: 7,
    status: "perlu_evaluasi",
    alasan: [`Skor kondisi rata-rata ${s} (<50): +7 hari, perlu evaluasi`],
  };
}

function offlineAdjustment(offlineDays) {
  const days = Math.floor(Number(offlineDays) / 2);
  if (days <= 0) return { days: 0, alasan: [] };
  return {
    days,
    alasan: [`Sensor offline ${offlineDays} hari (7 hari terakhir): +${days} hari`],
  };
}

function computeDailyStressScores(dailyNodeRows, threshold) {
  const byDay = new Map();
  for (const row of dailyNodeRows) {
    const day = String(row.day).slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(row);
  }

  const dailyScores = [];
  for (const [, nodes] of byDay) {
    const nodeReadings = nodes.map((n) => ({
      node_id: n.node_id,
      node_code: n.node_code,
      node_name: n.node_name,
      nitrogen: n.nitrogen,
      phosphorus: n.phosphorus,
      potassium: n.potassium,
      soil_moisture: n.soil_moisture,
      soil_temperature: n.soil_temperature,
      soil_ph: n.soil_ph,
      offline: false,
    }));
    const result = computeScreenhouseStressScore(nodeReadings, threshold);
    if (result.score != null) dailyScores.push(result.score);
  }
  return dailyScores;
}

function average(nums) {
  if (!nums.length) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

// Jendela tetap 15/18/21 HSS untuk semua varietas. Bukan lagi turunan
// durasi_pembibitan_hari per-varietas (parameter itu diterima demi kompatibilitas
// pemanggil lama, tapi tidak dipakai untuk menghitung tanggal).
function buildWindow(tanggalSemai) {
  return {
    mulai_siap: addCalendarDays(tanggalSemai, MULAI_SIAP_HSS),
    mulai_siap_hss: MULAI_SIAP_HSS,
    target_optimal: addCalendarDays(tanggalSemai, TARGET_OPTIMAL_HSS),
    target_optimal_hss: TARGET_OPTIMAL_HSS,
    batas_akhir: addCalendarDays(tanggalSemai, BATAS_AKHIR_HSS),
    batas_akhir_hss: BATAS_AKHIR_HSS,
  };
}

function computeEstimasiTanam({
  tanggalSemai,
  avgStressScore7d,
  offlineDays7d,
  todayStr = wibDateStr(),
}) {
  if (!tanggalSemai) {
    return {
      tanggal_semai: null,
      estimasi_siap: null,
      sisa_hari: null,
      progress_pct: null,
      status: null,
      fase: null,
      hss_hari_ini: null,
      adjustment_hari: 0,
      alasan_adjustment: ["Tanggal semai belum diisi"],
      durasi_pembibitan_hari: BATAS_AKHIR_HSS,
      window: null,
    };
  }

  const stressAdj = stressAdjustment(avgStressScore7d);
  const offAdj = offlineAdjustment(offlineDays7d ?? 0);
  const adjustmentHari = stressAdj.days + offAdj.days;
  const alasan = [...stressAdj.alasan, ...offAdj.alasan];

  // Kondisi kurang baik menggeser target dari 18 HSS ke belakang, tapi tidak pernah
  // melewati batas akhir 21 HSS (batas biologis "bibit terlalu tua").
  const targetHssEfektif = Math.min(TARGET_OPTIMAL_HSS + adjustmentHari, BATAS_AKHIR_HSS);
  const estimasiSiap = addCalendarDays(tanggalSemai, targetHssEfektif);
  const sisaHari = diffCalendarDays(todayStr, estimasiSiap);
  const elapsed = diffCalendarDays(tanggalSemai, todayStr);
  const progressPct =
    elapsed != null
      ? Math.min(100, Math.max(0, Math.round((elapsed / BATAS_AKHIR_HSS) * 100)))
      : null;

  // Fase jendela tanam untuk verdict di UI (terpisah dari `status` yang dipakai laporan).
  let fase;
  if (elapsed == null) fase = null;
  else if (elapsed < MULAI_SIAP_HSS) fase = "pembibitan";
  else if (elapsed < targetHssEfektif) fase = "siap";
  else if (elapsed <= BATAS_AKHIR_HSS) fase = "optimal";
  else fase = "terlalu_tua";

  // `status` mempertahankan kosakata lama (on_track/terlambat/perlu_evaluasi) yang
  // dikonsumsi laporan operator. Bibit yang lewat batas akhir dihitung "terlambat".
  let status = stressAdj.status;
  if (status !== "perlu_evaluasi" && (adjustmentHari > 0 || fase === "terlalu_tua")) {
    status = "terlambat";
  }

  return {
    tanggal_semai: tanggalSemai,
    estimasi_siap: estimasiSiap,
    sisa_hari: sisaHari,
    progress_pct: progressPct,
    status,
    fase,
    hss_hari_ini: elapsed,
    adjustment_hari: adjustmentHari,
    alasan_adjustment: alasan,
    target_efektif_hss: targetHssEfektif,
    durasi_pembibitan_hari: BATAS_AKHIR_HSS,
    window: buildWindow(tanggalSemai),
    avg_stress_score_7d: avgStressScore7d != null ? Math.round(avgStressScore7d) : null,
    offline_days_7d: offlineDays7d ?? 0,
  };
}

module.exports = {
  MULAI_SIAP_HSS,
  TARGET_OPTIMAL_HSS,
  BATAS_AKHIR_HSS,
  wibDateStr,
  lastNDaysWib,
  computeDailyStressScores,
  average,
  computeEstimasiTanam,
  addCalendarDays,
};
