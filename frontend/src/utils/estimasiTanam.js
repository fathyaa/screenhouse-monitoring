const DEFAULT_DURASI_PADI = 21;

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

export function resolveDurasiHari(durasiPembibitanHari, estimasi) {
  const d = Number(estimasi?.durasi_pembibitan_hari ?? durasiPembibitanHari);
  return Number.isFinite(d) && d >= 1 ? d : DEFAULT_DURASI_PADI;
}

/** Timeline pembibitan: hari ke-X, progress, countdown ke target. */
export function buildTimelineTracker(semaiRaw, durasiPembibitanHari, estimasi) {
  if (!parseValidDate(semaiRaw)) return null;

  const totalDays = resolveDurasiHari(durasiPembibitanHari, estimasi);
  const adjustment = Number(estimasi?.adjustment_hari) || 0;
  const cycleDays = totalDays + adjustment;
  const today = wibTodayStr();
  const elapsed = diffCalendarDays(semaiRaw, today) ?? 0;
  const hariKe = Math.max(1, elapsed === 0 ? 1 : elapsed);

  const targetStr =
    estimasi?.estimasi_siap && parseValidDate(estimasi.estimasi_siap)
      ? String(estimasi.estimasi_siap).slice(0, 10)
      : addCalendarDays(semaiRaw, cycleDays);

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

/** Estimasi dasar dari varietas (tanpa penyesuaian sensor). */
export function buildBaseEstimasi(tanggalSemai, durasiHari) {
  const durasi = resolveDurasiHari(durasiHari, null);
  if (!parseValidDate(tanggalSemai)) return null;

  const today = wibTodayStr();
  const estimasiSiap = addCalendarDays(tanggalSemai, durasi);
  if (!estimasiSiap) return null;

  const sisaHari = diffCalendarDays(today, estimasiSiap);
  const elapsed = diffCalendarDays(tanggalSemai, today);
  const progressPct =
    elapsed != null ? Math.min(100, Math.max(0, Math.round((elapsed / durasi) * 100))) : null;

  return {
    tanggal_semai: String(tanggalSemai).slice(0, 10),
    estimasi_siap: estimasiSiap,
    sisa_hari: sisaHari,
    progress_pct: progressPct,
    status: "on_track",
    adjustment_hari: 0,
    durasi_pembibitan_hari: durasi,
    sensor_adjusted: false,
  };
}

export function mergeEstimasiDisplay(estimasi, tanggalSemai, durasiPembibitanHari) {
  const semai = tanggalSemai ?? estimasi?.tanggal_semai;
  const durasi = estimasi?.durasi_pembibitan_hari ?? durasiPembibitanHari;

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

  const base = buildBaseEstimasi(semai, durasi);
  if (base) return base;

  return estimasi ?? null;
}

/** Timeline pembibitan siap pakai — dipakai komponen & halaman lain (mis. ringkasan dashboard). */
export function computeEstimasiTimeline(estimasi, tanggalSemai, durasiPembibitanHari) {
  const semaiRaw = tanggalSemai ?? estimasi?.tanggal_semai;
  const displayEstimasi = mergeEstimasiDisplay(estimasi, semaiRaw, durasiPembibitanHari);
  return buildTimelineTracker(semaiRaw, durasiPembibitanHari, displayEstimasi);
}
