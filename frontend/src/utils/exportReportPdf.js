import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const GROUP_LABELS = {
  regency: "Kabupaten/Kota",
  district: "Kecamatan",
  village: "Kelurahan/Desa",
};

const BRAND = {
  dark: [30, 77, 43],
  mid: [22, 101, 52],
  light: [240, 253, 244],
  slate: [100, 116, 139],
  white: [255, 255, 255],
};

const STATUS_COLORS = {
  healthy: [22, 163, 74],
  warning: [245, 158, 11],
  critical: [220, 38, 38],
  offline: [148, 163, 184],
};

const FOOTER_TEXT = "Digenerate otomatis oleh BibitLive — UPTD Mektan Jabar";

function fmtDate(iso) {
  return new Date(iso).toLocaleString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

function periodLabel(days) {
  if (days === 1) return "24 jam terakhir";
  return `${days} hari terakhir`;
}

/** Satu kalimat ringkas dari data yang sudah ada di report — selaras dengan versi web. */
function buildPdfInsight(report) {
  const problematicCount = report.problematic_screenhouses?.length ?? 0;
  const terlambat = report.bibit_summary?.terlambat ?? 0;
  const topParam = report.top_alert_params?.[0]?.label;
  const delta = report.period_comparison?.alerts_delta;

  const parts = [];
  if (problematicCount > 0) parts.push(`${problematicCount} screenhouse perlu tindak lanjut`);
  if (terlambat > 0) parts.push(`${terlambat} pembibitan terlambat dari target`);

  if (!parts.length) return "Semua screenhouse dalam kondisi baik pada periode ini.";

  let text = `${parts.join(", ")}.`;
  if (topParam) text += ` Penyebab alert terbanyak: ${topParam.toLowerCase()}.`;
  if (delta != null && delta !== 0) {
    text += ` Alert ${delta > 0 ? "naik" : "turun"} ${Math.abs(delta)} dibanding periode sebelumnya.`;
  }
  return text;
}

async function loadLogoDataUrl() {
  try {
    const res = await fetch("/logo-bibitlive.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawPageHeader(doc, report, meta, logoDataUrl) {
  const w = doc.internal.pageSize.getWidth();
  const groupLabel = GROUP_LABELS[report.group_by] ?? "Wilayah";
  const filterText = meta.filterLabel || "Semua wilayah";
  const operatorName = meta.operatorName || "Operator";

  doc.setFillColor(...BRAND.dark);
  doc.rect(0, 0, w, 36, "F");
  doc.setFillColor(...BRAND.mid);
  doc.rect(0, 36, w, 2, "F");

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", 12, 6, 16, 16);
  }

  const textX = logoDataUrl ? 32 : 14;
  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("BibitLive — Laporan Wilayah", textX, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Operator: ${operatorName}`, textX, 21);
  doc.text(
    `Periode: ${periodLabel(report.period_days)}  ·  Wilayah: ${filterText}  ·  Kelompok: ${groupLabel}`,
    textX,
    27
  );
  doc.text(`Dicetak: ${fmtDate(report.generated_at)}`, textX, 33);

  return 44;
}

function drawPageFooter(doc) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
  const totalPages = doc.internal.getNumberOfPages();

  doc.setDrawColor(226, 232, 240);
  doc.line(14, h - 12, w - 14, h - 12);
  doc.setTextColor(...BRAND.slate);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(FOOTER_TEXT, 14, h - 7);
  doc.text(`Halaman ${pageNum} / ${totalPages}`, w - 14, h - 7, { align: "right" });
}

function drawExecutiveSummary(doc, report, startY) {
  const w = doc.internal.pageSize.getWidth();
  const totals = report.status_totals ?? {};
  const bibit = report.bibit_summary;

  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Ringkasan Eksekutif", 14, startY);

  const bigCards = [
    { label: "Total Screenhouse", value: String(report.kpis.total_screenhouses), color: BRAND.dark },
    { label: "Uptime 24 Jam", value: `${report.kpis.uptime_pct}%`, color: STATUS_COLORS.healthy },
    { label: "Alert Aktif", value: String(report.kpis.active_alerts), color: STATUS_COLORS.critical },
    { label: "Skor Bibit Rata-rata", value: bibit?.avg_stress_score != null ? String(Math.round(bibit.avg_stress_score)) : "—", color: BRAND.mid },
  ];

  const gap = 6;
  const cardW = (w - 28 - gap * 3) / 4;
  let x = 14;
  const y = startY + 6;

  bigCards.forEach((card) => {
    doc.setFillColor(...BRAND.light);
    doc.setDrawColor(220, 228, 220);
    doc.roundedRect(x, y, cardW, 32, 2, 2, "FD");
    doc.setFillColor(...card.color);
    doc.circle(x + 8, y + 10, 3, "F");
    doc.setTextColor(...BRAND.slate);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(card.label, x + 14, y + 11);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(card.value, x + 14, y + 24);
    x += cardW + gap;
  });

  let nextY = y + 40;

  // Kotak insight — satu kalimat ringkas, sebelum detail mentah di bawahnya.
  const insightText = buildPdfInsight(report);
  const insightLines = doc.splitTextToSize(insightText, w - 34);
  const insightH = 6 + insightLines.length * 4.5;
  doc.setFillColor(...BRAND.light);
  doc.setDrawColor(187, 240, 208);
  doc.roundedRect(14, nextY, w - 28, insightH, 2, 2, "FD");
  doc.setFillColor(...BRAND.mid);
  doc.circle(17, nextY + 4, 1.4, "F");
  doc.setFont("helvetica", "normal");
  doc.setTextColor(20, 83, 45);
  doc.text(insightLines, 24, nextY + 6);
  nextY += insightH + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.dark);
  doc.text("Status Operasional", 14, nextY);
  nextY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Sehat: ${totals.healthy ?? 0}, Peringatan: ${totals.warning ?? 0}, Kritis: ${totals.critical ?? 0}, Tidak terhubung: ${totals.offline ?? 0}`,
    14,
    nextY
  );
  nextY += 6;

  if (bibit) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.dark);
    doc.text("Progres Pembibitan", 14, nextY);
    nextY += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(
      `On track: ${bibit.on_track}  ·  Terlambat: ${bibit.terlambat}  ·  Perlu evaluasi: ${bibit.perlu_evaluasi}  ·  Belum diisi: ${bibit.belum_disi ?? 0}`,
      14,
      nextY
    );
    nextY += 6;
    if (bibit.avg_cycle_duration_days != null || bibit.most_stable_varietas) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      if (bibit.avg_cycle_duration_days != null) {
        doc.text(`Rata-rata durasi siklus: ${bibit.avg_cycle_duration_days} hari`, 14, nextY);
        nextY += 5;
      }
      if (bibit.most_stable_varietas) {
        doc.text(
          `Varietas paling stabil: ${bibit.most_stable_varietas.nama} (skor rata-rata ${Math.round(bibit.most_stable_varietas.avg_score)})`,
          14,
          nextY
        );
        nextY += 5;
      }
    }
  }

  if (report.varietas_distribution?.length) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.dark);
    doc.text("Distribusi Varietas", 14, nextY);
    nextY += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const line = report.varietas_distribution
      .map((v) => `${v.nama}: ${v.count}`)
      .join("  ·  ");
    doc.text(line, 14, nextY, { maxWidth: w - 28 });
    nextY += 8;
  }

  if (report.growth) {
    nextY = drawGrowthNote(doc, report, nextY);
  }

  if (report.period_comparison?.alerts_delta != null) {
    const delta = report.period_comparison.alerts_delta;
    const sign = delta >= 0 ? "+" : "";
    doc.setTextColor(...BRAND.slate);
    doc.text(`Perubahan alert vs periode sebelumnya: ${sign}${delta}`, 14, nextY);
  }

  return nextY + 6;
}

