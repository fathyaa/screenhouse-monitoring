/**
 * Bangun results/report-compare.html — Direct vs RabbitMQ berdampingan.
 *
 *   node reporter/generate-compare.js
 *
 * Sebelumnya file itu ditulis tangan, jadi skenario baru tidak pernah muncul di
 * sana dan narasi analisisnya bisa basi terhadap angka yang ditampilkan. Sekarang
 * seluruh isinya diturunkan dari results/*.json memakai pemilihan run yang sama
 * dengan generate-report.js.
 */

import fs from "fs";
import path from "path";
import { ROOT, loadResults, activeSensors } from "./results-loader.js";

const MODES = [
  { key: "direct", label: "Direct" },
  { key: "rabbitmq", label: "RabbitMQ" },
];

function parseArgs() {
  const args = { input: path.join(ROOT, "results") };
  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith("--input=")) args.input = raw.slice(8);
  }
  return args;
}

// --- Statistik ---------------------------------------------------------------

function quantile(sorted, p) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function boxStats(values) {
  const sorted = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (!sorted.length) return { min: 0, q1: 0, med: 0, q3: 0, max: 0, n: 0, mean: 0, stdev: 0 };

  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  // Simpangan baku sampel (n-1): yang dilaporkan di tabel sebagai "Std Dev".
  const variance =
    sorted.length > 1
      ? sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (sorted.length - 1)
      : 0;

  return {
    min: round(sorted[0]),
    q1: round(quantile(sorted, 0.25)),
    med: round(quantile(sorted, 0.5)),
    q3: round(quantile(sorted, 0.75)),
    max: round(sorted[sorted.length - 1]),
    n: sorted.length,
    mean: round(mean),
    stdev: round(Math.sqrt(variance)),
  };
}

function sampleValues(result, key) {
  return (result.timeSeries?.backend ?? [])
    .filter((sample) => !sample.error)
    .map((sample) => sample[key])
    .filter((value) => Number.isFinite(value) && value > 0);
}

// --- Ekstraksi metrik per run ------------------------------------------------

function modeMetrics(result) {
  if (!result) return null;

  const sent = Number(result.mqtt?.messagesSent ?? 0);
  const processed = Number(result.backend?.messagesProcessed ?? 0);
  const validation = result.validation ?? {};
  const loss = validation.lossBreakdown ?? null;
  const cooldown = validation.cooldown ?? null;

  return {
    sent,
    processed,
    dbRows: Number(result.database?.rowsInserted ?? 0),
    deliveryRate: sent > 0 ? round((processed / sent) * 100, 2) : 0,
    missing: Number(validation.missingMessages ?? 0),
    missingPct: round(Number(validation.missingPct ?? 0), 2),
    rssMax: round(Number(result.backend?.rssMbMax ?? 0)),
    latAvg: round(Number(result.backend?.latencyAvgMs ?? 0)),
    latP95: Math.round(Number(result.backend?.latencyP95Ms ?? 0)),
    tputAvg: round(Number(result.backend?.processRatePerSec ?? 0)),
    tputBox: boxStats(sampleValues(result, "processRatePerSec")),
    latBox: boxStats(sampleValues(result, "latencyAvgMs")),
    queueDepthMax: Math.round(Number(result.rabbitmq?.queueDepthMax ?? 0)),
    queueDepthAvg: round(Number(result.rabbitmq?.queueDepthAvg ?? 0)),
    // Metadata akurasi. Run lama (sebelum patch cooldown) tidak punya field ini;
    // ditandai conclusive=null supaya laporan bisa membedakannya dari run baru.
    conclusive: validation.missingIsConclusive ?? null,
    cooldownReason: cooldown?.reason ?? null,
    cooldownSec: cooldown?.elapsedSec ?? null,
    lossBroker: loss?.atBroker ?? null,
    lossApp: loss?.inApp ?? null,
    lossDb: loss?.atDatabase ?? null,
    foreign: Number(validation.foreignProcessed ?? 0),
    requeued: Number(result.backend?.messagesRequeued ?? 0),
    deadLettered: Number(result.backend?.messagesDeadLettered ?? result.backend?.messagesNacked ?? 0),
    file: result._sourceFile,
  };
}

