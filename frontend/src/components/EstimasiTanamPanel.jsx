import { useState } from "react";
import { Sprout, Calendar, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { StressScoreDetailCard, StressScoreCardBadge } from "./StressScoreDisplay";
import {
  formatSemaiDate,
  buildTimelineTracker,
  buildWindowVerdict,
  mergeEstimasiDisplay,
  MULAI_SIAP_HSS,
  TARGET_OPTIMAL_HSS,
  BATAS_AKHIR_HSS,
} from "../utils/estimasiTanam";

const FASE_STYLE = {
  pembibitan: {
    Icon: Sprout,
    tone: "text-slate-600",
    badgeBg: "bg-slate-100 text-slate-700",
    bar: "bg-slate-400",
    label: "Belum siap",
  },
  siap: {
    Icon: CheckCircle2,
    tone: "text-emerald-700",
    badgeBg: "bg-emerald-100 text-emerald-800",
    bar: "bg-emerald-500",
    label: "Siap tanam",
  },
  optimal: {
    Icon: CheckCircle2,
    tone: "text-emerald-700",
    badgeBg: "bg-emerald-600 text-white",
    bar: "bg-emerald-600",
    label: "Waktu ideal",
  },
  terlalu_tua: {
    Icon: AlertTriangle,
    tone: "text-red-700",
    badgeBg: "bg-red-100 text-red-800",
    bar: "bg-red-500",
    label: "Terlalu tua",
  },
};

/**
 * Verdict awam + garis waktu sederhana. Tiga titik (bibit umur 15/18/21 hari)
 * disembunyikan; ketuk salah satu titik pada garis untuk memunculkan tanggalnya.
 */
function WindowTimeline({ verdict, timeline, compact = false, footer = null }) {
  const [aktif, setAktif] = useState(null);

  if (!verdict) {
    return (
      <>
        <p className="text-xs text-gray-500 leading-relaxed">
          Mulai siklus semai untuk melihat perkiraan waktu tanam.
        </p>
        {footer}
      </>
    );
  }

  const { window, fase } = verdict;
  const style = FASE_STYLE[fase] ?? FASE_STYLE.pembibitan;
  const { Icon } = style;
  const progressPct = timeline?.progressPct ?? 0;

  const titik = [
    {
      key: "mulaiSiap",
      pos: (MULAI_SIAP_HSS / BATAS_AKHIR_HSS) * 100,
      judul: "Sudah bisa ditanam",
      data: window.mulaiSiap,
      reached: fase !== "pembibitan",
    },
    {
      key: "targetOptimal",
      pos: (TARGET_OPTIMAL_HSS / BATAS_AKHIR_HSS) * 100,
      judul: "Paling bagus ditanam",
      data: window.targetOptimal,
      reached: fase === "optimal" || fase === "terlalu_tua",
    },
    {
      key: "batasAkhir",
      pos: 100,
      judul: "Jangan sampai lewat ini",
      data: window.batasAkhir,
      reached: fase === "terlalu_tua",
    },
  ];
  const aktifTitik = titik.find((t) => t.key === aktif) ?? null;

  return (
    <>
      <div className={`flex items-start gap-1.5 ${style.tone}`}>
        <Icon size={compact ? 14 : 16} className="shrink-0 mt-0.5" />
        <p className={`font-medium leading-snug ${compact ? "text-xs" : "text-sm"}`}>
          {verdict.verdict}
        </p>
      </div>

      <div className="mt-3 mx-2.5 relative">
        {aktifTitik && (
          <div
            className="absolute bottom-full mb-2 z-10 w-max max-w-[160px]"
            style={{
              left: `${aktifTitik.pos}%`,
              transform: aktifTitik.pos >= 60 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            <button
              type="button"
              onClick={() => setAktif(null)}
              className="block text-left rounded-lg bg-gray-900 text-white px-2.5 py-1.5 shadow-lg"
            >
              <span className="block text-[11px] font-semibold leading-tight">{aktifTitik.judul}</span>
              <span className="block text-[11px] text-gray-200 leading-tight mt-0.5">
                Umur {aktifTitik.data.hss} hari · {aktifTitik.data.label}
              </span>
            </button>
          </div>
        )}

        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {titik.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setAktif(aktif === t.key ? null : t.key)}
            aria-label={`${t.judul}, saat bibit umur ${t.data.hss} hari, ${t.data.label}`}
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
              aktif === t.key ? "ring-2 ring-gray-800/40" : ""
            }`}
            style={{ left: `${t.pos}%`, backgroundColor: "#e5e7eb" }}
          >
            <span
              className={`h-2 w-2 rounded-full ${t.reached ? style.bar : "bg-gray-300"}`}
            />
          </button>
        ))}
      </div>

      <p className="text-[10px] text-gray-400 mt-2 leading-snug">
        Ketuk titik pada garis untuk melihat tanggalnya.
      </p>
      {footer}
    </>
  );
}

export function EstimasiTanamDisclaimer({ className = "" }) {
  return (
    <p className={`text-[11px] text-gray-600 leading-relaxed ${className}`}>
      Bibit padi paling bagus ditanam saat berumur 15–21 hari (idealnya 18 hari).
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
  // Skor bibit hanya bermakna saat siklus semai berjalan — tanpa siklus, angka
  // seperti "100 Sangat baik" menyesatkan karena belum ada bibit yang dinilai.
  const noCycle = !semaiRaw;

  const displayEstimasi = mergeEstimasiDisplay(estimasi, semaiRaw);
  const timeline = buildTimelineTracker(semaiRaw, durasiPembibitanHari, displayEstimasi);
  const verdict = buildWindowVerdict(semaiRaw, displayEstimasi);

  if (!displayEstimasi && !varietas && !semaiRaw) {
    return (
      <div className="rounded-xl bg-slate-50 border border-dashed border-gray-200 px-4 py-4 text-sm text-gray-600 text-center">
        Data pembibitan belum tersedia. Mulai siklus semai untuk melihat estimasi.
      </div>
    );
  }

  const timelineBlock = (
    <WindowTimeline
      verdict={verdict}
      timeline={timeline}
      compact={compact}
      footer={estimasiFooter}
    />
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
                noCycle={noCycle}
                compact
              />
            </div>
          )}
        </div>

        {verdict ? (
          <div className="rounded-xl bg-gradient-to-br from-emerald-50/90 via-white to-white border border-emerald-100 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80 mb-2">
              <Calendar size={11} className="shrink-0" />
              Kapan bisa tanam
            </div>
            <WindowTimeline verdict={verdict} timeline={timeline} footer={estimasiFooter} />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-3 py-2.5 text-xs text-gray-600">
            Mulai siklus semai untuk melihat perkiraan waktu tanam.
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
            <p className="text-xs text-gray-600 mt-0.5 break-words">
              Semai:{" "}
              <span className="font-medium text-gray-700">
                {semaiLabel ?? "Belum mulai"}
              </span>
            </p>
            {varietasFooter}
          </InlineSegment>

          <InlineSegment icon={Calendar} title="Kapan bisa tanam" compact={compact}>
            {timelineBlock}
            <EstimasiTanamDisclaimer className="mt-2 pt-2 border-t border-gray-200/60" />
          </InlineSegment>

          {showStressScore && (
            <InlineSegment icon={Clock} title="Skor kondisi bibit" compact={compact}>
              <StressScoreDetailCard scoreData={stressScore} offline={deviceOffline} noCycle={noCycle} compact={compact} />
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

        <InfoCard icon={Calendar} title="Kapan bisa tanam" compact={compact}>
          {timelineBlock}
          <EstimasiTanamDisclaimer className="mt-2 pt-2 border-t border-gray-200/60" />
        </InfoCard>

        {showStressScore && (
          <InfoCard icon={Clock} title="Skor kondisi bibit" compact={compact}>
            <StressScoreDetailCard scoreData={stressScore} offline={deviceOffline} noCycle={noCycle} />
          </InfoCard>
        )}
      </div>
    </section>
  );
}
