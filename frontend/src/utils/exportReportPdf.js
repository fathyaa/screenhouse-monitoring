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

function fmtDate(iso) {
  return new Date(iso).toLocaleString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function periodLabel(days) {
  if (days === 1) return "24 jam terakhir";
  return `${days} hari terakhir`;
}

function drawHeader(doc, report) {
  const w = doc.internal.pageSize.getWidth();
  const groupLabel = GROUP_LABELS[report.group_by] ?? "Wilayah";

  doc.setFillColor(...BRAND.dark);
  doc.rect(0, 0, w, 42, "F");

  doc.setFillColor(...BRAND.mid);
  doc.rect(0, 42, w, 3, "F");

  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Laporan Monitoring Screenhouse Wilayah", 14, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Sistem Monitoring Screenhouse · UPTD Mekanisasi Pertanian", 14, 24);

  doc.setFontSize(8.5);
  doc.text(
    `Periode: ${periodLabel(report.period_days)}  ·  Kelompokkan per: ${groupLabel}  ·  Dicetak: ${fmtDate(report.generated_at)}`,
    14,
    33
  );

  return 52;
}

function drawKpiCards(doc, report, startY) {
  const w = doc.internal.pageSize.getWidth();
  const cards = [
    {
      label: "Total Screenhouse",
      value: String(report.kpis.total_screenhouses),
      sub: "unit terpantau",
      color: BRAND.dark,
    },
    {
      label: "Uptime 24 Jam",
      value: `${report.kpis.uptime_pct}%`,
      sub: "mengirim data",
      color: STATUS_COLORS.healthy,
    },
    {
      label: "Alert Aktif",
      value: String(report.kpis.active_alerts),
      sub: `${report.kpis.alert_count_period} di periode`,
      color: report.kpis.active_alerts > 0 ? STATUS_COLORS.critical : BRAND.slate,
    },
    {
      label: "Offline",
      value: String(report.kpis.offline_count),
      sub: "tidak ada data baru",
      color: report.kpis.offline_count > 0 ? STATUS_COLORS.warning : BRAND.slate,
    },
  ];

  const gap = 4;
  const cardW = (w - 28 - gap * 3) / 4;
  const cardH = 28;
  let x = 14;

  cards.forEach((card) => {
    doc.setFillColor(...BRAND.light);
    doc.setDrawColor(220, 228, 220);
    doc.roundedRect(x, startY, cardW, cardH, 2, 2, "FD");

    doc.setFillColor(...card.color);
    doc.circle(x + 6, startY + 8, 2.5, "F");

    doc.setTextColor(...BRAND.slate);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(card.label, x + 11, startY + 9);

    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(card.value, x + 11, startY + 19);

    doc.setTextColor(...BRAND.slate);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(card.sub, x + 11, startY + 24);

    x += cardW + gap;
  });

  return startY + cardH + 8;
}