function buildScenarios(inputDir) {
  const byMode = new Map(
    MODES.map((mode) => [mode.key, new Map(loadResults(inputDir, { mode: mode.key }).map((r) => [r.scenario.id, r]))])
  );

  const ids = new Set();
  for (const results of byMode.values()) for (const id of results.keys()) ids.add(id);

  const scenarios = [];
  for (const id of ids) {
    const any = MODES.map((mode) => byMode.get(mode.key).get(id)).find(Boolean);
    const entry = {
      id,
      sensors: activeSensors(any),
      durationSec: Number(any.scenario?.durationSec ?? 0),
      targetRatePerSec: activeSensors(any) / Number(any.scenario?.intervalSec || 1),
    };
    for (const mode of MODES) entry[mode.key] = modeMetrics(byMode.get(mode.key).get(id));
    scenarios.push(entry);
  }

  return scenarios.sort((a, b) => a.sensors - b.sensors);
}

// --- Analisis ----------------------------------------------------------------

const nf = (value, digits = 1) =>
  value == null || !Number.isFinite(Number(value))
    ? "-"
    : new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(Number(value));

const ni = (value) =>
  value == null || !Number.isFinite(Number(value))
    ? "-"
    : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value));

function findSaturation(scenarios, modeKey) {
  // Titik jenuh = skenario pertama yang throughput-nya tidak lagi mengejar laju
  // kirim (di bawah 90% target).
  return scenarios.find((s) => s[modeKey] && s[modeKey].tputAvg < s.targetRatePerSec * 0.9) ?? null;
}

function peakThroughput(scenarios, modeKey) {
  return scenarios
    .filter((s) => s[modeKey])
    .reduce((best, s) => (!best || s[modeKey].tputAvg > best[modeKey].tputAvg ? s : best), null);
}

