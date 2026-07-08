import { Sprout, Calendar, Clock } from "lucide-react";
import { StressScoreDetailCard, StressScoreCardBadge } from "./StressScoreDisplay";
import {
  formatSemaiDate,
  buildTimelineTracker,
  countdownTimelineText,
  mergeEstimasiDisplay,
} from "../utils/estimasiTanam";

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
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80 mb-2">
              <Calendar size={11} className="shrink-0" />
              Estimasi siap tanam
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
            <EstimasiTanamDisclaimer className="mt-2 pt-2 border-t border-gray-200/60" />
          </InlineSegment>

          {showStressScore && (
            <InlineSegment icon={Clock} title="Skor kondisi bibit" compact={compact}>
              <StressScoreDetailCard scoreData={stressScore} offline={deviceOffline} compact={compact} />
            </InlineSegment>
          )}
        </div>
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
          <EstimasiTanamDisclaimer className="mt-2 pt-2 border-t border-gray-200/60" />
        </InfoCard>

        {showStressScore && (
          <InfoCard icon={Clock} title="Skor kondisi bibit" compact={compact}>
            <StressScoreDetailCard scoreData={stressScore} offline={deviceOffline} />
          </InfoCard>
        )}
      </div>
    </section>
  );
}
