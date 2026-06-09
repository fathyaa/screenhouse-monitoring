export const CHART_LEGEND = {
  align: "left",
  verticalAlign: "bottom",
  wrapperStyle: { paddingLeft: 0, textAlign: "left" },
};

export const SCREENHOUSE_CHART_GUIDE = [
  {
    title: "Kartu kondisi terkini",
    body: "Baca ini dulu. Tiap parameter diberi label Ideal/Kurang/Berlebih dengan bar zona hijau. Saran tindakan muncul otomatis bila ada yang menyimpang.",
  },
  {
    title: "Garis nitrogen & kelembapan (24 jam)",
    body: "Sumbu kiri (hijau) = nitrogen. Sumbu kanan (biru) = kelembapan tanah (%). Area samar = zona ideal — selama garis di dalam area, kondisi aman.",
  },
  {
    title: "Batang NPK",
    body: "Kondisi terbaru. Warna batang = verdict: hijau ideal, oranye kurang, merah berlebih.",
  },
  {
    title: "Garis phosphorus & potassium",
    body: "Tren rata-rata per jam. Dua area samar = zona ideal P (biru) dan K (kuning). Garis di dalam area = aman.",
  },
];

export const PETANI_CHART_GUIDE = [
  {
    title: "Ringkasan semua screenhouse",
    body: "Kartu & grafik menggabungkan data 24 jam terakhir dari seluruh screenhouse milik kamu (rata-rata per jam). Cocok untuk melihat kondisi keseluruhan sebelum membuka detail per lokasi.",
  },
  ...SCREENHOUSE_CHART_GUIDE,
];

/** Panduan per grafik di halaman Tren Tanah (petani). */
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
          <span className="text-gray-500"> — {p.name}</span>
        </div>
      ))}
    </div>
  );
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
    { name: "N", value: avg("nitrogen"), fill: "#16a34a", min: threshold?.min_nitrogen },
    { name: "P", value: avg("phosphorus"), fill: "#2563eb", min: threshold?.min_phosphorus },
    { name: "K", value: avg("potassium"), fill: "#ca8a04", min: threshold?.min_potassium },
  ];
}
