import { Clock } from "lucide-react";
import { buildHealthList, getActions, markerPosition } from "../constants/paramHealth";
import { EMPTY_VALUE } from "../constants/sensorMetrics";

const STALE_STYLE = {
  label: "Terakhir dicatat",
  color: "#64748b",
  badge: "bg-slate-100 text-slate-600",
};

function formatValue(value, unit) {
  if (value == null || Number.isNaN(value)) return EMPTY_VALUE;
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}${unit ? (unit === "°C" || unit === "%" ? unit : ` ${unit}`) : ""}`;
}

function resolveDisplayStyle(item, stale) {
  if (!stale) return item.style;
  if (item.status === "ideal") return STALE_STYLE;
  return {
    ...item.style,
    badge: "bg-slate-100 text-slate-600",
    color: "#64748b",
  };
}

function HealthCard({ item, getHint, stale }) {
  const bar = markerPosition(item.key, item.value, item.min, item.max);
  const hint = getHint?.(item.key, item.min, item.max) ?? null;
  const style = resolveDisplayStyle(item, stale);
  const badgeLabel = stale && item.status === "ideal" ? STALE_STYLE.label : style.label;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 text-left">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-gray-700 truncate">{item.label}</div>
          <div className="text-[11px] text-gray-600 font-medium">{item.purpose}</div>
        </div>
        <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${style.badge}`}>
          {badgeLabel}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span
          className="text-lg font-bold"
          style={{ color: stale ? "#64748b" : style.color }}
        >
          {formatValue(item.value, item.unit)}
        </span>
        {item.min != null && item.max != null && (
          <span
            className="text-[11px] text-gray-600 font-medium cursor-help underline decoration-dotted decoration-gray-400 underline-offset-2"
            title={hint || undefined}
          >
            batas aman {item.min}–{item.max}
            {item.unit && item.unit !== "%" && item.unit !== "°C" ? ` ${item.unit}` : item.unit}
          </span>
        )}
      </div>

      {bar ? (
        <div className="relative mt-2 h-1.5 rounded-full bg-slate-100">
          {!stale && (
            <div
              className="absolute h-full rounded-full"
              style={{
                left: `${bar.idealStart}%`,
                width: `${bar.idealWidth}%`,
                backgroundColor: "#bbf7d0",
              }}
            />
          )}
          <div
            className="absolute -top-0.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow"
            style={{
              left: `calc(${bar.pos}% - 5px)`,
              backgroundColor: stale ? "#94a3b8" : style.color,
            }}
          />
        </div>
      ) : (
        <div className="mt-2 text-[11px] text-gray-600 font-medium">Batas aman belum diatur</div>
      )}

      {item.multiNode && item.nodeName && item.status !== "ideal" && item.status !== "unknown" && (
        <div className="mt-1.5 text-[11px] text-gray-600 font-medium truncate">dari {item.nodeName}</div>
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
  getThresholdHint,
  stale = false,
  snapshotLabel,
}) {
  const list = providedList ?? buildHealthList(latest, threshold, keys);
  if (!list.length) return null;

  const actions = getActions(list);

  return (
    <div
      className={`bg-white rounded-2xl border border-gray-200 p-4 text-left ${
        stale ? "border-slate-200" : ""
      }`}
    >
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-gray-800">{title}</div>
            {subtitle && !stale && (
              <div className="text-xs text-gray-600 mt-0.5">{subtitle}</div>
            )}
          </div>
          {!threshold && (
            <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
              Batas aman belum diatur
            </span>
          )}
        </div>

        {stale && snapshotLabel && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200/80 px-3 py-2.5">
            <Clock size={15} className="shrink-0 text-amber-700" />
            <div>
              <div className="text-xs font-semibold text-amber-950">
                Snapshot terakhir {snapshotLabel}
              </div>
              <div className="text-[11px] text-amber-800/90 mt-0.5">
                Data di bawah adalah cache historis — bukan pembacaan live.
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className={`grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 transition ${
          stale ? "opacity-60 grayscale-[0.4]" : ""
        }`}
      >
        {list.map((item) => (
          <HealthCard key={item.key} item={item} getHint={getThresholdHint} stale={stale} />
        ))}
      </div>

      {showActions && (
        <div className="mt-3">
          {actions.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-bl-primary bg-bl-surface-muted rounded-xl px-3 py-2">
              <span>✓</span>
              {stale
                ? "Snapshot terakhir masih dalam batas aman. Tunggu perangkat online untuk data live."
                : "Semua ukuran tanah masih pas. Tidak perlu tindakan."}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wide text-gray-600 font-medium">
                {stale ? "Catatan dari snapshot terakhir" : "Saran tindakan"}
              </div>
              {actions.map((a) => (
                <div
                  key={a.key}
                  className="flex items-start gap-2 text-xs text-gray-700 bg-slate-50 rounded-lg px-3 py-2"
                >
                  <span
                    className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: stale ? "#94a3b8" : a.style.color }}
                  />
                  <span>
                    <span className="font-semibold">{a.label}</span>{" "}
                    {stale ? "menyimpang pada snapshot terakhir" : a.style.label.toLowerCase()}
                    {a.multiNode && a.nodeName ? ` (${a.nodeName})` : ""}
                    {!stale && `. ${a.advice}`}
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