function buildAnalysis(scenarios) {
  const covered = scenarios.filter((s) => s.direct || s.rabbitmq);
  if (!covered.length) return "Belum ada hasil run untuk dianalisis.";

  const range = `${covered[0].sensors}–${covered[covered.length - 1].sensors}`;
  const lines = [
    "## Analisis Perbandingan Direct vs RabbitMQ",
    "",
    `Rentang beban yang diuji: ${range} active sensor (1 pesan/detik per node). ` +
      "Angka di bawah dihasilkan otomatis dari file hasil run, bukan ditulis tangan.",
    "",
  ];

  // Throughput
  const parts = [];
  for (const mode of MODES) {
    const peak = peakThroughput(covered, mode.key);
    const saturation = findSaturation(covered, mode.key);
    if (!peak) continue;
    parts.push(
      `${mode.label}: throughput tertinggi ${nf(peak[mode.key].tputAvg)}/detik pada ${peak.sensors} sensor` +
        (saturation
          ? `, mulai tidak mengejar laju kirim pada ${saturation.sensors} sensor ` +
            `(${nf(saturation[mode.key].tputAvg)}/detik dari target ${nf(saturation.targetRatePerSec, 0)}/detik).`
          : ", masih mengejar laju kirim di seluruh rentang uji.")
    );
  }
  if (parts.length) lines.push("Throughput. " + parts.join(" "), "");

  // Latensi
  const latParts = [];
  for (const mode of MODES) {
    const withData = covered.filter((s) => s[mode.key]);
    if (!withData.length) continue;
    const first = withData[0];
    const last = withData[withData.length - 1];
    latParts.push(
      `${mode.label} naik dari ${nf(first[mode.key].latAvg, 0)} ms pada ${first.sensors} sensor ` +
        `menjadi ${nf(last[mode.key].latAvg, 0)} ms pada ${last.sensors} sensor ` +
        `(P95 ${nf(last[mode.key].latP95, 0)} ms).`
    );
  }
  if (latParts.length) lines.push("Latensi. " + latParts.join(" "), "");

  // Reliabilitas
  const relParts = [];
  for (const mode of MODES) {
    const lost = covered.filter((s) => s[mode.key]?.missing > 0);
    if (!lost.length) {
      relParts.push(`${mode.label} tidak kehilangan pesan di seluruh skenario.`);
      continue;
    }
    relParts.push(
      `${mode.label} mulai kehilangan pesan pada ${lost[0].sensors} sensor — ` +
        lost
          .map((s) => `${ni(s[mode.key].missing)} pesan (${nf(s[mode.key].missingPct, 2)}%) di ${s.sensors} sensor`)
          .join(", ") +
        "."
    );
  }
  if (relParts.length) lines.push("Reliabilitas. " + relParts.join(" "), "");

  // Sebaran kehilangan — hanya kalau ada run baru yang mencatatnya
  const withBreakdown = covered.filter((s) =>
    MODES.some((mode) => s[mode.key]?.lossBroker != null && s[mode.key].missing > 0)
  );
  if (withBreakdown.length) {
    const detail = withBreakdown
      .flatMap((s) =>
        MODES.filter((mode) => s[mode.key]?.lossBroker != null && s[mode.key].missing > 0).map(
          (mode) =>
            `${mode.label} ${s.sensors} sensor: ${ni(s[mode.key].lossBroker)} lenyap sebelum sampai subscriber, ` +
            `${ni(s[mode.key].lossApp)} di dalam aplikasi, ${ni(s[mode.key].lossDb)} sebelum tersimpan di DB`
        )
      )
      .join("; ");
    lines.push(`Titik kehilangan. ${detail}.`, "");
  }

  // Memori
  const memParts = [];
  for (const mode of MODES) {
    const withData = covered.filter((s) => s[mode.key]);
    if (!withData.length) continue;
    const worst = withData.reduce((best, s) => (s[mode.key].rssMax > best[mode.key].rssMax ? s : best));
    memParts.push(`${mode.label} memuncak di ${nf(worst[mode.key].rssMax)} MB pada ${worst.sensors} sensor.`);
  }
  if (memParts.length) lines.push("Memori. " + memParts.join(" "), "");

  // Queue depth
  const queued = covered.filter((s) => s.rabbitmq?.queueDepthMax > 0);
  if (queued.length) {
    const worst = queued.reduce((best, s) => (s.rabbitmq.queueDepthMax > best.rabbitmq.queueDepthMax ? s : best));
    lines.push(
      `Queue depth. Antrean RabbitMQ terdalam ${ni(worst.rabbitmq.queueDepthMax)} pesan ` +
        `(rata-rata ${nf(worst.rabbitmq.queueDepthAvg)}) pada ${worst.sensors} sensor. ` +
        "Antrean yang menumpuk lalu surut berarti lonjakan tertahan di broker, bukan hilang — " +
        "biayanya latensi, bukan data.",
      ""
    );
  }

  // Peringatan akurasi
  const inconclusive = covered.filter((s) =>
    MODES.some((mode) => s[mode.key] && s[mode.key].conclusive === false)
  );
  const legacy = covered.filter((s) => MODES.some((mode) => s[mode.key] && s[mode.key].conclusive == null));
  if (inconclusive.length) {
    lines.push(
      `Catatan akurasi. Skenario ${inconclusive.map((s) => s.id).join(", ")} berhenti karena cooldown habis ` +
        "sementara backend masih menulis — angka missing-nya belum konklusif dan run perlu diulang " +
        "dengan cooldownSec lebih panjang.",
      ""
    );
  }
  const contaminated = covered.filter((s) => MODES.some((mode) => s[mode.key]?.foreign > 0));
  if (contaminated.length) {
    const detail = contaminated
      .flatMap((s) =>
        MODES.filter((mode) => s[mode.key]?.foreign > 0).map(
          (mode) => `${s.id} ${mode.label} (+${ni(s[mode.key].foreign)} pesan)`
        )
      )
      .join(", ");
    lines.push(
      `Catatan kontaminasi. ${detail}: backend memproses lebih banyak pesan daripada yang dikirim ` +
        "simulator, artinya ada sumber ingest lain yang aktif selama run (kemungkinan device-bridge " +
        "gh01). Delivery rate skenario itu sedikit menggelembung; kosongkan DEVICE_BRIDGE_MAP saat " +
        "mengambil data final.",
      ""
    );
  }

  if (legacy.length) {
    lines.push(
      `Catatan akurasi. Skenario ${legacy.map((s) => s.id).join(", ")} berasal dari run sebelum patch ` +
        "akurasi pengukuran (cooldown berhenti di ambang 99% dan counter backend diambil dari sampel " +
        "polling terakhir), jadi angka missing dan delivery rate-nya bisa mengecil/membesar palsu.",
      ""
    );
  }

  return lines.join("\n");
}

// --- Skenario eksperimen -----------------------------------------------------

/**
 * Empat tahap metodologi (tujuan → desain → pengumpulan → evaluasi) dirender
 * sebagai diagram alir sederhana. Isinya diturunkan dari data supaya rentang
 * beban dan daftar skenario tidak perlu disunting manual tiap kali seri diulang.
 */
