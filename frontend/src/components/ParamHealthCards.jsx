import { Clock } from "lucide-react";
import { buildHealthList, getActions, markerPosition } from "../constants/paramHealth";
import { FARMER_LABELS } from "../constants/farmerLabels";
import { formatRackName } from "../utils/rackNames";
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

function formatRange(min, max, unit) {
  return FARMER_LABELS.formatRange(min, max, unit);
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

function HealthCard({ item, getHint, stale, compactStaleBadge }) {
  const bar = markerPosition(item.key, item.value, item.min, item.max);
  const hint = getHint?.(item.key, item.min, item.max) ?? null;
  const style = resolveDisplayStyle(item, stale);
  const badgeLabel = stale && item.status === "ideal" ? STALE_STYLE.label : style.label;
  const showBadge = !(stale && compactStaleBadge);
  const accentColor = stale ? "#94a3b8" : style.color;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3.5 sm:p-3 text-left flex flex-col gap-2.5 sm:gap-2">
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] sm:text-xs font-semibold text-gray-800 leading-snug">
            {item.purpose}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{item.label}</div>
        </div>
        {showBadge && (
          <span
            className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${style.badge}`}
          >
            {badgeLabel}
          </span>
        )}
      </div>

      <div className="space-y-1">
        <div
          className="text-2xl sm:text-xl font-bold tabular-nums leading-none tracking-tight"
          style={{ color: stale ? "#64748b" : style.color }}
        >
          {formatValue(item.value, item.unit)}
        </div>
        {item.min != null && item.max != null ? (
          <div
            className="text-[11px] text-gray-500 font-medium leading-snug"
            title={hint || undefined}
          >
            Batas aman{" "}
            <span className="text-gray-600">{formatRange(item.min, item.max, item.unit)}</span>
          </div>
        ) : (
          <div className="text-[11px] text-gray-500 font-medium">Batas aman belum diatur</div>
        )}
      </div>

      {bar ? (
        <div className="relative h-2 sm:h-1.5 rounded-full bg-slate-100">
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
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 sm:w-2.5 sm:h-2.5 rounded-full border-2 border-white shadow"
            style={{
              left: `clamp(0px, calc(${bar.pos}% - 6px), calc(100% - 12px))`,
              backgroundColor: accentColor,
            }}
          />
        </div>
      ) : null}

      {item.multiNode && item.nodeName && item.status !== "ideal" && item.status !== "unknown" && (
        <div className="text-[11px] text-gray-500 font-medium -mt-1">
          Dari alat: {formatRackName(item.nodeName)}
        </div>
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
                Data terakhir {snapshotLabel}
              </div>
              <div className="text-[11px] text-amber-800/90 mt-0.5">
                Angka di bawah adalah data terakhir yang tersimpan, bukan pembacaan langsung.
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-2 transition ${
          stale ? "opacity-75 grayscale-[0.25]" : ""
        }`}
      >
        {list.map((item) => (
          <HealthCard
            key={item.key}
            item={item}
            getHint={getThresholdHint}
            stale={stale}
            compactStaleBadge={stale}
          />
        ))}
      </div>

      {showActions && (
        <div className="mt-3">
          {actions.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-bl-primary bg-bl-surface-muted rounded-xl px-3 py-2">
              <span>✓</span>
              {stale
                ? "Data terakhir masih dalam batas aman. Tunggu alat terhubung untuk pembacaan langsung."
                : "Semua ukuran tanah masih pas. Tidak perlu tindakan."}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wide text-gray-600 font-medium">
                {stale ? "Catatan dari data terakhir" : "Saran tindakan"}
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
                    {stale ? "menyimpang pada data terakhir" : a.style.label.toLowerCase()}
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
