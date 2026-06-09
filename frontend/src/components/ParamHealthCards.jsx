import { buildHealthList, getActions, markerPosition } from "../constants/paramHealth";

function formatValue(value, unit) {
  if (value == null || Number.isNaN(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}${unit ? (unit === "°C" || unit === "%" ? unit : ` ${unit}`) : ""}`;
}

function HealthCard({ item }) {
  const bar = markerPosition(item.key, item.value, item.min, item.max);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 text-left">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-gray-700 truncate">{item.label}</div>
          <div className="text-[10px] text-gray-400">{item.purpose}</div>
        </div>
        <span
          className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${item.style.badge}`}
        >
          {item.style.label}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-lg font-bold" style={{ color: item.style.color }}>
          {formatValue(item.value, item.unit)}
        </span>
        {item.min != null && item.max != null && (
          <span className="text-[10px] text-gray-400">
            ideal {item.min}–{item.max}
            {item.unit && item.unit !== "%" && item.unit !== "°C" ? ` ${item.unit}` : item.unit}
          </span>
        )}
      </div>

      {/* Bar zona ideal: track abu, segmen hijau = ideal, marker = nilai sekarang */}
      {bar ? (
        <div className="relative mt-2 h-1.5 rounded-full bg-slate-100">
          <div
            className="absolute h-full rounded-full"
            style={{
              left: `${bar.idealStart}%`,
              width: `${bar.idealWidth}%`,
              backgroundColor: "#bbf7d0",
            }}
          />
          <div
            className="absolute -top-0.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow"
            style={{
              left: `calc(${bar.pos}% - 5px)`,
              backgroundColor: item.style.color,
            }}
          />
        </div>
      ) : (
        <div className="mt-2 text-[10px] text-gray-300">Belum ada acuan threshold</div>
      )}

      {item.multiNode && item.nodeName && item.status !== "ideal" && item.status !== "unknown" && (
        <div className="mt-1.5 text-[10px] text-gray-400 truncate">dari {item.nodeName}</div>
      )}
    </div>
  );
}

/**
 * Kartu verdict per-parameter (Kurang / Ideal / Berlebih) + bar zona ideal,
 * diikuti daftar rekomendasi tindakan untuk parameter yang menyimpang.
 */
export default function ParamHealthCards({
  latest,
  threshold,
  keys,
  list: providedList,
  title = "Kondisi terkini",
  subtitle,
  showActions = true,
}) {
  const list = providedList ?? buildHealthList(latest, threshold, keys);
  if (!list.length) return null;

  const actions = getActions(list);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-gray-800">{title}</div>
          {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
        </div>
        {!threshold && (
          <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            Threshold belum diatur
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
        {list.map((item) => (
          <HealthCard key={item.key} item={item} />
        ))}
      </div>

      {showActions && (
        <div className="mt-3">
          {actions.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
              <span>✓</span>
              Semua parameter dalam kondisi ideal. Tidak ada tindakan yang diperlukan.
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">
                Saran tindakan
              </div>
              {actions.map((a) => (
                <div
                  key={a.key}
                  className="flex items-start gap-2 text-xs text-gray-700 bg-slate-50 rounded-lg px-3 py-2"
                >
                  <span
                    className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: a.style.color }}
                  />
                  <span>
                    <span className="font-semibold">{a.label}</span> {a.style.label.toLowerCase()}
                    {a.multiNode && a.nodeName ? ` (${a.nodeName})` : ""} — {a.advice}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