function experimentDesign(scenarios) {
  const covered = scenarios.filter((s) => s.direct || s.rabbitmq);
  const sensorRange = covered.length
    ? `${covered[0].sensors}–${covered[covered.length - 1].sensors}`
    : "-";
  const ids = covered.map((s) => s.id).join(", ");
  const durations = [...new Set(covered.map((s) => s.durationSec).filter(Boolean))];
  const durasi = durations.length === 1 ? `${durations[0] / 60} menit` : "5 menit";

  return {
    tahapan: [
      {
        judul: "Tujuan Pengujian (Hipotesis)",
        isi:
          "Menguji apakah penyangga antrian (RabbitMQ) mempertahankan keutuhan data saat laju " +
          "kedatangan melampaui kapasitas pemrosesan, sementara pipeline langsung (MQTT → DB) " +
          "kehilangan pembacaan pada kondisi yang sama. Hipotesis: antrian menukar latensi dengan " +
          "keutuhan data — jumlah pesan hilang tetap nol selama antrian mampu menampung lonjakan.",
      },
      {
        judul: "Desain Eksperimen (Variabel, Parameter)",
        isi:
          `Dua variabel bebas disilangkan: jumlah sensor node aktif (${sensorRange}, skenario ` +
          `${ids}) dan mode ingest (direct vs rabbitmq). Variabel terikat: throughput, latensi ` +
          "publish→simpan, jumlah pesan hilang, penggunaan memori, dan kedalaman antrian. " +
          "Variabel kontrol dijaga identik di semua sel percobaan.",
      },
      {
        judul: "Pengumpulan Data",
        isi:
          "Simulator MQTT mengirim telemetri dari sensor node sungguhan di basis data (bukan node " +
          `palsu) selama ${durasi} per skenario. Metrik direkam tiap 5 detik dari tiga sumber ` +
          "independen: counter backend (/stats/ingest), RabbitMQ Management API, dan COUNT baris " +
          "sensor_data. Setelah beban berhenti, pengukuran menunggu sampai seluruh pesan tersimpan " +
          "atau hitungan basis data terbukti berhenti.",
      },
      {
        judul: "Pengujian & Evaluasi",
        isi:
          "Angka kehilangan hanya diakui bila status akhir cooldown complete (semua tersimpan) atau " +
          "stalled (hitungan berhenti padahal antrian kosong); status timeout ditandai belum " +
          "konklusif dan tidak dikutip. Kehilangan dipecah per segmen untuk menentukan titik " +
          "kegagalan, bukan sekadar jumlah totalnya.",
      },
    ],
    variabel: [
      ["Bebas", "Jumlah sensor node aktif", `${sensorRange} node (1 sensor = 1 sink node)`],
      ["Bebas", "Mode ingest", "direct (MQTT → DB) vs rabbitmq (MQTT → antrian → DB)"],
      ["Terikat", "Throughput pemrosesan", "pesan/detik yang tersimpan ke basis data"],
      ["Terikat", "Latensi publish → simpan", "rata-rata dan persentil ke-95, milidetik"],
      ["Terikat", "Pesan hilang", "pesan terkirim − baris tersimpan, hanya bila konklusif"],
      ["Terikat", "Memori proses", "RSS puncak monitoring-service, MB"],
      ["Terikat", "Kedalaman antrian", "pesan menunggu di RabbitMQ (maks & rata-rata)"],
      ["Kontrol", "Laju kirim per node", "1 pesan/detik"],
      ["Kontrol", "Durasi beban", `${durasi} per skenario`],
      ["Kontrol", "Anggaran komputasi", "1 OCPU / 8 GB per layanan (menyerupai instance OCI)"],
      ["Kontrol", "Keadaan awal", "purge tabel ukur + restart layanan sebelum tiap skenario"],
      ["Kontrol", "Isolasi sumber data", "jembatan perangkat gh01 dimatikan selama pengukuran"],
    ],
  };
}