/**
 * Halaman lampiran — gabungan tabel mentah (status/uptime, sensor, durasi varietas)
 * yang sebelumnya tersebar di 2 halaman terpisah. Ini data pendukung, bukan sorotan utama,
 * jadi ditaruh di akhir setelah ringkasan & grafik.
 */
function drawAppendixPage(doc, report) {
  const groupLabel = GROUP_LABELS[report.group_by] ?? "Wilayah";
  let y = 48;

  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Lampiran — Data Mentah", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.slate);
  doc.text("Rincian pendukung di balik ringkasan & grafik pada halaman sebelumnya.", 14, y + 5);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND.dark);
  doc.text(`Status & Uptime per ${groupLabel}`, 14, y);

  autoTable(doc, {
    startY: y + 3,
    head: [[groupLabel, "Total", "Sehat", "Peringatan", "Kritis", "Tidak terhubung", "Waktu aktif", "Skor rata-rata"]],
    body: (report.regions ?? []).map((row) => [
      row.region_name,
      row.total,
      row.healthy,
      row.warning,
      row.critical,
      row.offline,
      `${row.uptime_pct}%`,
      row.avg_stress_score != null ? Math.round(row.avg_stress_score) : "—",
    ]),
    theme: "grid",
    headStyles: { fillColor: BRAND.dark, textColor: BRAND.white, fontSize: 7.5, halign: "center" },
    bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 52 },
      1: { halign: "center" },
      2: { halign: "center", textColor: STATUS_COLORS.healthy },
      3: { halign: "center", textColor: STATUS_COLORS.warning },
      4: { halign: "center", textColor: STATUS_COLORS.critical },
      5: { halign: "center", textColor: STATUS_COLORS.offline },
      6: { halign: "center" },
      7: { halign: "center", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND.dark);
  doc.text(`Data Sensor Rata-rata per ${groupLabel}`, 14, y);

  autoTable(doc, {
    startY: y + 3,
    head: [[groupLabel, "N", "P", "K", "Kelembapan", "Suhu tanah", "Alert"]],
    body: (report.regions ?? []).map((row) => [
      row.region_name,
      row.sensor_avg?.nitrogen ?? "—",
      row.sensor_avg?.phosphorus ?? "—",
      row.sensor_avg?.potassium ?? "—",
      row.sensor_avg?.soil_moisture != null ? `${row.sensor_avg.soil_moisture}%` : "—",
      row.sensor_avg?.soil_temperature != null ? `${row.sensor_avg.soil_temperature}°C` : "—",
      row.active_alerts,
    ]),
    theme: "grid",
    headStyles: { fillColor: BRAND.mid, textColor: BRAND.white, fontSize: 7.5, halign: "center" },
    bodyStyles: { fontSize: 7.5 },
    margin: { left: 14, right: 14 },
  });

  if (report.varietas_duration_stats?.length) {
    y = doc.lastAutoTable.finalY + 8;
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 48;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...BRAND.dark);
    doc.text("Durasi Pembibitan Aktual vs Standar Biologis (per Varietas)", 14, y);

    autoTable(doc, {
      startY: y + 3,
      head: [["Varietas", "Screenhouse", "Rata-rata aktual", "Standar biologis", "Indeks keterlambatan"]],
      body: report.varietas_duration_stats.map((row) => [
        row.nama,
        row.screenhouse_count,
        row.avg_actual_days != null ? `${row.avg_actual_days} hari` : "—",
        row.avg_standard_days != null ? `${row.avg_standard_days} hari` : "—",
        row.delay_index_days == null
          ? "—"
          : `${row.delay_index_days > 0 ? "+" : ""}${row.delay_index_days} hari`,
      ]),
      theme: "grid",
      headStyles: { fillColor: BRAND.mid, textColor: BRAND.white, fontSize: 7.5, halign: "center" },
      bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
      columnStyles: {
        0: { fontStyle: "bold" },
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section !== "body" || data.column.index !== 4) return;
        const raw = report.varietas_duration_stats[data.row.index]?.delay_index_days;
        if (raw > 0) data.cell.styles.textColor = STATUS_COLORS.warning;
        else if (raw < 0) data.cell.styles.textColor = STATUS_COLORS.healthy;
      },
      margin: { left: 14, right: 14 },
    });
  }
}