function drawStatusSummary(doc, report, startY) {
  const totals = report.status_totals ?? {};
  const items = [
    { key: "healthy", label: "Sehat" },
    { key: "warning", label: "Peringatan" },
    { key: "critical", label: "Kritis" },
    { key: "offline", label: "Offline" },
  ];

  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Ringkasan Status Keseluruhan", 14, startY);

  let x = 14;
  const y = startY + 6;
  items.forEach((item) => {
    const count = totals[item.key] ?? 0;
    const color = STATUS_COLORS[item.key];

    doc.setFillColor(...color);
    doc.roundedRect(x, y, 3, 3, 0.5, 0.5, "F");

    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${item.label}: `, x + 5, y + 2.5);

    doc.setFont("helvetica", "bold");
    doc.text(String(count), x + 5 + doc.getTextWidth(`${item.label}: `), y + 2.5);

    x += 38;
  });

  if (report.period_comparison?.alerts_delta != null) {
    const delta = report.period_comparison.alerts_delta;
    const sign = delta >= 0 ? "+" : "";
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.slate);
    doc.text(
      `Perubahan alert vs periode sebelumnya: ${sign}${delta}`,
      14,
      y + 8
    );
    return y + 14;
  }

  return y + 10;
}

function drawRegionTable(doc, report, startY) {
  const groupLabel = GROUP_LABELS[report.group_by] ?? "Wilayah";

  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Detail per ${groupLabel}`, 14, startY);

  const head = [
    [
      groupLabel,
      "Total",
      "Sehat",
      "Peringatan",
      "Kritis",
      "Offline",
      "Uptime",
      "Alert",
      "Kelembapan",
      "Suhu Tanah",
    ],
  ];

  const body = report.regions.map((row) => [
    row.region_name,
    row.total,
    row.healthy,
    row.warning,
    row.critical,
    row.offline,
    `${row.uptime_pct}%`,
    row.active_alerts,
    row.sensor_avg?.soil_moisture != null ? `${row.sensor_avg.soil_moisture}%` : "—",
    row.sensor_avg?.soil_temperature != null ? `${row.sensor_avg.soil_temperature}°C` : "—",
  ]);

  autoTable(doc, {
    startY: startY + 4,
    head,
    body,
    theme: "grid",
    headStyles: {
      fillColor: BRAND.dark,
      textColor: BRAND.white,
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85],
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold", cellWidth: 36 },
      1: { halign: "center" },
      2: { halign: "center", textColor: STATUS_COLORS.healthy },
      3: { halign: "center", textColor: STATUS_COLORS.warning },
      4: { halign: "center", textColor: STATUS_COLORS.critical },
      5: { halign: "center", textColor: STATUS_COLORS.offline },
      6: { halign: "center" },
      7: { halign: "center" },
      8: { halign: "center" },
      9: { halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  return doc.lastAutoTable.finalY + 8;
}

function drawAlertParamsTable(doc, report, startY) {
  if (!report.top_alert_params?.length) return startY;

  const pageH = doc.internal.pageSize.getHeight();
  if (startY > pageH - 60) {
    doc.addPage();
    startY = 20;
  }

  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Parameter Alert Terbanyak", 14, startY);

  autoTable(doc, {
    startY: startY + 4,
    head: [["Parameter", "Jumlah Alert", "Keterangan"]],
    body: report.top_alert_params.map((p, i) => [
      p.label,
      p.count,
      i === 0 ? "Prioritas tindak lanjut" : "—",
    ]),
    theme: "striped",
    headStyles: {
      fillColor: [220, 38, 38],
      textColor: BRAND.white,
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { halign: "center", fontStyle: "bold" },
      2: { textColor: BRAND.slate, fontSize: 7 },
    },
    margin: { left: 14, right: 14 },
  });

  return doc.lastAutoTable.finalY + 8;
}

function drawGrowthSection(doc, report, startY) {
  const g = report.growth;
  if (!g || (g.new_screenhouses === 0 && g.farmers_approved === 0 && g.farmers_pending === 0)) {
    return startY;
  }

  const pageH = doc.internal.pageSize.getHeight();
  if (startY > pageH - 40) {
    doc.addPage();
    startY = 20;
  }

  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Pertumbuhan & Operasional", 14, startY);

  autoTable(doc, {
    startY: startY + 4,
    head: [["Indikator", "Jumlah"]],
    body: [
      ["Screenhouse baru terdaftar", g.new_screenhouses],
      ["Petani disetujui", g.farmers_approved],
      ["Petani menunggu approval", g.farmers_pending],
      ["Petani ditolak", g.farmers_rejected ?? 0],
    ],
    theme: "plain",
    headStyles: {
      fillColor: BRAND.mid,
      textColor: BRAND.white,
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: "center", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  return doc.lastAutoTable.finalY + 8;
}

function drawFooter(doc, pageNum, totalPages) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  doc.setDrawColor(226, 232, 240);
  doc.line(14, h - 14, w - 14, h - 14);

  doc.setTextColor(...BRAND.slate);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Dokumen resmi · Sistem Monitoring Screenhouse", 14, h - 8);
  doc.text(`Halaman ${pageNum} dari ${totalPages}`, w - 14, h - 8, { align: "right" });
}

function drawDisclaimer(doc, startY) {
  const pageH = doc.internal.pageSize.getHeight();
  if (startY > pageH - 30) {
    doc.addPage();
    startY = 20;
  }

  doc.setFillColor(...BRAND.light);
  doc.setDrawColor(187, 247, 208);
  const w = doc.internal.pageSize.getWidth();
  doc.roundedRect(14, startY, w - 28, 18, 2, 2, "FD");

  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Catatan", 18, startY + 6);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7);
  const note =
    "Laporan ini dihasilkan otomatis dari data sensor realtime. Uptime dihitung dari screenhouse yang mengirim data dalam 24 jam terakhir. " +
    "Status sehat/peringatan/kritis mengacu pada threshold yang telah ditetapkan per screenhouse.";
  doc.text(note, 18, startY + 11, { maxWidth: w - 36 });
}

export function exportOperatorReportPdf(report) {
  if (!report?.regions?.length) return false;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  let y = drawHeader(doc, report);
  y = drawKpiCards(doc, report, y);
  y = drawStatusSummary(doc, report, y);
  y = drawRegionTable(doc, report, y);
  y = drawAlertParamsTable(doc, report, y);
  y = drawGrowthSection(doc, report, y);
  drawDisclaimer(doc, y);

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    drawFooter(doc, i, totalPages);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`laporan-screenhouse-wilayah-${stamp}.pdf`);
  return true;
}
