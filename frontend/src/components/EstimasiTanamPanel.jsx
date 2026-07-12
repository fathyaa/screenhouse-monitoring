import { Sprout, Calendar, Clock } from "lucide-react";
import { StressScoreDetailCard, StressScoreCardBadge } from "./StressScoreDisplay";

function parseValidDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function wibTodayStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function diffCalendarDays(fromStr, toStr) {
  const from = parseValidDate(fromStr);
  const to = parseValidDate(toStr);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function addCalendarDays(dateStr, days) {
  const d = parseValidDate(dateStr);
  if (!d || !Number.isFinite(Number(days))) return null;
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function formatSemaiDate(dateStr) {
  const d = parseValidDate(dateStr);
  if (!d) return null;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function formatEstimasiDate(dateStr) {
  const d = parseValidDate(dateStr);
  if (!d) return null;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

const DEFAULT_DURASI_PADI = 21;

function resolveDurasiHari(durasiPembibitanHari, estimasi) {
  const d = Number(estimasi?.durasi_pembibitan_hari ?? durasiPembibitanHari);
  return Number.isFinite(d) && d >= 1 ? d : DEFAULT_DURASI_PADI;
}

/** Timeline pembibitan: hari ke-X, progress, countdown ke target. */
function buildTimelineTracker(semaiRaw, durasiPembibitanHari, estimasi) {
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

function countdownTimelineText(sisaHari, targetLabel) {
  if (sisaHari == null || !targetLabel) return null;
  if (sisaHari > 0) return `${sisaHari} Hari Lagi, ${targetLabel}`;
  if (sisaHari === 0) return `Estimasi Hari Ini, ${targetLabel}`;
  return `Lewat ${Math.abs(sisaHari)} Hari, ${targetLabel}`;
}

/** Countdown siap tampil jika ada tanggal target + sisa hari. */
function hasCountdownData(estimasi) {
  if (!estimasi) return false;
  return Boolean(
    parseValidDate(estimasi.estimasi_siap) &&
      estimasi.sisa_hari != null &&
      estimasi.progress_pct != null
  );
}

/** Estimasi dasar dari varietas (tanpa penyesuaian sensor). */
function buildBaseEstimasi(tanggalSemai, durasiHari) {
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

function mergeEstimasiDisplay(estimasi, tanggalSemai, durasiPembibitanHari) {
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

export function EstimasiTanamDisclaimer({ className = "" }) {
  return (
    <p className={`text-[10px] text-gray-600 leading-relaxed ${className}`}>
      Estimasi berdasarkan data sensor dan standar varietas. 
    </p>
  );
}

function InfoCard({ icon: Icon, title, children, className = "", compact = false }) {
  return (
    <div
      className={`flex flex-col rounded-xl bg-white border border-gray-200/80 ${
        compact ? "p-3" : "p-4"
      } ${className}`}
    >
      <div
        className={`flex items-center gap-2 font-semibold uppercase tracking-wide text-gray-600 mb-2 ${
          compact ? "text-[10px]" : "text-[11px]"
        }`}
      >
        {Icon && <Icon size={compact ? 12 : 14} className="shrink-0 text-gray-500" />}
        {title}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function InlineSegment({ icon: Icon, title, children, compact = false }) {
  return (
    <div className="w-full lg:flex-1 lg:min-w-0 py-3 first:pt-0 last:pb-0 border-b border-gray-200/80 last:border-b-0 lg:border-b-0 lg:py-0 lg:px-4 lg:first:pl-0 lg:last:pr-0">
      <div
        className={`flex items-center gap-1.5 font-semibold uppercase tracking-wide text-gray-500 mb-1.5 ${
          compact ? "text-[9px]" : "text-[10px]"
        }`}
      >
        {Icon && <Icon size={11} className="shrink-0" />}
        {title}
      </div>
      {children}
    </div>
  );
}

export default function EstimasiTanamPanel({
  estimasi,
  stressScore,
  varietasNama,
  tanggalSemai,
  durasiPembibitanHari,
  deviceOffline = false,
  compact = false,
  showStressScore = true,
  layout = "grid",
  estimasiFooter = null,
  varietasFooter = null,
}) {
  const semaiRaw = tanggalSemai ?? estimasi?.tanggal_semai;
  const semaiLabel = formatSemaiDate(semaiRaw);
  const varietas = varietasNama || estimasi?.varietas_nama;

  const displayEstimasi = mergeEstimasiDisplay(estimasi, semaiRaw, durasiPembibitanHari);
  const timeline = buildTimelineTracker(semaiRaw, durasiPembibitanHari, displayEstimasi);

  if (!displayEstimasi && !varietas && !semaiRaw) {
    return (
      <div className="rounded-xl bg-slate-50 border border-dashed border-gray-200 px-4 py-4 text-sm text-gray-600 text-center">
        Data pembibitan belum tersedia. Mulai siklus semai untuk melihat estimasi.
      </div>
    );
  }

  const timelineBlock = timeline ? (
    <>
      <p className={`font-semibold text-gray-800 leading-tight ${compact ? "text-xs" : "text-sm"}`}>
        Hari ke-{timeline.hariKe} dari {timeline.totalDays} Hari
      </p>
      <div className="mt-1.5">
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-500"
            style={{ width: `${timeline.progressPct}%` }}
          />
        </div>
      </div>
      {countdownTimelineText(timeline.sisaHari, timeline.targetLabel) && (
        <p className={`text-gray-700 leading-snug mt-1.5 break-words ${compact ? "text-[11px]" : "text-xs"}`}>
          {countdownTimelineText(timeline.sisaHari, timeline.targetLabel)}
        </p>
      )}
      {estimasiFooter}
    </>
  ) : (
    <>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Mulai siklus semai untuk melihat timeline.
      </p>
      {estimasiFooter}
    </>
  );

  if (layout === "dashboard") {
    return (
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              <Sprout size={11} className="shrink-0 text-emerald-600" />
              Varietas
            </div>
            {varietas ? (
              <p className="text-base font-bold text-gray-900 leading-tight break-words">{varietas}</p>
            ) : (
              <p className="text-sm text-gray-500">Belum dipilih</p>
            )}
            <p className="text-xs text-gray-600 mt-0.5">
              Semai{" "}
              <span className="font-medium text-gray-800">{semaiLabel ?? "belum mulai"}</span>
            </p>
            {varietasFooter}
          </div>

          {showStressScore && (
            <div className="shrink-0">
              <StressScoreCardBadge
                scoreData={stressScore}
                offline={deviceOffline}
                compact
              />
            </div>
          )}
        </div>

        {timeline ? (
          <div className="rounded-xl bg-gradient-to-br from-emerald-50/90 via-white to-white border border-emerald-100 p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80">
                <Calendar size={11} className="shrink-0" />
                Estimasi siap tanam
              </div>
              <span className="text-xs font-bold text-emerald-800 tabular-nums">
                {timeline.progressPct}%
              </span>
            </div>

            <div className="h-2 rounded-full bg-white border border-emerald-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${timeline.progressPct}%` }}
              />
            </div>

            <div className="flex items-end justify-between gap-3 mt-2.5">
              <div>
                <p className="text-lg font-bold text-gray-900 leading-none tabular-nums">
                  Hari {timeline.hariKe}
                  <span className="text-sm font-medium text-gray-500"> / {timeline.totalDays}</span>
                </p>
              </div>
              {countdownTimelineText(timeline.sisaHari, timeline.targetLabel) && (
                <p className="text-[11px] text-gray-600 text-right leading-snug max-w-[55%]">
                  {countdownTimelineText(timeline.sisaHari, timeline.targetLabel)}
                </p>
              )}
            </div>
            {estimasiFooter}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-3 py-2.5 text-[11px] text-gray-600">
            Mulai siklus semai untuk melihat timeline pembibitan.
            {estimasiFooter}
          </div>
        )}
      </section>
    );
  }

  if (layout === "inline") {
    return (
      <section className={`rounded-xl bg-slate-50/90 border border-gray-200/60 ${compact ? "p-3" : "p-4"}`}>
        <div className="flex flex-col lg:flex-row lg:divide-x divide-gray-200/80">
          <InlineSegment icon={Sprout} title="Varietas & semai" compact={compact}>
            {varietas ? (
              <p className={`font-semibold text-gray-800 break-words ${compact ? "text-sm" : "text-base"}`}>
                {varietas}
              </p>
            ) : (
              <p className="text-xs text-gray-500">Belum dipilih</p>
            )}
            <p className="text-[11px] text-gray-600 mt-0.5 break-words">
              Semai:{" "}
              <span className="font-medium text-gray-700">
                {semaiLabel ?? "Belum mulai"}
              </span>
            </p>
            {varietasFooter}
          </InlineSegment>

          <InlineSegment icon={Calendar} title="Estimasi siap tanam" compact={compact}>
            {timelineBlock}
          </InlineSegment>

          {showStressScore && (
            <InlineSegment icon={Clock} title="Skor kondisi bibit" compact={compact}>
              <StressScoreDetailCard scoreData={stressScore} offline={deviceOffline} compact={compact} />
            </InlineSegment>
          )}
        </div>
        <EstimasiTanamDisclaimer className="mt-3 pt-3 border-t border-gray-200/60" />
      </section>
    );
  }

  return (
    <section className={`rounded-2xl bg-slate-50/90 ${compact ? "p-3 space-y-2" : "p-4 sm:p-5 space-y-4"}`}>
      <div className={`grid grid-cols-1 md:grid-cols-3 ${compact ? "gap-2" : "gap-3"}`}>
        <InfoCard icon={Sprout} title="Varietas & semai" compact={compact}>
          {varietas ? (
            <p className={`font-semibold text-gray-800 break-words ${compact ? "text-sm" : "text-base"}`}>
              {varietas}
            </p>
          ) : (
            <p className="text-sm text-gray-500">Varietas belum dipilih</p>
          )}
          <p className={`text-gray-600 mt-1 break-words ${compact ? "text-[11px]" : "text-xs mt-1.5"}`}>
            Semai:{" "}
            <span className="font-medium text-gray-700">
              {semaiLabel ?? "Belum mulai siklus"}
            </span>
          </p>
          {varietasFooter}
        </InfoCard>

        <InfoCard icon={Calendar} title="Estimasi siap tanam" compact={compact}>
          {timeline ? (
            timelineBlock
          ) : (
            <>
              <p className="text-xs text-gray-500 leading-relaxed">
                Mulai siklus semai untuk melihat timeline pembibitan.
              </p>
              {estimasiFooter}
            </>
          )}
        </InfoCard>

        {showStressScore && (
          <InfoCard icon={Clock} title="Skor kondisi bibit" compact={compact}>
            <StressScoreDetailCard scoreData={stressScore} offline={deviceOffline} />
          </InfoCard>
        )}
      </div>

      {!compact && <EstimasiTanamDisclaimer className="pt-1 border-t border-gray-200/60" />}
      {compact && <EstimasiTanamDisclaimer />}
    </section>
  );
}
