import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PARAM_COLORS, CHART_GRID, CHART_REFLINE } from "../constants/chartColors";
import { ChartGuideToggle } from "../constants/chartGuide";

/** Skala Y yang mencakup data + garis batas min/maks, dengan sedikit padding. */
function domainFor(data, key, min, max) {
  const vals = data
    .map((d) => d[key])
    .filter((v) => v != null && !Number.isNaN(Number(v)))
    .map(Number);
  const candidates = [...vals];
  if (min != null) candidates.push(Number(min));
  if (max != null) candidates.push(Number(max));
  if (!candidates.length) return ["auto", "auto"];
  const lo = Math.min(...candidates);
  const hi = Math.max(...candidates);
  const pad = (hi - lo) * 0.1 || Math.abs(hi) * 0.1 || 1;
  return [Math.floor(lo - pad), Math.ceil(hi + pad)];
}

function hasData(data, key) {
  return data.some((d) => d[key] != null && !Number.isNaN(Number(d[key])));
}

/**
 * Grid mini line-chart 24 jam per parameter — dipakai untuk parameter yang
 * sebelumnya hanya punya kartu kondisi tanpa historis (suhu, pH, EC, cahaya,
 * kelembapan udara). Tiap chart menunjukkan garis batas aman min/maks.
 */
export default function ParamHistoryCharts({
  data = [],
  threshold,
  metrics = [],
  title = "Tren parameter lain (24 jam)",
  subtitle = "Garis putus-putus = batas aman minimum & maksimum.",
  guideBody = null,
  guideExtra = null,
}) {
  const visible = metrics.filter((m) => hasData(data, m.key));
  if (!data.length || !visible.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
      <div className="text-sm font-semibold text-gray-800 mb-1">{title}</div>
      <div className="text-xs text-gray-600 mb-3">{subtitle}</div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {visible.map((m) => {
          const color = PARAM_COLORS[m.key] ?? "#64748b";
          const min = threshold?.[m.minCol];
          const max = threshold?.[m.maxCol];
          const domain = domainFor(data, m.key, min, max);
          return (
            <div key={m.key} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-700 truncate">{m.label}</span>
                <span className="text-[10px] text-gray-500 shrink-0">{m.unit}</span>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9 }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis tick={{ fontSize: 9 }} width={34} domain={domain} />
                  {min != null && (
                    <ReferenceLine
                      y={Number(min)}
                      stroke={CHART_REFLINE}
                      strokeDasharray="4 3"
                      strokeWidth={1}
                    />
                  )}
                  {max != null && (
                    <ReferenceLine
                      y={Number(max)}
                      stroke={CHART_REFLINE}
                      strokeDasharray="4 3"
                      strokeWidth={1}
                    />
                  )}
                  <Tooltip
                    formatter={(value) => [`${value} ${m.unit}`, m.label]}
                    labelStyle={{ fontSize: 11 }}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <Line
                    type="monotone"
                    dataKey={m.key}
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>

      <ChartGuideToggle body={guideBody} extra={guideExtra} />
    </div>
  );
}
