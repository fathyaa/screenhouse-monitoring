/* eslint-disable react-refresh/only-export-components */
import { ReferenceArea } from "recharts";
import { PARAM_COLORS, CHART_ZONE } from "./chartColors";

export const CHART_LEGEND = {
  align: "left",
  verticalAlign: "bottom",
  wrapperStyle: { paddingLeft: 0, textAlign: "left" },
};

/** Warna zona batas threshold pada grafik tren mg/kg. */
export const THRESHOLD_ZONE_COLORS = {
  low: CHART_ZONE.below,
  optimal: CHART_ZONE.optimal,
  high: CHART_ZONE.above,
};

export const THRESHOLD_ZONE_LEGEND = [
  { color: THRESHOLD_ZONE_COLORS.high, label: "Zona berlebih (di atas maksimum)" },
  { color: THRESHOLD_ZONE_COLORS.optimal, label: "Zona optimal/aman" },
  { color: THRESHOLD_ZONE_COLORS.low, label: "Zona kurang (di bawah minimum)" },
];

export const SCREENHOUSE_CHART_GUIDE = [
  {
    title: "Kartu kondisi tanah",
    body: "Mulai dari sini. Setiap ukuran tanah dapat label Pas (hijau), Kurang (oranye), atau Berlebih (merah). Garis hijau di bawah angka menunjukkan batas aman. Kalau ada yang tidak pas, saran tindakan muncul otomatis di bawah kartu.",
  },
  {
    title: "Grafik nitrogen & air tanah",
    body: "Menampilkan perubahan selama 24 jam terakhir. Garis hijau = kadar nitrogen (N). Garis biru = kelembapan tanah (%). Area hijau muda = zona optimal/aman, merah muda = di bawah minimum (kurang), kuning = di atas maksimum (berlebih). Setiap garis dinilai terhadap batas aman masing-masing.",
  },
  {
    title: "Diagram batang N, P, K",
    body: "Nilai pupuk terbaru di tanah. Warna batang: hijau = pas, oranye = kurang, merah = kelebihan. Arahkan kursor ke batang untuk melihat angkanya.",
  },
  {
    title: "Grafik fosfor & kalium",
    body: "Perubahan fosfor (P) dan kalium (K) per jam. Area hijau muda = zona optimal/aman, merah muda = di bawah minimum (kurang), kuning = di atas maksimum (berlebih). Setiap garis dinilai terhadap batas aman masing-masing.",
  },
];

export const PETANI_CHART_GUIDE = [
  {
    title: "Ringkasan semua screenhouse",
    body: "Grafik di halaman ini menggabungkan data 24 jam terakhir dari semua screenhouse Anda. Cocok untuk melihat kondisi keseluruhan sebelum buka detail per lokasi.",
  },
  ...SCREENHOUSE_CHART_GUIDE,
];

/** Panduan per grafik di halaman Tren Wilayah (operator). */
export const PETANI_TREN_CHART_GUIDES = {
  nMoisture: SCREENHOUSE_CHART_GUIDE[1],
  npk: SCREENHOUSE_CHART_GUIDE[2],
  pk: SCREENHOUSE_CHART_GUIDE[3],
};

export function ChartGuideToggle({ body, extra }) {
  if (!body) return null;
  return (
    <details className="mt-3 bg-blue-50/60 border border-blue-100 rounded-xl px-3 py-2 group text-left">
      <summary className="text-xs font-medium text-blue-800 cursor-pointer list-none flex items-center justify-between gap-2">
        <span>Cara membaca grafik ini</span>
        <span className="text-[10px] text-blue-500 group-open:hidden shrink-0">Buka</span>
      </summary>
      <p className="mt-2 text-xs text-blue-900/90 leading-relaxed">{body}</p>
      {extra && <p className="mt-1.5 text-[11px] text-blue-700/80">{extra}</p>}
    </details>
  );
}

export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs text-left">
      <div className="font-medium text-gray-700 mb-1">Jam {label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }} className="text-left">
          <span className="font-semibold">{p.value}</span>
          <span className="text-gray-600 font-medium"> · {p.name}</span>
        </div>
      ))}
    </div>
  );
}