const SEVERITY_ORDER = { critical: 0, offline: 1, warning: 2, healthy: 3 };

function drawProblematicTablePage(doc, report) {
  const y = 48;
  const items = [...(report.problematic_screenhouses ?? [])].sort(
    (a, b) => (SEVERITY_ORDER[a.status] ?? 9) - (SEVERITY_ORDER[b.status] ?? 9)
  );

  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Screenhouse Perlu Tindak Lanjut", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.slate);
  doc.text("Diurutkan dari paling mendesak — garis warna di kiri menandai tingkat keparahan.", 14, y + 5);

  if (!items.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.slate);
    doc.text("Tidak ada screenhouse yang memerlukan tindak lanjut prioritas.", 14, y + 14);
    return;
  }

  autoTable(doc, {
    startY: y + 9,
    head: [["Screenhouse", "Petani", "Telepon", "Varietas", "Skor", "Estimasi siap", "Status", "Alert"]],
    body: items.map((row) => [
      row.name,
      row.owner_name ?? "—",
      row.owner_phone ?? "—",
      row.varietas_nama ?? "—",
      row.stress_score != null ? `${row.stress_score}${row.stress_category ? ` (${row.stress_category})` : ""}` : "—",
      row.estimasi_siap_label ?? "—",
      row.status_label ?? row.status,
      row.active_alerts ?? 0,
    ]),
    theme: "grid",
    headStyles: { fillColor: [185, 28, 28], textColor: BRAND.white, fontSize: 7.5, halign: "center" },
    bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: "bold" },
      1: { cellWidth: 32 },
      2: { cellWidth: 28 },
      3: { cellWidth: 26 },
      4: { halign: "center", cellWidth: 22 },
      5: { cellWidth: 36 },
      6: { halign: "center", cellWidth: 22 },
      7: { halign: "center", cellWidth: 14 },
    },
    margin: { left: 14, right: 14 },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const row = items[data.row.index];
      const color = STATUS_COLORS[row?.status] ?? BRAND.slate;
      doc.setFillColor(...color);
      doc.rect(data.cell.x, data.cell.y, 1.4, data.cell.height, "F");
    },
  });
}

