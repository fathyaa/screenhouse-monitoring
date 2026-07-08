import { CheckCircle2, TriangleAlert, Bot, WifiOff, Sprout } from "lucide-react";

function buildSummarySentence({ total, attentionCount, autoHandledCount }) {
  if (attentionCount > 0) {
    return `${attentionCount} dari ${total} screenhouse perlu perhatian Anda.`;
  }
  if (autoHandledCount > 0) {
    return `Semua kondisi terpantau baik — ${autoHandledCount} ditangani otomatis oleh sistem.`;
  }
  return `Semua ${total} screenhouse dalam kondisi baik.`;
}

/** Ringkasan singkat kondisi seluruh screenhouse — dipasang di kolom kiri, terpisah dari daftar kartu yang scroll sendiri. */
export default function DashboardInsightPanel({ insight, className = "" }) {
  if (!insight) return null;
  const { total, healthyCount, attentionCount, autoHandledCount, offlineCount, nearestReady } = insight;
  if (!total) return null;

  const rows = [
    healthyCount > 0 && { key: "healthy", icon: CheckCircle2, color: "text-bl-primary", label: `${healthyCount} kondisi baik` },
    attentionCount > 0 && { key: "attention", icon: TriangleAlert, color: "text-red-600", label: `${attentionCount} perlu perhatian` },
    autoHandledCount > 0 && { key: "auto", icon: Bot, color: "text-bl-primary", label: `${autoHandledCount} ditangani otomatis` },
    offlineCount > 0 && { key: "offline", icon: WifiOff, color: "text-slate-500", label: `${offlineCount} tidak terhubung` },
  ].filter(Boolean);

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-4 space-y-3 text-left ${className}`}>
      <div>
        <div className="text-sm font-semibold text-gray-800">Ringkasan hari ini</div>
        <p className="text-sm text-gray-700 mt-1 leading-relaxed">{buildSummarySentence(insight)}</p>
      </div>

      {rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-2 text-xs text-gray-600">
              <row.icon size={14} className={`shrink-0 ${row.color}`} aria-hidden />
              <span>{row.label}</span>
            </div>
          ))}
        </div>
      )}

      {nearestReady && (
        <div className="flex items-start gap-2 rounded-xl bg-bl-surface-muted border border-bl-accent/20 px-3 py-2.5">
          <Sprout size={15} className="text-bl-primary shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-bl-primary leading-snug">
            <span className="font-semibold">{nearestReady.name}</span> paling dekat siap tanam — sekitar{" "}
            {nearestReady.sisaHari} hari lagi.
          </p>
        </div>
      )}
    </div>
  );
}
