// Jendela transplantasi bibit padi — sama untuk SEMUA varietas (lihat backend
// shared/estimasiTanam.js). HSS = hari setelah sebar, dihitung dari tanggal semai.
export const MULAI_SIAP_HSS = 15;
export const TARGET_OPTIMAL_HSS = 18;
export const BATAS_AKHIR_HSS = 21;

const DEFAULT_DURASI_PADI = BATAS_AKHIR_HSS;

export function parseValidDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function wibTodayStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

export function diffCalendarDays(fromStr, toStr) {
  const from = parseValidDate(fromStr);
  const to = parseValidDate(toStr);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function addCalendarDays(dateStr, days) {
  const d = parseValidDate(dateStr);
  if (!d || !Number.isFinite(Number(days))) return null;
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

export function formatSemaiDate(dateStr) {
  const d = parseValidDate(dateStr);
  if (!d) return null;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

export function formatEstimasiDate(dateStr) {
  const d = parseValidDate(dateStr);
  if (!d) return null;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

// Total jendela selalu batas akhir (21 HSS). Durasi per-varietas tidak lagi dipakai.
export function resolveDurasiHari() {
  return DEFAULT_DURASI_PADI;
}

/** Tiga titik jendela tanam (15/18/21 HSS) sebagai tanggal + label. */
export function buildWindow(semaiRaw) {
  if (!parseValidDate(semaiRaw)) return null;
  const point = (hss) => {
    const dateStr = addCalendarDays(semaiRaw, hss);
    return { hss, dateStr, label: formatEstimasiDate(dateStr) };
  };
  return {
    mulaiSiap: point(MULAI_SIAP_HSS),
    targetOptimal: point(TARGET_OPTIMAL_HSS),
    batasAkhir: point(BATAS_AKHIR_HSS),
  };
}

/** Fase jendela tanam + kalimat verdict awam untuk petani. */
export function buildWindowVerdict(semaiRaw, estimasi) {
  const window = buildWindow(semaiRaw);
  if (!window) return null;

  const today = wibTodayStr();
  const hss = diffCalendarDays(semaiRaw, today) ?? 0;
  const targetEfektifHss =
    Number(estimasi?.target_efektif_hss) || TARGET_OPTIMAL_HSS;

  let fase;
  if (hss < MULAI_SIAP_HSS) fase = "pembibitan";
  else if (hss < targetEfektifHss) fase = "siap";
  else if (hss <= BATAS_AKHIR_HSS) fase = "optimal";
  else fase = "terlalu_tua";

  const verdictByFase = {
    pembibitan: `Bibit belum cukup umur. Bisa mulai ditanam sekitar ${window.mulaiSiap.label}.`,
    siap: `Bibit sudah bisa ditanam. Paling bagus sekitar ${window.targetOptimal.label}.`,
    optimal: `Sekarang waktu paling bagus untuk menanam. Jangan lewat ${window.batasAkhir.label}.`,
    terlalu_tua: `Bibit sudah kelewat umur. Sebaiknya segera ditanam.`,
  };

  return { window, fase, hss, verdict: verdictByFase[fase] };
}

/** Timeline pembibitan: hari ke-X dari 21, progress, countdown ke target. */
export function buildTimelineTracker(semaiRaw, durasiPembibitanHari, estimasi) {
  if (!parseValidDate(semaiRaw)) return null;

  const cycleDays = DEFAULT_DURASI_PADI;
  const today = wibTodayStr();
  const elapsed = diffCalendarDays(semaiRaw, today) ?? 0;
  const hariKe = Math.max(1, elapsed === 0 ? 1 : elapsed);

  const targetStr =
    estimasi?.estimasi_siap && parseValidDate(estimasi.estimasi_siap)
      ? String(estimasi.estimasi_siap).slice(0, 10)
      : addCalendarDays(semaiRaw, TARGET_OPTIMAL_HSS);

  if (!targetStr) return null;

  const sisaHari = estimasi?.sisa_hari ?? diffCalendarDays(today, targetStr);
  const progressPct =
    estimasi?.progress_pct != null
      ? Math.min(100, Math.max(0, estimasi.progress_pct))
      : Math.min(100, Math.max(0, Math.round((hariKe / cycleDays) * 100)));

  return {
    hariKe,
    totalDays: cycleDays,
    sisaHari,
    progressPct,
    targetLabel: formatEstimasiDate(targetStr),
  };
}

export function countdownTimelineText(sisaHari, targetLabel) {
  if (sisaHari == null || !targetLabel) return null;
  if (sisaHari > 0) return `${sisaHari} Hari Lagi, ${targetLabel}`;
  if (sisaHari === 0) return `Estimasi Hari Ini, ${targetLabel}`;
  return `Lewat ${Math.abs(sisaHari)} Hari, ${targetLabel}`;
}

/** Countdown siap tampil jika ada tanggal target + sisa hari. */
export function hasCountdownData(estimasi) {
  if (!estimasi) return false;
  return Boolean(
    parseValidDate(estimasi.estimasi_siap) &&
      estimasi.sisa_hari != null &&
      estimasi.progress_pct != null
  );
}

/** Estimasi dasar tanpa penyesuaian sensor (target = 18 HSS, jendela 15–21). */
export function buildBaseEstimasi(tanggalSemai) {
  if (!parseValidDate(tanggalSemai)) return null;

  const today = wibTodayStr();
  const estimasiSiap = addCalendarDays(tanggalSemai, TARGET_OPTIMAL_HSS);
  if (!estimasiSiap) return null;

  const sisaHari = diffCalendarDays(today, estimasiSiap);
  const elapsed = diffCalendarDays(tanggalSemai, today);
  const progressPct =
    elapsed != null
      ? Math.min(100, Math.max(0, Math.round((elapsed / BATAS_AKHIR_HSS) * 100)))
      : null;

  return {
    tanggal_semai: String(tanggalSemai).slice(0, 10),
    estimasi_siap: estimasiSiap,
    sisa_hari: sisaHari,
    progress_pct: progressPct,
    status: "on_track",
    adjustment_hari: 0,
    target_efektif_hss: TARGET_OPTIMAL_HSS,
    durasi_pembibitan_hari: BATAS_AKHIR_HSS,
    sensor_adjusted: false,
  };
}

export function mergeEstimasiDisplay(estimasi, tanggalSemai) {
  const semai = tanggalSemai ?? estimasi?.tanggal_semai;

  if (estimasi && hasCountdownData(estimasi)) {
    return {
      ...estimasi,
      tanggal_semai: estimasi.tanggal_semai ?? semai,
      sensor_adjusted: Boolean(
        estimasi.adjustment_hari > 0 ||
          estimasi.avg_stress_score_7d != null ||
          (estimasi.alasan_adjustment?.length &&
            !estimasi.alasan_adjustment.every((a) =>
              String(a).includes("Tidak ada data skor")
            ))
      ),
    };
  }

  const base = buildBaseEstimasi(semai);
  if (base) return base;

  return estimasi ?? null;
}

/** Timeline pembibitan siap pakai — dipakai komponen & halaman lain (mis. ringkasan dashboard). */
export function computeEstimasiTimeline(estimasi, tanggalSemai, durasiPembibitanHari) {
  const semaiRaw = tanggalSemai ?? estimasi?.tanggal_semai;
  const displayEstimasi = mergeEstimasiDisplay(estimasi, semaiRaw);
  return buildTimelineTracker(semaiRaw, durasiPembibitanHari, displayEstimasi);
}
