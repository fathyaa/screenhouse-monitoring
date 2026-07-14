import { getStressScoreStyle } from "../constants/stressScore";
import { timeAgo } from "../constants/screenhouseStatus";

// Penjelasan permanen — jangan taruh hanya di title="" (tooltip tidak muncul di layar sentuh/HP).
const SCORE_EXPLANATION = "Menilai kondisi tanah & udara dari sensor, 0–100. Makin tinggi makin baik.";

export function StressScoreDonut({ score = 0, color = "#16a34a", size = 52, strokeWidth = 5 }) {
  const pct = Math.min(100, Math.max(0, Number(score) || 0));
  const visualPct = pct > 0 ? pct : color === "#dc2626" ? 8 : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (visualPct / 100) * circumference;
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 -rotate-90"
      aria-hidden
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Donut + angka skor di tengah (teks tegak, tidak ikut rotasi SVG). */
export function StressScoreDonutWithValue({
  score,
  display = score,
  color = "#16a34a",
  size = 52,
  strokeWidth = 5,
  textClassName = "",
}) {
  return (
    <div
      className="relative shrink-0 inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <StressScoreDonut score={score} color={color} size={size} strokeWidth={strokeWidth} />
      <span
        className={`absolute inset-0 flex items-center justify-center font-bold tabular-nums leading-none ${textClassName}`}
        style={{ fontSize: size <= 44 ? "0.75rem" : size <= 56 ? "0.875rem" : "1.25rem" }}
      >
        {display}
      </span>
    </div>
  );
}

/** Skor besar untuk kartu dashboard petani. */
export function StressScoreCardBadge({ scoreData, compact = false, offline = false, noCycle = false }) {
  if (noCycle) {
    return (
      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-medium">
        <span className="text-lg font-bold text-slate-400 tabular-nums">—</span>
        <span>Belum mulai siklus</span>
      </div>
    );
  }
  if (offline || scoreData?.stale) {
    // Alat mati tapi ada snapshot terakhir → tampilkan skor lama apa adanya,
    // abu-abu + label waktu, bukan "0 Kritis" (kondisi tidak diketahui ≠ kritis).
    if (scoreData?.last_reading_at != null) {
      const staleScore = scoreData.score ?? 0;
      return (
        <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
          <StressScoreDonut score={staleScore} color="#94a3b8" size={40} strokeWidth={4} />
          <div className="text-left leading-tight min-w-0">
            <div className="text-[9px] uppercase tracking-wide text-slate-500 font-semibold">
              Skor bibit
            </div>
            <div className="text-lg font-bold tabular-nums leading-none text-slate-600">
              {staleScore}
            </div>
            <div className="text-[10px] font-medium text-slate-500">
              Data terakhir, {timeAgo(scoreData.last_reading_at)}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-medium">
        <span className="text-lg font-bold text-slate-400 tabular-nums">—</span>
        <span>Menunggu alat terhubung</span>
      </div>
    );
  }

  if (!scoreData) {
    return (
      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-medium">
        Skor belum tersedia
      </div>
    );
  }

  const style = getStressScoreStyle(scoreData);
  const score = scoreData.score ?? 0;

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${style.bg} ${style.border}`}
        title={`Skor kondisi bibit: ${score} — ${scoreData.category}`}
      >
        <StressScoreDonut score={score} color={style.color} size={40} strokeWidth={4} />
        <div className="text-left leading-tight min-w-0">
          <div className="text-[9px] uppercase tracking-wide text-gray-500 font-semibold">
            Skor bibit
          </div>
          <div className={`text-lg font-bold tabular-nums leading-none ${style.text}`}>{score}</div>
          <div className={`text-[10px] font-semibold ${style.text}`}>{scoreData.category}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 px-3 py-2.5 rounded-xl border ${style.bg} ${style.border}`}>
      <div className="flex items-center gap-3">
        <StressScoreDonutWithValue
          score={score}
          color={style.color}
          size={56}
          strokeWidth={5}
          textClassName={style.text}
        />
        <div className="text-left min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-gray-600 font-semibold">
            Skor kondisi bibit
          </div>
          <div className={`text-sm font-semibold ${style.text}`}>{scoreData.category}</div>
        </div>
      </div>
      <p className="text-[11px] text-gray-600 leading-relaxed">{SCORE_EXPLANATION}</p>
    </div>
  );
}

