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

// --- Konstanta layout cetak (A4 landscape) ---------------------------------
// MARGIN dinaikkan ke 20mm (dari 14mm) sesuai standar laporan akademik/resmi.
// HEADER_BOTTOM = garis akhir letterhead; CONTENT_TOP = titik mulai isi di
// halaman lanjutan; FOOTER_RESERVE = pita bawah untuk footer + margin.
const MARGIN = 20;
const HEADER_BOTTOM = 38; // y tempat isi halaman pertama sebuah section mulai
const CONTENT_TOP = 48; // y mulai isi pada halaman lanjutan (beri jarak dari header)
const FOOTER_RESERVE = 20; // sisakan >=20mm di bawah untuk footer & margin

function contentBottom(doc) {
  return doc.internal.pageSize.getHeight() - FOOTER_RESERVE;
}
function contentWidth(doc) {
  return doc.internal.pageSize.getWidth() - MARGIN * 2;
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

// --- Mesin paginasi --------------------------------------------------------
// ctx menyimpan report/meta/logo supaya helper bisa menambah halaman baru
// (lengkap dengan letterhead) tanpa harus dioper argumen berulang.

/** Tambah halaman baru + gambar header, kembalikan y mulai isi. */
function startNewPage(doc, ctx) {
  doc.addPage();
  drawPageHeader(doc, ctx.report, ctx.meta, ctx.logo);
  return CONTENT_TOP;
}

/**
 * Pastikan ada ruang `needed` mm sebelum menggambar blok berikutnya.
 * Kalau tidak muat, pindah ke halaman baru dan kembalikan y baru — ini yang
 * mencegah kartu KPI / grafik / judul section terpotong di batas halaman.
 */
function ensureSpace(doc, ctx, y, needed) {
  if (y + needed > contentBottom(doc)) return startNewPage(doc, ctx);
  return y;
}

function drawPageHeader(doc, report, meta, logoDataUrl) {
  const w = doc.internal.pageSize.getWidth();
  const groupLabel = GROUP_LABELS[report.group_by] ?? "Wilayah";
  const filterText = meta.filterLabel || "Semua wilayah";
  const operatorName = meta.operatorName || "Operator";

  // Letterhead ringkas ala laporan resmi: latar putih, aksen tipis, logo + judul
  // di kiri, blok metadata rata-kanan, ditutup garis pemisah.
  doc.setFillColor(...BRAND.dark);
  doc.rect(0, 0, w, 3, "F");

  const leftX = MARGIN;
  let textX = leftX;
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", leftX, 8, 15, 15);
    textX = leftX + 19;
  }

  // Eyebrow instansi
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.slate);
  doc.text("BIBITLIVE  ·  UPTD MEKANISASI PERTANIAN — JAWA BARAT", textX, 11);

  // Judul dokumen
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...BRAND.dark);
  doc.text("Laporan Monitoring Wilayah", textX, 18);

  // Sub-judul program
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.mid);
  doc.text("Program IP400 — Pembibitan Padi", textX, 23.5);

  // Blok metadata rata-kanan (label + nilai). Tanggal diringkas agar tak menabrak label.
  const printedAt = new Date(report.generated_at).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  const metaRows = [
    ["Periode", periodLabel(report.period_days)],
    ["Wilayah", filterText],
    ["Kelompok", groupLabel],
    ["Operator", operatorName],
    ["Dicetak", printedAt],
  ];
  const rightX = w - MARGIN;
  const labelX = rightX - 58;
  let my = 9;
  metaRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...BRAND.slate);
    doc.text(label.toUpperCase(), labelX, my);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(String(value), rightX, my, { align: "right", maxWidth: 42 });
    my += 3.9;
  });

  // Garis pemisah
  const ruleY = 28;
  doc.setDrawColor(...BRAND.dark);
  doc.setLineWidth(0.6);
  doc.line(leftX, ruleY, w - MARGIN, ruleY);
  doc.setLineWidth(0.2);
  doc.setDrawColor(...BRAND.mid);
  doc.line(leftX, ruleY + 0.9, w - MARGIN, ruleY + 0.9);

  return HEADER_BOTTOM;
}