/** Skala Y grafik P/K mencakup kedua batas threshold agar zona terlihat penuh. */
export function getPkChartYDomain(trendData, threshold) {
  const dataVals = (trendData || [])
    .flatMap((d) => [d.phosphorus, d.potassium])
    .filter((v) => v != null && !Number.isNaN(Number(v)))
    .map(Number);
  const mins = [threshold?.min_phosphorus, threshold?.min_potassium].filter(
    (v) => v != null
  );
  const maxs = [threshold?.max_phosphorus, threshold?.max_potassium].filter(
    (v) => v != null
  );
  const lo = Math.floor(Math.min(0, ...mins, ...(dataVals.length ? dataVals : [0])) - 2);
  const hi = Math.ceil(Math.max(...maxs, ...(dataVals.length ? dataVals : [0])) + 2);
  return [lo, hi];
}

function ThreeZoneBands({ min, max, yMin, yMax, prefix, yAxisId }) {
  if (min == null || max == null) return null;
  const axisProps = yAxisId ? { yAxisId } : {};
  return (
    <>
      <ReferenceArea
        key={`${prefix}-low`}
        {...axisProps}
        y1={yMin}
        y2={min}
        fill={THRESHOLD_ZONE_COLORS.low}
        fillOpacity={0.45}
        ifOverflow="extendDomain"
      />
      <ReferenceArea
        key={`${prefix}-ok`}
        {...axisProps}
        y1={min}
        y2={max}
        fill={THRESHOLD_ZONE_COLORS.optimal}
        fillOpacity={0.4}
        ifOverflow="extendDomain"
      />
      <ReferenceArea
        key={`${prefix}-high`}
        {...axisProps}
        y1={max}
        y2={yMax}
        fill={THRESHOLD_ZONE_COLORS.high}
        fillOpacity={0.45}
        ifOverflow="extendDomain"
      />
    </>
  );
}

/** Skala Y dual-axis: nitrogen (kiri) & kelembapan tanah (kanan). */
export function getNMoistureChartYDomains(trendData, threshold) {
  const nVals = (trendData || [])
    .map((d) => d.nitrogen)
    .filter((v) => v != null && !Number.isNaN(Number(v)))
    .map(Number);
  const mVals = (trendData || [])
    .map((d) => d.soil_moisture)
    .filter((v) => v != null && !Number.isNaN(Number(v)))
    .map(Number);

  const nLo = Math.floor(
    Math.min(
      threshold?.min_nitrogen ?? Infinity,
      ...(nVals.length ? nVals : [0]),
      0
    ) - 2
  );
  const nHi = Math.ceil(
    Math.max(threshold?.max_nitrogen ?? -Infinity, ...(nVals.length ? nVals : [0])) + 2
  );

  const mLo = Math.floor(
    Math.min(
      threshold?.min_soil_moisture ?? Infinity,
      ...(mVals.length ? mVals : [40]),
      0
    ) - 2
  );
  const mHi = Math.ceil(
    Math.max(threshold?.max_soil_moisture ?? -Infinity, ...(mVals.length ? mVals : [90])) + 2
  );

  return {
    n: [nLo, nHi],
    m: [Math.max(0, mLo), Math.min(100, mHi)],
  };
}

/** Zona kurang / optimal / berlebih untuk nitrogen & kelembapan tanah (dual Y). */
export function NMoistureThresholdBands({ threshold, nDomain, mDomain }) {
  if (!threshold) return null;

  return (
    <>
      <ThreeZoneBands
        yAxisId="n"
        min={threshold.min_nitrogen}
        max={threshold.max_nitrogen}
        yMin={nDomain?.[0] ?? 0}
        yMax={nDomain?.[1] ?? 50}
        prefix="n"
      />
      <ThreeZoneBands
        yAxisId="m"
        min={threshold.min_soil_moisture}
        max={threshold.max_soil_moisture}
        yMin={mDomain?.[0] ?? 0}
        yMax={mDomain?.[1] ?? 100}
        prefix="m"
      />
    </>
  );
}

/** Zona kurang / optimal / berlebih untuk fosfor & kalium (mg/kg). */
export function PkThresholdBands({ threshold, yDomain }) {
  if (!threshold) return null;

  const yMin =
    yDomain?.[0] ??
    Math.floor(
      Math.min(
        threshold.min_phosphorus ?? 0,
        threshold.min_potassium ?? 0,
        0
      ) - 2
    );
  const yMax =
    yDomain?.[1] ??
    Math.ceil(
      Math.max(threshold.max_phosphorus ?? 0, threshold.max_potassium ?? 0) + 2
    );

  return (
    <>
      <ThreeZoneBands
        min={threshold.min_potassium}
        max={threshold.max_potassium}
        yMin={yMin}
        yMax={yMax}
        prefix="k"
      />
      <ThreeZoneBands
        min={threshold.min_phosphorus}
        max={threshold.max_phosphorus}
        yMin={yMin}
        yMax={yMax}
        prefix="p"
      />
    </>
  );
}

