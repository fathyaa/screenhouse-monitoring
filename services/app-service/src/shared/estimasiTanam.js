const { computeScreenhouseStressScore } = require("./stressScore");

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

function computeEstimasiTanam({
  tanggalSemai,
  durasiPembibitanHari,
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
      adjustment_hari: 0,
      alasan_adjustment: ["Tanggal semai belum diisi"],
      durasi_pembibitan_hari: durasiPembibitanHari ?? null,
    };
  }

  const durasi = Number(durasiPembibitanHari);
  if (!durasi || durasi < 1) {
    return {
      tanggal_semai: tanggalSemai,
      estimasi_siap: null,
      sisa_hari: null,
      progress_pct: null,
      status: null,
      adjustment_hari: 0,
      alasan_adjustment: ["Durasi pembibitan varietas belum tersedia"],
      durasi_pembibitan_hari: durasiPembibitanHari ?? null,
    };
  }

  const baseSiap = addCalendarDays(tanggalSemai, durasi);
  const stressAdj = stressAdjustment(avgStressScore7d);
  const offAdj = offlineAdjustment(offlineDays7d ?? 0);
  const adjustmentHari = stressAdj.days + offAdj.days;
  const alasan = [...stressAdj.alasan, ...offAdj.alasan];

  let status = stressAdj.status;
  if (status !== "perlu_evaluasi" && adjustmentHari > 0) {
    status = "terlambat";
  }
  if (status === "on_track" && adjustmentHari === 0) {
    status = "on_track";
  }

  const estimasiSiap = addCalendarDays(baseSiap, adjustmentHari);
  const sisaHari = diffCalendarDays(todayStr, estimasiSiap);
  const totalHari = durasi + adjustmentHari;
  const elapsed = diffCalendarDays(tanggalSemai, todayStr);
  const progressPct =
    totalHari > 0 && elapsed != null
      ? Math.min(100, Math.max(0, Math.round((elapsed / totalHari) * 100)))
      : null;

  return {
    tanggal_semai: tanggalSemai,
    estimasi_siap: estimasiSiap,
    sisa_hari: sisaHari,
    progress_pct: progressPct,
    status,
    adjustment_hari: adjustmentHari,
    alasan_adjustment: alasan,
    durasi_pembibitan_hari: durasi,
    avg_stress_score_7d: avgStressScore7d != null ? Math.round(avgStressScore7d) : null,
    offline_days_7d: offlineDays7d ?? 0,
  };
}

function addCalendarDays(dateStr, days) {
  const d = parseDateOnly(dateStr);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + Number(days));
  return wibDateStr(d);
}

module.exports = {
  wibDateStr,
  lastNDaysWib,
  computeDailyStressScores,
  average,
  computeEstimasiTanam,
  addCalendarDays,
};
