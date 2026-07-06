function escapeCsv(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBlob(filename, content) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function groupLabelFor(report) {
  if (report.group_by === "regency") return "Kabupaten/Kota";
  if (report.group_by === "village") return "Kelurahan/Desa";
  return "Kecamatan";
}

export function exportOperatorReportCsv(report) {
  if (!report?.regions?.length) return;

  const groupLabel = groupLabelFor(report);

  const statusHeader = [
    groupLabel,
    "Total",
    "Sehat",
    "Peringatan",
    "Kritis",
    "Offline",
    "Uptime (%)",
    "Skor rata-rata",
  ];

  const statusRows = report.regions.map((row) => [
    row.region_name,
    row.total,
    row.healthy,
    row.warning,
    row.critical,
    row.offline,
    row.uptime_pct,
    row.avg_stress_score ?? "",
  ]);

  const seedlingHeader = [
    "Kecamatan",
    "Kab/Kota",
    "Total",
    "On track",
    "Terlambat",
    "Perlu evaluasi",
    "Belum diisi",
    "Varietas dominan",
    "Rata-rata durasi (hari)",
    "Skor rata-rata",
  ];

  const seedlingRows = (report.seedling_progress_by_district ?? []).map((row) => [
    row.district_name,
    row.regency,
    row.total,
    row.on_track,
    row.terlambat,
    row.perlu_evaluasi,
    row.belum_disi ?? 0,
    row.dominant_varietas ?? "",
    row.avg_cycle_duration_days ?? "",
    row.avg_stress_score ?? "",
  ]);

  const varietasRows = (report.varietas_distribution ?? []).map((row) => [row.nama, row.count]);

  const sensorHeader = [
    groupLabel,
    "N rata-rata (mg/kg)",
    "P rata-rata (mg/kg)",
    "K rata-rata (mg/kg)",
    "Kelembapan rata-rata (%)",
    "Suhu tanah rata-rata (°C)",
    "Alert aktif",
  ];

  const sensorRows = report.regions.map((row) => [
    row.region_name,
    row.sensor_avg?.nitrogen ?? "",
    row.sensor_avg?.phosphorus ?? "",
    row.sensor_avg?.potassium ?? "",
    row.sensor_avg?.soil_moisture ?? "",
    row.sensor_avg?.soil_temperature ?? "",
    row.active_alerts,
  ]);

  const section = (title, header, rows) => [
    [title],
    header,
    ...rows,
    [],
  ];

  const csv = [
    ...section("Status & Uptime", statusHeader, statusRows),
    ...section("Progres Pembibitan per Kecamatan", seedlingHeader, seedlingRows),
    ...section("Distribusi Varietas", ["Varietas", "Jumlah screenhouse"], varietasRows),
    ...section("Data Sensor Rata-rata", sensorHeader, sensorRows),
  ]
    .map((r) => r.map(escapeCsv).join(","))
    .join("\n");

  const date = new Date(report.generated_at || Date.now()).toISOString().slice(0, 10);
  downloadBlob(`laporan-wilayah-${date}.csv`, csv);
}

export function exportProblematicScreenhousesCsv(items) {
  if (!items?.length) return;

  const header = [
    "Screenhouse",
    "Varietas",
    "Petani",
    "Telepon",
    "Desa",
    "Kecamatan",
    "Skor kondisi",
    "Kategori skor",
    "Estimasi siap tanam",
    "Status operasional",
    "Insight",
    "Alert aktif",
    "Terakhir data",
  ];

  const rows = items.map((row) => [
    row.name,
    row.varietas_nama ?? "",
    row.owner_name ?? "",
    row.owner_phone ?? "",
    row.village ?? "",
    row.district ?? "",
    row.stress_score ?? "",
    row.stress_category ?? "",
    row.estimasi_siap_label ?? row.estimasi_siap ?? "",
    row.status_label ?? row.status,
    row.insight ?? "",
    row.active_alerts ?? 0,
    row.last_seen ?? "",
  ]);

  const csv = [header, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\n");
  downloadBlob(`screenhouse-perlu-tindak-lanjut-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