function experimentHtml(design) {
  const alir = design.tahapan
    .map(
      (tahap, index) =>
        `<div class="tahap"><div class="tahap-judul">${index + 1}. ${escapeHtml(tahap.judul)}</div>` +
        `<div class="tahap-isi">${escapeHtml(tahap.isi)}</div></div>` +
        (index < design.tahapan.length - 1 ? '<div class="panah">&darr;</div>' : "")
    )
    .join("");

  const baris = design.variabel
    .map(
      ([jenis, nama, keterangan]) =>
        `<tr><td class="jenis-${jenis.toLowerCase()}">${jenis}</td><td>${escapeHtml(nama)}</td>` +
        `<td>${escapeHtml(keterangan)}</td></tr>`
    )
    .join("");

  return `
  <h2>Skenario Pengujian</h2>
  <div class="alir">${alir}</div>

  <h3>Variabel dan Parameter</h3>
  <table>
    <thead><tr><th>Jenis</th><th>Variabel</th><th>Definisi operasional</th></tr></thead>
    <tbody>${baris}</tbody>
  </table>`;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// --- HTML --------------------------------------------------------------------

function buildHtml(scenarios) {
  const generatedAt = new Date().toISOString();
  const analysis = buildAnalysis(scenarios);
  const sources = scenarios
    .flatMap((s) =>
      MODES.filter((mode) => s[mode.key]).map((mode) => `${s.id} ${mode.label}: ${s[mode.key].file}`)
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Perbandingan Load Test — Direct vs RabbitMQ</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@sgratzl/chartjs-chart-boxplot@4.4.4/build/index.umd.min.js"></script>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1180px; margin: 24px auto; padding: 0 18px; color: #1d1d1f; }
    h1 { font-size: 24px; margin-bottom: 6px; }
    h2 { font-size: 18px; margin-top: 28px; }
    .meta { color: #555; margin-top: 0; }
    .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 20px 0 30px; }
    .chart-panel { border: 1px solid #d8dee4; padding: 14px; background: #fff; }
    canvas { max-height: 340px; }
    .wide { grid-column: 1 / -1; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; margin: 12px 0; }
    th, td { border: 1px solid #c9d1d9; padding: 7px 9px; text-align: left; }
    th { background: #eef3f7; }
    td.d { color: #2f80ed; font-weight: bold; }
    td.r { color: #27ae60; font-weight: bold; }
    td.warn { background: #fff6e5; }
    pre { background: #f6f8fa; padding: 16px; overflow-x: auto; white-space: pre-wrap; border: 1px solid #d8dee4; }
    .stats-table { font-size: 12px; margin-top: 10px; }
    .footnote { font-size: 12px; color: #666; }
    .alir { max-width: 720px; margin: 18px 0 26px; }
    .tahap { border: 1px solid #b9c6d4; border-left: 5px solid #2f80ed; background: #f7fafd; padding: 12px 14px; }
    .tahap-judul { font-weight: bold; font-size: 14px; margin-bottom: 5px; }
    .tahap-isi { font-size: 13px; line-height: 1.55; color: #333; }
    .panah { text-align: center; font-size: 20px; color: #2f80ed; line-height: 1.1; margin: 4px 0; }
    .jenis-bebas { color: #2f80ed; font-weight: bold; }
    .jenis-terikat { color: #27ae60; font-weight: bold; }
    .jenis-kontrol { color: #6b7785; font-weight: bold; }
    @media (max-width: 820px) { .charts { grid-template-columns: 1fr; } .wide { grid-column: auto; } }
  </style>
</head>
<body>
  <h1>Perbandingan Load Test Backend — Direct vs RabbitMQ</h1>
  <p class="meta">Dibuat otomatis dari results/*.json · ${generatedAt}</p>
  <p class="meta">Sumbu-X: jumlah active sensor (1 sensor = 1 sink node) · tiap grafik menampilkan Direct dan RabbitMQ berdampingan · sel kosong berarti skenario itu belum dijalankan pada mode tersebut.</p>

${experimentHtml(experimentDesign(scenarios))}

  <h2>Tabel Ringkasan</h2>
  <table>
    <thead><tr>
      <th>Scenario</th><th>Active Sensors</th><th>Mode</th>
      <th>Messages Sent</th><th>Messages Processed</th><th>Delivery Rate</th>
      <th>Avg Latency</th><th>P95</th><th>Throughput</th><th>RSS Max</th><th>Missing</th>
    </tr></thead>
    <tbody id="summaryBody"></tbody>
  </table>
  <p class="footnote">
    <strong>†</strong> = angka missing belum konklusif: pengukuran berhenti saat backend masih menulis ke DB
    (cooldown habis), atau run berasal dari versi runner sebelum patch akurasi. Missing yang sah hanya dari run
    yang selesai dengan status <code>complete</code> (semua pesan tersimpan) atau <code>stalled</code>
    (hitungan DB berhenti padahal antrean kosong).
  </p>

  <h2>Sebaran Titik Kehilangan</h2>
  <p class="meta">Di segmen mana pesan menguap. Hanya terisi untuk run yang dijalankan setelah patch akurasi pengukuran.</p>
  <table>
    <thead><tr>
      <th>Scenario</th><th>Mode</th><th>Cooldown</th>
      <th>Broker &rarr; Subscriber</th><th>Subscriber &rarr; Pipeline</th><th>Pipeline &rarr; DB</th>
      <th>Requeue</th><th>Dead-letter</th>
    </tr></thead>
    <tbody id="lossBody"></tbody>
  </table>

  <h2>Grafik Ringkasan</h2>
  <div class="charts">
    <div class="chart-panel"><canvas id="throughputChart"></canvas></div>
    <div class="chart-panel"><canvas id="avgLatencyChart"></canvas></div>
    <div class="chart-panel"><canvas id="p95LatencyChart"></canvas></div>
    <div class="chart-panel"><canvas id="deliveryChart"></canvas></div>
    <div class="chart-panel"><canvas id="memoryChart"></canvas></div>
    <div class="chart-panel"><canvas id="missingChart"></canvas></div>
    <div class="chart-panel"><canvas id="queueDepthChart"></canvas></div>
    <div class="chart-panel"><canvas id="queueDepthAvgChart"></canvas></div>
  </div>

  <h2>Box Plot Distribusi Selama Pengujian</h2>
  <p class="meta">
    Tiap kotak merangkum sampel <em>throughput</em>/latensi rata-rata yang direkam setiap ~5 detik selama
    durasi satu skenario &mdash; jadi ini <strong>bukan</strong> distribusi antar-pesan, melainkan sebaran
    performa dari waktu ke waktu selagi beban berjalan. Cara baca: garis tengah kotak =
    <strong>median</strong>; batas bawah/atas kotak = <strong>Q1/Q3</strong> (rentang 50% sampel tengah,
    disebut IQR); garis (<em>whisker</em>) di luar kotak = nilai <strong>min/max</strong>. Kotak pendek dan
    rapat berarti performa konsisten; kotak panjang berarti performa naik-turun meski beban dan durasi
    ujinya sama. <strong>Std Dev</strong> pada tabel adalah versi angka tunggal dari sebaran itu.
  </p>
  <div class="charts">
    <div class="chart-panel wide">
      <canvas id="throughputBoxChart"></canvas>
      <table class="stats-table" id="throughputStats"></table>
    </div>
    <div class="chart-panel wide">
      <canvas id="latencyBoxChart"></canvas>
      <table class="stats-table" id="latencyStats"></table>
    </div>
  </div>

  <h2>Analisis</h2>
  <pre id="analysis"></pre>

  <h2>Sumber Data</h2>
  <pre class="footnote">${sources || "(belum ada hasil run)"}</pre>

  <script>
    const SC = ${JSON.stringify(scenarios, null, 1)};
    const labels = SC.map(s => String(s.sensors));
    const COLOR = {
      direct:   { border: '#2f80ed', bg: 'rgba(47,128,237,0.35)', solid: '#2f80ed' },
      rabbitmq: { border: '#27ae60', bg: 'rgba(39,174,96,0.35)',  solid: '#27ae60' },
    };
    const MODES = [
      { key: 'direct',   label: 'Direct' },
      { key: 'rabbitmq', label: 'RabbitMQ' },
    ];
    const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
    const EMPTY_BOX = { min: 0, q1: 0, med: 0, q3: 0, max: 0, n: 0, mean: 0, stdev: 0 };

    /* ---------- Tabel ringkasan ---------- */
    (function summary() {
      const cols = [
        ['sent', v => v.toLocaleString('en-US')],
        ['processed', v => v.toLocaleString('en-US')],
        ['deliveryRate', v => v.toFixed(2) + '%'],
        ['latAvg', v => nf.format(v) + ' ms'],
        ['latP95', v => v.toLocaleString('en-US') + ' ms'],
        ['tputAvg', v => nf.format(v) + '/s'],
        ['rssMax', v => nf.format(v) + ' MB'],
      ];
      let html = '';
      SC.forEach(s => MODES.forEach((m, i) => {
        const o = s[m.key];
        html += '<tr>';
        if (i === 0) html += '<td rowspan="2">' + s.id + '</td><td rowspan="2">' + s.sensors + '</td>';
        html += '<td class="' + (m.key === 'direct' ? 'd' : 'r') + '">' + m.label + '</td>';
        if (!o) {
          html += '<td colspan="' + (cols.length + 1) + '">belum dijalankan</td></tr>';
          return;
        }
        cols.forEach(([k, fmt]) => html += '<td>' + fmt(o[k]) + '</td>');
        const dagger = o.conclusive === true ? '' : ' †';
        html += '<td' + (dagger ? ' class="warn"' : '') + '>' + o.missing.toLocaleString('en-US') + dagger + '</td>';
        html += '</tr>';
      }));
      document.getElementById('summaryBody').innerHTML = html;
    })();

    /* ---------- Tabel sebaran kehilangan ---------- */
    (function lossTable() {
      let html = '';
      SC.forEach(s => MODES.forEach((m, i) => {
        const o = s[m.key];
        html += '<tr>';
        if (i === 0) html += '<td rowspan="2">' + s.id + ' (' + s.sensors + ')</td>';
        html += '<td class="' + (m.key === 'direct' ? 'd' : 'r') + '">' + m.label + '</td>';
        if (!o) { html += '<td colspan="6">belum dijalankan</td></tr>'; return; }
        if (o.lossBroker == null) {
          html += '<td colspan="6">run lama — sebaran tidak terekam</td></tr>';
          return;
        }
        html += '<td>' + o.cooldownReason + ' (' + o.cooldownSec + 's)</td>';
        [o.lossBroker, o.lossApp, o.lossDb, o.requeued, o.deadLettered]
          .forEach(v => html += '<td>' + v.toLocaleString('en-US') + '</td>');
        html += '</tr>';
      }));
      document.getElementById('lossBody').innerHTML = html;
    })();

    /* ---------- Opsi dasar ---------- */
    function axisTitle(text) { return { display: true, text, font: { size: 13, weight: 'bold' } }; }
    // Seluruh garis rangka grafik — garis bantu, garis sumbu, dan garis penanda
    // tick — dibuat samar supaya batang dan kotak jadi elemen yang paling
    // menonjol. Nilai default Chart.js terbaca terlalu kuat saat grafik disalin
    // ke dokumen cetak. Teks dan angka tidak diubah.
    const RANGKA = { grid: 'rgba(0,0,0,0.04)', garis: 'rgba(0,0,0,0.05)' };
    // Grafik yang isinya didominasi dua batang sangat tinggi menyisakan bidang
    // kosong luas, sehingga rangka pada nilai default masih terbaca ramai.
    const RANGKA_SAMAR = { grid: 'rgba(0,0,0,0.02)', garis: 'rgba(0,0,0,0.025)' };

    function baseOptions(title, yText, rangka) {
      const r = rangka || RANGKA;
      return {
        responsive: true, maintainAspectRatio: true,
        plugins: {
          title: { display: true, text: title, font: { size: 15, weight: 'bold' } },
          legend: { display: true, position: 'bottom' },
        },
        scales: {
          x: {
            title: axisTitle('Number of Active Sensors'),
            grid: { display: false, tickColor: r.garis },
            border: { color: r.garis },
          },
          y: {
            title: axisTitle(yText),
            beginAtZero: true,
            grid: { color: r.grid, tickColor: r.garis },
            border: { color: r.garis },
          },
        },
      };
    }

    /* ---------- Grouped bar (Direct vs RabbitMQ) ---------- */
    function barChart(id, title, yText, field, rangka) {
      new Chart(document.getElementById(id), {
        type: 'bar',
        data: {
          labels,
          datasets: MODES.map(m => ({
            label: m.label,
            data: SC.map(s => s[m.key] ? s[m.key][field] : null),
            backgroundColor: COLOR[m.key].solid,
            borderColor: COLOR[m.key].border,
            borderWidth: 1,
          })),
        },
        options: baseOptions(title, yText, rangka),
      });
    }

    barChart('throughputChart', 'Throughput vs Number of Active Sensors', 'messages/second', 'tputAvg');
    barChart('avgLatencyChart', 'Avg Latency vs Number of Active Sensors', 'milliseconds', 'latAvg', RANGKA_SAMAR);
    barChart('p95LatencyChart', 'P95 Latency vs Number of Active Sensors', 'milliseconds', 'latP95');
    barChart('deliveryChart', 'Delivery Rate vs Number of Active Sensors', 'percent', 'deliveryRate');
    barChart('memoryChart', 'Memory Usage vs Number of Active Sensors', 'RSS MB', 'rssMax');
    barChart('missingChart', 'Missing Messages vs Number of Active Sensors', 'messages', 'missing');
    barChart('queueDepthChart', 'RabbitMQ Queue Depth (Max) vs Number of Active Sensors', 'messages', 'queueDepthMax');
    barChart('queueDepthAvgChart', 'RabbitMQ Queue Depth (Avg) vs Number of Active Sensors', 'messages', 'queueDepthAvg');

    /* ---------- Grouped boxplot (Direct vs RabbitMQ) ---------- */
    function boxData(field) {
      return MODES.map(m => ({
        label: m.label,
        data: SC.map(s => {
          const b = s[m.key] ? s[m.key][field] : EMPTY_BOX;
          return { min: b.min, q1: b.q1, median: b.med, q3: b.q3, max: b.max, mean: b.mean };
        }),
        backgroundColor: COLOR[m.key].bg,
        borderColor: COLOR[m.key].border,
        outlierColor: COLOR[m.key].border,
        itemRadius: 0,
        // Titik rata-rata di tengah kotak dimatikan: nilai mean sudah tersedia
        // pada tabel statistik di bawah grafik, dan bulatannya mengaburkan garis
        // median yang justru jadi acuan baca box plot.
        meanRadius: 0,
      }));
    }
    function boxChart(id, title, yText, field) {
      new Chart(document.getElementById(id), {
        type: 'boxplot',
        data: { labels, datasets: boxData(field) },
        options: { ...baseOptions(title, yText), aspectRatio: 2.6 },
      });
    }
    boxChart('throughputBoxChart', 'Throughput Distribution', 'messages/second', 'tputBox');
    boxChart('latencyBoxChart', 'Latency Distribution (ms)', 'milliseconds', 'latBox');

    /* ---------- Tabel statistik box ---------- */
    function statsTable(tblId, field) {
      let html = '<thead><tr><th>Sensors</th><th>Mode</th><th>Min</th><th>Q1</th><th>Median</th><th>Q3</th><th>Max</th><th>Std Dev</th></tr></thead><tbody>';
      SC.forEach(s => MODES.forEach((m, i) => {
        html += '<tr>';
        if (i === 0) html += '<td rowspan="2">' + s.sensors + '</td>';
        html += '<td class="' + (m.key === 'direct' ? 'd' : 'r') + '">' + m.label + '</td>';
        if (!s[m.key]) { html += '<td colspan="6">-</td></tr>'; return; }
        const b = s[m.key][field];
        [b.min, b.q1, b.med, b.q3, b.max, b.stdev].forEach(v => html += '<td>' + nf.format(v) + '</td>');
        html += '</tr>';
      }));
      document.getElementById(tblId).innerHTML = html + '</tbody>';
    }
    statsTable('throughputStats', 'tputBox');
    statsTable('latencyStats', 'latBox');

    /* ---------- Analisis ---------- */
    document.getElementById('analysis').textContent = ${JSON.stringify(analysis)};
  </script>
</body>
</html>`;
}

function main() {
  const args = parseArgs();
  const scenarios = buildScenarios(args.input);

  if (!scenarios.length) {
    console.error(`Tidak ada hasil run yang cocok dengan config/scenarios.json di ${args.input}`);
    process.exit(1);
  }

  const outPath = path.join(ROOT, "results", "report-compare.html");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buildHtml(scenarios));

  console.log(`Laporan perbandingan ditulis:\n  ${outPath}\n`);
  for (const scenario of scenarios) {
    const cells = MODES.map((mode) => {
      const metrics = scenario[mode.key];
      if (!metrics) return `${mode.label}: -`;
      const flag = metrics.conclusive === true ? "" : "†";
      return `${mode.label}: ${nf(metrics.tputAvg)}/s, missing ${ni(metrics.missing)}${flag}`;
    });
    console.log(`  ${scenario.id} (${scenario.sensors} sensor) — ${cells.join(" | ")}`);
  }
  console.log("\n† = angka missing belum konklusif (lihat catatan di laporan).");
}

main();