function drawHorizontalBarChart(doc, {
  startY,
  items,
  valueKey = "count",
  labelKey = "name",
  barColor = [37, 99, 235],
  maxBarW = null,
  valueSuffix = "",
}) {
  if (!items.length) return startY;

  const pageW = doc.internal.pageSize.getWidth();
  const chartX = 14;
  const chartW = maxBarW ?? pageW - 28;
  const rowH = 10;
  const labelW = 52;
  const barAreaW = chartW - labelW - 16;
  const maxVal = Math.max(...items.map((i) => Number(i[valueKey]) || 0), 1);
  let y = startY;

  items.forEach((item) => {
    const val = Number(item[valueKey]) || 0;
    const label = String(item[labelKey] ?? "");
    const barW = (val / maxVal) * barAreaW;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(label.length > 22 ? `${label.slice(0, 20)}…` : label, chartX, y + 6);

    const barX = chartX + labelW;
    doc.setFillColor(241, 245, 249);
    doc.rect(barX, y, barAreaW, 7, "F");
    if (val > 0) {
      doc.setFillColor(...barColor);
      doc.rect(barX, y, Math.max(barW, 2), 7, "F");
      doc.setTextColor(51, 65, 85);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(`${val}${valueSuffix}`, barX + barW + 2, y + 5);
    }
    y += rowH;
  });

  return y + 4;
}

