import { Sprout } from "lucide-react";

const MAX_VISIBLE = 6;

function progressBarColor(sisaHari) {
  if (sisaHari <= 0) return "bg-emerald-600";
  if (sisaHari <= 2) return "bg-amber-500";
  return "bg-emerald-500";
}

function sisaHariLabel(sisaHari) {
  if (sisaHari > 0) return `${sisaHari} hari lagi`;
  if (sisaHari === 0) return "Estimasi hari ini";
  return `Lewat ${Math.abs(sisaHari)} hari`;
}

/** Progres siklus semai tiap screenhouse aktif, diurutkan dari yang paling dekat/lewat siap tanam. */
export default function PembibitanProgressPanel({ items, className = "" }) {
  if (!items?.length) return null;

  const visible = items.slice(0, MAX_VISIBLE);
  const hiddenCount = items.length - visible.length;

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-4 space-y-3 text-left ${className}`}>
      <div>
        <div className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <Sprout size={14} className="text-emerald-600 shrink-0" aria-hidden />
          Proses pembibitan
        </div>
        <p className="text-xs text-gray-500 mt-0.5">Progres tiap screenhouse yang sedang semai.</p>
      </div>

      <div className="space-y-3">
        {visible.map((item) => (
          <div key={item.id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-gray-800 truncate min-w-0">{item.name}</span>
              <span className="text-[11px] text-gray-500 shrink-0 tabular-nums">
                Hari {item.hariKe}/{item.totalDays}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progressBarColor(item.sisaHari)}`}
                style={{ width: `${item.progressPct}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">{sisaHariLabel(item.sisaHari)}</p>
          </div>
        ))}
      </div>

      {hiddenCount > 0 && (
        <p className="text-xs text-gray-500 pt-1 border-t border-gray-100">
          +{hiddenCount} screenhouse lainnya sedang semai
        </p>
      )}
    </div>
  );
}