function drawPageFooter(doc) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
  const totalPages = doc.internal.getNumberOfPages();

  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN, h - 12, w - MARGIN, h - 12);
  doc.setTextColor(...BRAND.slate);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(FOOTER_TEXT, MARGIN, h - 7);
  doc.text(`Halaman ${pageNum} / ${totalPages}`, w - MARGIN, h - 7, { align: "right" });
}

/** Opsi autoTable standar: margin 20mm, header letterhead pada tiap halaman,
 *  header kolom diulang, dan baris tidak dipecah antar halaman. */
function tableDefaults(doc, ctx) {
  return {
    margin: { left: MARGIN, right: MARGIN, top: CONTENT_TOP, bottom: FOOTER_RESERVE },
    rowPageBreak: "avoid", // jangan pecah satu baris ke dua halaman
    showHead: "everyPage", // ulang header kolom di tiap halaman
    styles: { overflow: "linebreak" }, // bungkus teks panjang otomatis
    // Letterhead ikut tergambar di halaman lanjutan yang dibuat autoTable.
    didDrawPage: () => drawPageHeader(doc, ctx.report, ctx.meta, ctx.logo),
  };
}

function drawExecutiveSummary(doc, ctx, startY) {
  const report = ctx.report;
  const w = doc.internal.pageSize.getWidth();
  const totals = report.status_totals ?? {};
  const bibit = report.bibit_summary;

  let y = ensureSpace(doc, ctx, startY, 46); // judul + baris kartu KPI (32) utuh
  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Ringkasan Eksekutif", MARGIN, y);

  const kpis = report.kpis ?? {};
  const bigCards = [
    {
      label: `Kesiapan Tepat Waktu (target ${kpis.target_readiness_pct ?? 90}%)`,
      value: kpis.on_time_readiness_pct != null ? `${kpis.on_time_readiness_pct}%` : "—",
      color:
        kpis.on_time_readiness_pct == null
          ? BRAND.mid
          : kpis.on_time_readiness_pct >= (kpis.target_readiness_pct ?? 90)
          ? STATUS_COLORS.healthy
          : STATUS_COLORS.critical,
    },
    { label: "Siap <= 14 Hari", value: String(kpis.ready_within_14d ?? 0), color: BRAND.dark },
    { label: "Terlambat / Perlu Evaluasi", value: String(kpis.behind_count ?? 0), color: STATUS_COLORS.warning },
    { label: "Uptime Perangkat", value: `${kpis.uptime_pct}%`, color: BRAND.mid },
  ];

  const gap = 6;
  const cardW = (contentWidth(doc) - gap * 3) / 4;
  let x = MARGIN;
  const cardsY = y + 6;

  bigCards.forEach((card) => {
    doc.setFillColor(...BRAND.light);
    doc.setDrawColor(220, 228, 220);
    doc.roundedRect(x, cardsY, cardW, 32, 2, 2, "FD");
    doc.setFillColor(...card.color);
    doc.circle(x + 8, cardsY + 10, 3, "F");
    doc.setTextColor(...BRAND.slate);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(card.label, x + 14, cardsY + 11, { maxWidth: cardW - 16 });
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(card.value, x + 14, cardsY + 24);
    x += cardW + gap;
  });

  let nextY = cardsY + 40;

  // Kotak insight — satu kalimat ringkas, sebelum detail mentah di bawahnya.
  // PENTING: set fontSize dulu; kalau tidak, teks mewarisi 22pt dari kartu KPI
  // di atas → meluber dan menabrak section berikutnya.
  const insightText = buildPdfInsight(report);
  const INSIGHT_FS = 9.5;
  const INSIGHT_LH = 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(INSIGHT_FS);
  const insightLines = doc.splitTextToSize(insightText, w - MARGIN * 2 - 12);
  const insightH = Math.max(12, 5 + insightLines.length * INSIGHT_LH);
  nextY = ensureSpace(doc, ctx, nextY, insightH + 6);
  doc.setFillColor(...BRAND.light);
  doc.setDrawColor(187, 240, 208);
  doc.roundedRect(MARGIN, nextY, contentWidth(doc), insightH, 2, 2, "FD");
  doc.setFillColor(...BRAND.mid);
  doc.circle(MARGIN + 5, nextY + insightH / 2, 1.4, "F");
  doc.setTextColor(20, 83, 45);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(INSIGHT_FS);
  doc.text(insightLines, MARGIN + 10, nextY + 5.5, { lineHeightFactor: INSIGHT_LH / 3.5 });
  nextY += insightH + 6;

  nextY = ensureSpace(doc, ctx, nextY, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.dark);
  doc.text("Status Operasional", MARGIN, nextY);
  nextY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Sehat: ${totals.healthy ?? 0}, Peringatan: ${totals.warning ?? 0}, Kritis: ${totals.critical ?? 0}, Tidak terhubung: ${totals.offline ?? 0}`,
    MARGIN,
    nextY
  );
  nextY += 6;

  if (bibit) {
    nextY = ensureSpace(doc, ctx, nextY, 22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.dark);
    doc.text("Progres Pembibitan", MARGIN, nextY);
    nextY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(
      `On track: ${bibit.on_track}  ·  Terlambat: ${bibit.terlambat}  ·  Perlu evaluasi: ${bibit.perlu_evaluasi}  ·  Belum diisi: ${bibit.belum_disi ?? 0}`,
      MARGIN,
      nextY
    );
    nextY += 6;
    if (bibit.avg_cycle_duration_days != null || bibit.most_stable_varietas) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      if (bibit.avg_cycle_duration_days != null) {
        nextY = ensureSpace(doc, ctx, nextY, 6);
        doc.text(`Rata-rata durasi siklus: ${bibit.avg_cycle_duration_days} hari`, MARGIN, nextY);
        nextY += 5;
      }
      if (bibit.most_stable_varietas) {
        nextY = ensureSpace(doc, ctx, nextY, 6);
        doc.text(
          `Varietas paling stabil: ${bibit.most_stable_varietas.nama} (skor rata-rata ${Math.round(bibit.most_stable_varietas.avg_score)})`,
          MARGIN,
          nextY
        );
        nextY += 5;
      }
    }
  }

  if (report.varietas_distribution?.length) {
    nextY = ensureSpace(doc, ctx, nextY, 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.dark);
    doc.text("Distribusi Varietas", MARGIN, nextY);
    nextY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const line = report.varietas_distribution
      .map((v) => `${v.nama}: ${v.count}`)
      .join("  ·  ");
    const distLines = doc.splitTextToSize(line, contentWidth(doc));
    doc.text(distLines, MARGIN, nextY);
    nextY += distLines.length * 5 + 3;
  }

  if (report.growth) {
    nextY = drawGrowthNote(doc, ctx, nextY);
  }

  if (report.period_comparison?.alerts_delta != null) {
    const delta = report.period_comparison.alerts_delta;
    const sign = delta >= 0 ? "+" : "";
    nextY = ensureSpace(doc, ctx, nextY, 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND.slate);
    doc.text(`Perubahan alert vs periode sebelumnya: ${sign}${delta}`, MARGIN, nextY);
    nextY += 5;
  }

  return nextY + 6;
}

/**
 * Halaman lampiran — gabungan tabel mentah (status/uptime, sensor, durasi varietas)
 * yang sebelumnya tersebar di 2 halaman terpisah. Ini data pendukung, bukan sorotan utama,
 * jadi ditaruh di akhir setelah ringkasan & grafik.
 */
function drawAppendixPage(doc, ctx) {
  const report = ctx.report;
  const groupLabel = GROUP_LABELS[report.group_by] ?? "Wilayah";
  let y = CONTENT_TOP;

  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Lampiran — Data Mentah", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.slate);
  doc.text("Rincian pendukung di balik ringkasan & grafik pada halaman sebelumnya.", MARGIN, y + 5);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND.dark);
  doc.text(`Status & Uptime per ${groupLabel}`, MARGIN, y);

  autoTable(doc, {
    ...tableDefaults(doc, ctx),
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
  });

  y = doc.lastAutoTable.finalY + 8;
  y = ensureSpace(doc, ctx, y, 20); // judul + minimal header tabel berikutnya

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND.dark);
  doc.text(`Data Sensor Rata-rata per ${groupLabel}`, MARGIN, y);

  autoTable(doc, {
    ...tableDefaults(doc, ctx),
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
    columnStyles: { 0: { cellWidth: 52 } },
  });

  if (report.varietas_duration_stats?.length) {
    y = doc.lastAutoTable.finalY + 8;
    y = ensureSpace(doc, ctx, y, 20);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...BRAND.dark);
    doc.text("Durasi Pembibitan (dari Siklus Selesai) vs Target (per Varietas)", MARGIN, y);

    autoTable(doc, {
      ...tableDefaults(doc, ctx),
      startY: y + 3,
      head: [["Varietas", "Siklus selesai", "Rata-rata aktual", "Target", "Selisih"]],
      body: report.varietas_duration_stats.map((row) => [
        row.nama,
        row.cycle_count,
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
    });
  }
}

const SEVERITY_ORDER = { critical: 0, offline: 1, warning: 2, healthy: 3 };

function drawProblematicTablePage(doc, ctx) {
  const report = ctx.report;
  const y = CONTENT_TOP;
  const items = [...(report.problematic_screenhouses ?? [])].sort(
    (a, b) => (SEVERITY_ORDER[a.status] ?? 9) - (SEVERITY_ORDER[b.status] ?? 9)
  );

  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Screenhouse Perlu Tindak Lanjut", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.slate);
  doc.text("Diurutkan dari paling mendesak — garis warna di kiri menandai tingkat keparahan.", MARGIN, y + 5);

  if (!items.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.slate);
    doc.text("Tidak ada screenhouse yang memerlukan tindak lanjut prioritas.", MARGIN, y + 14);
    return;
  }

  autoTable(doc, {
    ...tableDefaults(doc, ctx),
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
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const row = items[data.row.index];
      const color = STATUS_COLORS[row?.status] ?? BRAND.slate;
      doc.setFillColor(...color);
      doc.rect(data.cell.x, data.cell.y, 1.4, data.cell.height, "F");
    },
  });
}

function drawHorizontalBarChart(doc, ctx, {
  startY,
  items,
  valueKey = "count",
  labelKey = "name",
  barColor = [37, 99, 235],
  valueSuffix = "",
}) {
  if (!items.length) return startY;

  const chartX = MARGIN;
  const rowH = 10;
  const labelW = 52;
  const barAreaW = contentWidth(doc) - labelW - 16;
  const maxVal = Math.max(...items.map((i) => Number(i[valueKey]) || 0), 1);
  let y = startY;

  items.forEach((item) => {
    // Bar per baris tidak boleh terpotong di batas halaman.
    y = ensureSpace(doc, ctx, y, rowH);
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

  const chartX = MARGIN;
  const chartW = contentWidth(doc);
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

function drawStackedStatusChart(doc, ctx, report, startY) {
  const regions = (report.regions ?? []).slice(0, 8);
  if (!regions.length) return startY;

  const chartX = MARGIN;
  const labelW = 48;
  const barAreaW = contentWidth(doc) - labelW - 8;
  const rowH = 11;
  let y = startY;

  const segments = [
    { key: "healthy", color: STATUS_COLORS.healthy },
    { key: "warning", color: STATUS_COLORS.warning },
    { key: "critical", color: STATUS_COLORS.critical },
    { key: "offline", color: STATUS_COLORS.offline },
  ];

  regions.forEach((row) => {
    y = ensureSpace(doc, ctx, y, rowH);
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

function drawChartsPage(doc, ctx) {
  const report = ctx.report;
  let y = CONTENT_TOP;
  const groupLabel = GROUP_LABELS[report.group_by] ?? "Wilayah";

  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Grafik Ringkasan", MARGIN, y);
  y += 8;

  // Helper: judul chart + baris pertama tetap bersama (tidak stranded di bawah).
  const chartTitle = (text, firstBlock) => {
    y = ensureSpace(doc, ctx, y, 5 + firstBlock);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.dark);
    doc.text(text, MARGIN, y);
    y += 5;
  };

  if (report.varietas_distribution?.length) {
    chartTitle("Distribusi Varietas", 10);
    y = drawHorizontalBarChart(doc, ctx, {
      startY: y,
      items: report.varietas_distribution.map((v) => ({ name: v.nama, count: v.count })),
      barColor: BRAND.mid,
    });
    y += 4;
  }

  chartTitle(`Status Screenhouse per ${groupLabel}`, 11);
  y = drawStackedStatusChart(doc, ctx, report, y);
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
    chartTitle("Rata-rata Kelembapan Tanah (%)", 63); // kotak chart 55 utuh
    y = drawVerticalBarChart(doc, {
      startY: y,
      items: sensorRows.map((r) => ({ name: r.name, count: r.moisture ?? 0 })),
      barColor: [37, 99, 235],
      valueSuffix: "%",
    });
    y += 4;

    chartTitle("Rata-rata Suhu Tanah (°C)", 63);
    y = drawVerticalBarChart(doc, {
      startY: y,
      items: sensorRows.map((r) => ({ name: r.name, count: r.temp ?? 0 })),
      barColor: [217, 119, 6],
      valueSuffix: "°C",
    });
    y += 4;
  }

  if (report.top_alert_params?.length) {
    chartTitle("Parameter Alert Terbanyak", 10);
    drawHorizontalBarChart(doc, ctx, {
      startY: y,
      items: report.top_alert_params.map((p) => ({ name: p.label, count: p.count })),
      barColor: STATUS_COLORS.critical,
    });
  }
}

function drawGrowthNote(doc, ctx, startY) {
  const report = ctx.report;
  const growth = report.growth;
  if (!growth) return startY;

  const hasActivity =
    growth.new_screenhouses > 0 ||
    growth.farmers_approved > 0 ||
    growth.farmers_pending > 0 ||
    growth.farmers_rejected > 0;
  if (!hasActivity) return startY;

  let y = ensureSpace(doc, ctx, startY, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.dark);
  doc.text("Aktivitas Registrasi dalam Periode", MARGIN, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const growthText = `Unit screenhouse terdaftar: ${growth.new_screenhouses}  ·  Akun petani disetujui: ${growth.farmers_approved}  ·  Menunggu: ${growth.farmers_pending}  ·  Ditolak: ${growth.farmers_rejected ?? 0}`;
  const growthLines = doc.splitTextToSize(growthText, contentWidth(doc));
  doc.text(growthLines, MARGIN, y);
  y += growthLines.length * 5;
  if (growth.distinct_petani_owners > 0) {
    y = ensureSpace(doc, ctx, y, 6);
    doc.text(`Terhubung ke ${growth.distinct_petani_owners} petani`, MARGIN, y);
    y += 5;
  }
  if (growth.note) {
    doc.setTextColor(...BRAND.slate);
    const noteLines = doc.splitTextToSize(growth.note, contentWidth(doc));
    y = ensureSpace(doc, ctx, y, noteLines.length * 5 + 3);
    doc.text(noteLines, MARGIN, y);
    y += noteLines.length * 5 + 3;
  }
  return y + 2;
}

function drawAlertTrendPage(doc, ctx) {
  const report = ctx.report;
  const trend = report.alert_trend ?? [];
  const y = CONTENT_TOP;

  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Tren Alert Harian (${periodLabel(report.period_days)})`, MARGIN, y);

  if (!trend.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.slate);
    doc.text("Belum ada alert dalam periode ini.", MARGIN, y + 8);
    return;
  }

  const maxCount = Math.max(...trend.map((t) => t.count), 1);
  const chartX = MARGIN;
  const chartY = y + 10;
  const chartW = contentWidth(doc);
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
    ...tableDefaults(doc, ctx),
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
  });
}

export async function exportOperatorReportPdf(report, meta = {}) {
  if (!report?.regions?.length) return false;

  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const ctx = { report, meta, logo: logoDataUrl };

  doc.setPage(1);
  drawExecutiveSummary(doc, ctx, drawPageHeader(doc, report, meta, logoDataUrl));

  doc.addPage();
  drawPageHeader(doc, report, meta, logoDataUrl);
  drawProblematicTablePage(doc, ctx);

  doc.addPage();
  drawPageHeader(doc, report, meta, logoDataUrl);
  drawChartsPage(doc, ctx);

  doc.addPage();
  drawPageHeader(doc, report, meta, logoDataUrl);
  drawAlertTrendPage(doc, ctx);

  doc.addPage();
  drawPageHeader(doc, report, meta, logoDataUrl);
  drawAppendixPage(doc, ctx);

  // Footer digambar terakhir agar nomor "Halaman X / N" memakai total final.
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(doc);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`laporan-bibitlive-wilayah-${stamp}.pdf`);
  return true;
}