function drawVerticalBarChart(doc, {
  startY,
  items,
  valueKey = "count",
  labelKey = "name",
  barColor = [37, 99, 235],
  chartH = 55,
  valueSuffix = "",
}) {
  if (!items.length) return startY;

  const pageW = doc.internal.pageSize.getWidth();
  const chartX = 14;
  const chartW = pageW - 28;
  const chartY = startY;
  const maxVal = Math.max(...items.map((i) => Number(i[valueKey]) || 0), 1);
  const barGap = 3;
  const barW = Math.max(6, (chartW - barGap * (items.length - 1)) / items.length);

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.rect(chartX, chartY, chartW, chartH, "FD");

  items.forEach((item, i) => {
    const val = Number(item[valueKey]) || 0;
    const barH = (val / maxVal) * (chartH - 14);
    const bx = chartX + i * (barW + barGap);
    const by = chartY + chartH - barH - 8;

    if (val > 0) {
      doc.setFillColor(...barColor);
      doc.rect(bx, by, barW, barH, "F");
      doc.setTextColor(51, 65, 85);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.text(`${val}${valueSuffix}`, bx + barW / 2, by - 1.5, { align: "center" });
    }

    doc.setTextColor(...BRAND.slate);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    const label = String(item[labelKey] ?? "");
    doc.text(
      label.length > 8 ? `${label.slice(0, 7)}…` : label,
      bx + barW / 2,
      chartY + chartH - 2,
      { align: "center" }
    );
  });

  return chartY + chartH + 8;
}

function drawStackedStatusChart(doc, report, startY) {
  const regions = (report.regions ?? []).slice(0, 8);
  if (!regions.length) return startY;

  const pageW = doc.internal.pageSize.getWidth();
  const chartX = 14;
  const labelW = 48;
  const barAreaW = pageW - 28 - labelW - 8;
  const rowH = 11;
  let y = startY;

  const segments = [
    { key: "healthy", color: STATUS_COLORS.healthy },
    { key: "warning", color: STATUS_COLORS.warning },
    { key: "critical", color: STATUS_COLORS.critical },
    { key: "offline", color: STATUS_COLORS.offline },
  ];

  regions.forEach((row) => {
    const total = row.total || 1;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    const name = row.region_name.length > 18 ? `${row.region_name.slice(0, 16)}…` : row.region_name;
    doc.text(name, chartX, y + 6);

    let x = chartX + labelW;
    segments.forEach((seg) => {
      const val = row[seg.key] ?? 0;
      const w = (val / total) * barAreaW;
      if (val > 0) {
        doc.setFillColor(...seg.color);
        doc.rect(x, y, Math.max(w, 2), 7, "F");
        if (w >= 8) {
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6);
          doc.text(String(val), x + w / 2, y + 5, { align: "center" });
        }
        x += w;
      }
    });
    y += rowH;
  });

  return y + 4;
}

function drawChartsPage(doc, report) {
  let y = 48;
  const groupLabel = GROUP_LABELS[report.group_by] ?? "Wilayah";

  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Grafik Ringkasan", 14, y);
  y += 8;

  if (report.varietas_distribution?.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Distribusi Varietas", 14, y);
    y += 5;
    y = drawHorizontalBarChart(doc, {
      startY: y,
      items: report.varietas_distribution.map((v) => ({ name: v.nama, count: v.count })),
      barColor: BRAND.mid,
    });
    y += 4;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Status Screenhouse per ${groupLabel}`, 14, y);
  y += 5;
  y = drawStackedStatusChart(doc, report, y);
  y += 6;

  const sensorRows = (report.regions ?? [])
    .filter((r) => r.sensor_avg?.soil_moisture != null || r.sensor_avg?.soil_temperature != null)
    .slice(0, 8)
    .map((r) => ({
      name: r.region_name,
      moisture: r.sensor_avg?.soil_moisture,
      temp: r.sensor_avg?.soil_temperature,
    }));

  if (sensorRows.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Rata-rata Kelembapan Tanah (%)", 14, y);
    y += 5;
    y = drawVerticalBarChart(doc, {
      startY: y,
      items: sensorRows.map((r) => ({ name: r.name, count: r.moisture ?? 0 })),
      barColor: [37, 99, 235],
      valueSuffix: "%",
    });
    y += 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Rata-rata Suhu Tanah (°C)", 14, y);
    y += 5;
    y = drawVerticalBarChart(doc, {
      startY: y,
      items: sensorRows.map((r) => ({ name: r.name, count: r.temp ?? 0 })),
      barColor: [217, 119, 6],
      valueSuffix: "°C",
    });
    y += 4;
  }

  if (report.top_alert_params?.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Parameter Alert Terbanyak", 14, y);
    y += 5;
    drawHorizontalBarChart(doc, {
      startY: y,
      items: report.top_alert_params.map((p) => ({ name: p.label, count: p.count })),
      barColor: STATUS_COLORS.critical,
    });
  }
}

function drawGrowthNote(doc, report, startY) {
  const growth = report.growth;
  if (!growth) return startY;

  const hasActivity =
    growth.new_screenhouses > 0 ||
    growth.farmers_approved > 0 ||
    growth.farmers_pending > 0 ||
    growth.farmers_rejected > 0;
  if (!hasActivity) return startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.dark);
  doc.text("Aktivitas Registrasi dalam Periode", 14, startY);
  let y = startY + 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Unit screenhouse terdaftar: ${growth.new_screenhouses}  ·  Akun petani disetujui: ${growth.farmers_approved}  ·  Menunggu: ${growth.farmers_pending}  ·  Ditolak: ${growth.farmers_rejected ?? 0}`,
    14,
    y,
    { maxWidth: doc.internal.pageSize.getWidth() - 28 }
  );
  y += 5;
  if (growth.distinct_petani_owners > 0) {
    doc.text(`Terhubung ke ${growth.distinct_petani_owners} petani`, 14, y);
    y += 5;
  }
  if (growth.note) {
    doc.setTextColor(...BRAND.slate);
    doc.text(growth.note, 14, y, { maxWidth: doc.internal.pageSize.getWidth() - 28 });
    y += 8;
  }
  return y + 2;
}