/** Kartu skor untuk panel estimasi di halaman detail. */
export function StressScoreDetailCard({ scoreData, offline = false, compact = false, noCycle = false }) {
  const donutSize = compact ? 48 : 64;
  const strokeWidth = compact ? 4 : 5;

  if (noCycle) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-0.5">
        <StressScoreDonutWithValue
          score={0}
          display="—"
          color="#cbd5e1"
          size={donutSize}
          strokeWidth={strokeWidth}
          textClassName="text-slate-400"
        />
        <p className={`font-medium text-slate-600 mt-1 leading-snug ${compact ? "text-[10px]" : "text-xs"}`}>
          Belum mulai siklus
        </p>
      </div>
    );
  }

  if (offline || scoreData?.stale) {
    // Snapshot terakhir sebelum alat mati — abu-abu + label waktu, jangan "0 Kritis".
    if (scoreData?.last_reading_at != null) {
      return (
        <div className="flex flex-col items-center justify-center text-center py-0.5">
          <StressScoreDonutWithValue
            score={scoreData.score ?? 0}
            color="#94a3b8"
            size={donutSize}
            strokeWidth={strokeWidth}
            textClassName="text-slate-600"
          />
          <p className={`font-medium text-slate-600 mt-1 leading-snug ${compact ? "text-[10px]" : "text-xs"}`}>
            Dari data terakhir, {timeAgo(scoreData.last_reading_at)}
          </p>
          {!compact && (
            <p className="text-[11px] text-gray-600 leading-relaxed mt-1 max-w-[200px]">
              Alat sedang tidak terhubung — skor ini kondisi terakhir yang tersimpan, bukan pembacaan langsung.
            </p>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center text-center py-0.5">
        <StressScoreDonutWithValue
          score={0}
          display="—"
          color="#cbd5e1"
          size={donutSize}
          strokeWidth={strokeWidth}
          textClassName="text-slate-400"
        />
        <p className={`font-medium text-slate-600 mt-1 leading-snug ${compact ? "text-[10px]" : "text-xs"}`}>
          Menunggu alat terhubung
        </p>
      </div>
    );
  }

  if (!scoreData) {
    return (
      <p className={`text-gray-500 text-center ${compact ? "text-[11px] py-1" : "text-sm py-2"}`}>
        Skor belum tersedia
      </p>
    );
  }

  const style = getStressScoreStyle(scoreData);
  const score = scoreData.score ?? 0;

  return (
    <div className="flex flex-col items-center justify-center text-center py-0.5">
      <StressScoreDonutWithValue
        score={score}
        color={style.color}
        size={donutSize}
        strokeWidth={strokeWidth}
        textClassName={style.text}
      />
      <p className={`font-semibold mt-1 ${style.text} ${compact ? "text-[11px]" : "text-sm"}`}>
        {scoreData.category}
      </p>
      {!compact && (
        <p className="text-[11px] text-gray-600 leading-relaxed mt-1 max-w-[200px]">
          {SCORE_EXPLANATION}
        </p>
      )}
    </div>
  );
}

/** Donut kecil per sensor node di halaman detail. */
export function StressScoreNodeGauge({ scoreData, nodeName }) {
  if (!scoreData) return null;

  const style = getStressScoreStyle(scoreData);
  const score = scoreData.score ?? 0;

  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border ${style.bg} ${style.border}`}
      title={`Skor rak bibit ${nodeName ?? ""}: ${score} (${scoreData.category})`}
    >
      <StressScoreDonutWithValue
        score={score}
        color={style.color}
        size={44}
        strokeWidth={4}
        textClassName={style.text}
      />
      <div className="text-left leading-tight min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-gray-600 font-semibold">
          Skor bibit
        </div>
        <div className={`text-[11px] font-semibold truncate ${style.text}`}>
          {scoreData.category}
        </div>
      </div>
    </div>
  );
}