export function PkChartLegendContent({ payload }) {
  return (
    <div className="text-left pt-2 space-y-2">
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {THRESHOLD_ZONE_LEGEND.map((z) => (
          <span
            key={z.label}
            className="inline-flex items-center gap-1.5 text-[11px] text-gray-600 font-medium"
          >
            <span
              className="w-3 h-3 rounded-sm shrink-0 border border-black/5"
              style={{ backgroundColor: z.color }}
            />
            {z.label}
          </span>
        ))}
      </div>
      {payload?.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {payload.map((entry) => (
            <span
              key={entry.value}
              className="inline-flex items-center gap-1.5 text-[11px] text-gray-700 font-medium"
            >
              <span
                className="w-4 h-0.5 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Legend grafik N + kelembapan — zona + garis dual-axis. */
export function NMoistureChartLegendContent({ payload }) {
  return <PkChartLegendContent payload={payload} />;
}

export function aggregateHourlyTrend(dashboards, histories) {
  const buckets = {};

  dashboards.forEach((dash) => {
    dash?.hourlyTrend?.forEach((row) => {
      const label = new Date(row.bucket).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      if (!buckets[label]) {
        buckets[label] = {
          label,
          nitrogen: [],
          soil_moisture: [],
          phosphorus: [],
          potassium: [],
        };
      }
      if (row.avg_nitrogen != null) buckets[label].nitrogen.push(Number(row.avg_nitrogen));
      if (row.avg_soil_moisture != null)
        buckets[label].soil_moisture.push(Number(row.avg_soil_moisture));
      if (row.avg_phosphorus != null)
        buckets[label].phosphorus.push(Number(row.avg_phosphorus));
      if (row.avg_potassium != null)
        buckets[label].potassium.push(Number(row.avg_potassium));
    });
  });

  if (Object.keys(buckets).length === 0) {
    histories.flat().forEach((row) => {
      const label = new Date(row.created_at).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      if (!buckets[label]) {
        buckets[label] = {
          label,
          nitrogen: [],
          soil_moisture: [],
          phosphorus: [],
          potassium: [],
        };
      }
      buckets[label].nitrogen.push(row.nitrogen);
      buckets[label].soil_moisture.push(Number(row.soil_moisture));
      buckets[label].phosphorus.push(row.phosphorus);
      buckets[label].potassium.push(row.potassium);
    });
  }

  const avg = (arr) =>
    arr.length ? arr.reduce((a, c) => a + Number(c), 0) / arr.length : null;

  return Object.values(buckets).map((b) => ({
    label: b.label,
    nitrogen: avg(b.nitrogen) != null ? Math.round(avg(b.nitrogen)) : null,
    soil_moisture:
      avg(b.soil_moisture) != null
        ? Math.round(avg(b.soil_moisture) * 10) / 10
        : null,
    phosphorus: avg(b.phosphorus) != null ? Math.round(avg(b.phosphorus)) : null,
    potassium: avg(b.potassium) != null ? Math.round(avg(b.potassium)) : null,
  }));
}

export function buildNpkFromLatest(latestByScreenhouse, threshold) {
  const rows = Object.values(latestByScreenhouse).filter(Boolean);
  if (!rows.length) return [];

  const avg = (key) => {
    const vals = rows.map((r) => r[key]).filter((v) => v != null);
    return vals.length
      ? Math.round(vals.reduce((a, c) => a + Number(c), 0) / vals.length)
      : 0;
  };

  return [
    { name: "N", value: avg("nitrogen"), fill: PARAM_COLORS.nitrogen, min: threshold?.min_nitrogen },
    { name: "P", value: avg("phosphorus"), fill: PARAM_COLORS.phosphorus, min: threshold?.min_phosphorus },
    { name: "K", value: avg("potassium"), fill: PARAM_COLORS.potassium, min: threshold?.min_potassium },
  ];
}