function drawAlertTrendPage(doc, report) {
  const trend = report.alert_trend ?? [];
  const y = 48;

  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Tren Alert Harian (${periodLabel(report.period_days)})`, 14, y);

  if (!trend.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.slate);
    doc.text("Belum ada alert dalam periode ini.", 14, y + 8);
    return;
  }

  const maxCount = Math.max(...trend.map((t) => t.count), 1);
  const chartX = 14;
  const chartY = y + 10;
  const chartW = doc.internal.pageSize.getWidth() - 28;
  const chartH = 70;
  const barGap = 2;
  const barW = Math.max(4, (chartW - barGap * (trend.length - 1)) / trend.length);

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.rect(chartX, chartY, chartW, chartH, "FD");

  trend.forEach((row, i) => {
    const barH = (row.count / maxCount) * (chartH - 16);
    const bx = chartX + i * (barW + barGap);
    const by = chartY + chartH - barH - 8;
    doc.setFillColor(220, 38, 38);
    doc.rect(bx, by, barW, barH, "F");
    doc.setTextColor(...BRAND.slate);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    const label = new Date(row.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    doc.text(label, bx + barW / 2, chartY + chartH - 2, { align: "center" });
    if (row.count > 0) {
      doc.setTextColor(51, 65, 85);
      doc.text(String(row.count), bx + barW / 2, by - 1.5, { align: "center" });
    }
  });

  autoTable(doc, {
    startY: chartY + chartH + 8,
    head: [["Tanggal", "Jumlah Alert"]],
    body: trend.map((row) => [
      new Date(row.date).toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      row.count,
    ]),
    theme: "striped",
    headStyles: { fillColor: BRAND.dark, textColor: BRAND.white, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });
}

export async function exportOperatorReportPdf(report, meta = {}) {
  if (!report?.regions?.length) return false;

  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setPage(1);
  drawExecutiveSummary(doc, report, drawPageHeader(doc, report, meta, logoDataUrl));
  drawPageFooter(doc);

  doc.addPage();
  drawPageHeader(doc, report, meta, logoDataUrl);
  drawProblematicTablePage(doc, report);
  drawPageFooter(doc);

  doc.addPage();
  drawPageHeader(doc, report, meta, logoDataUrl);
  drawChartsPage(doc, report);
  drawPageFooter(doc);

  doc.addPage();
  drawPageHeader(doc, report, meta, logoDataUrl);
  drawAlertTrendPage(doc, report);
  drawPageFooter(doc);

  doc.addPage();
  drawPageHeader(doc, report, meta, logoDataUrl);
  drawAppendixPage(doc, report);
  drawPageFooter(doc);

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`laporan-bibitlive-wilayah-${stamp}.pdf`);
  return true;
}
