/**
 * Generate thesis-ready Markdown and HTML reports for backend ingest load tests.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function parseArgs() {
  const args = { input: path.join(ROOT, "results"), mode: null };
  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith("--input=")) args.input = raw.slice(8);
    if (raw.startsWith("--mode=")) args.mode = raw.slice(7);
  }
  return args;
}

function loadScenarioDefinitions() {
  const configPath = path.join(ROOT, "config/scenarios.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return new Map(config.scenarios.map((scenario) => [scenario.id, scenario]));
}

function loadReportSelection() {
  const selectionPath = path.join(ROOT, "config/report-selection.json");
  if (!fs.existsSync(selectionPath)) return { pinnedRuns: {} };
  return JSON.parse(fs.readFileSync(selectionPath, "utf8"));
}

function loadResults(dir, { mode } = {}) {
  if (!fs.existsSync(dir)) return [];

  const scenarioDefinitions = loadScenarioDefinitions();
  const pinnedRuns = loadReportSelection().pinnedRuns ?? {};
  const entries = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => ({ file, data: JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) }))
    .filter(({ data }) => matchesCurrentScenarioDesign(data, scenarioDefinitions))
    .filter(({ data }) => !mode || (data.backend?.ingestMode ?? "rabbitmq") === mode);

  const byScenario = groupBy(entries, ({ data }) => data.scenario.id);
  const picked = [];

  for (const [scenarioId, scenarioEntries] of byScenario) {
    const pinned = pinnedRuns[scenarioId];
    const selected =
      scenarioEntries.find((entry) => entry.file === pinned) ||
      scenarioEntries.sort((a, b) => new Date(b.data.timing.startedAt) - new Date(a.data.timing.startedAt))[0];

    picked.push({ ...selected.data, _sourceFile: selected.file });
  }

  return picked.sort((a, b) => activeSensors(a) - activeSensors(b));
}

function matchesCurrentScenarioDesign(result, scenarioDefinitions) {
  const id = result.scenario?.id;
  const expected = scenarioDefinitions.get(id);
  if (!expected) return false;

  return (
    activeSensors(result) === expected.sensors &&
    Number(result.scenario?.intervalSec) === expected.intervalSec &&
    Number(result.scenario?.durationSec) === expected.durationSec
  );
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function activeSensors(result) {
  return Number(result.scenario?.activeSensors ?? result.scenario?.sensors ?? 0);
}

function deliveryRate(result) {
  const sent = Number(result.mqtt?.messagesSent ?? 0);
  const processed = Number(result.backend?.messagesProcessed ?? 0);
  return sent > 0 ? (processed / sent) * 100 : null;
}

function formatNumber(value, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

function fmt(value, digits = 1) {
  return formatNumber(value, digits);
}

function fmtInt(value) {
  return value == null || !Number.isFinite(Number(value))
    ? "-"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value));
}

function fmtPct(value) {
  return value == null || !Number.isFinite(Number(value)) ? "-" : `${formatNumber(value, 2)}%`;
}

function fmtMs(value) {
  return value == null || !Number.isFinite(Number(value)) ? "-" : `${formatNumber(value, 0)} ms`;
}

function fmtRate(value) {
  return value == null || !Number.isFinite(Number(value)) ? "-" : `${formatNumber(value, 1)}/s`;
}

function fmtMb(value) {
  return value == null || !Number.isFinite(Number(value)) ? "-" : `${formatNumber(value, 1)} MB`;
}

function summaryTable(results) {
  const lines = [
    "| Scenario | Active Sensors | Messages Sent | Messages Processed | Delivery Rate | Avg Latency | P95 | Throughput | RSS Max | Missing |",
    "| -------- | -------------- | ------------- | ------------------ | ------------- | ----------- | --- | ---------- | ------- | ------- |",
  ];

  for (const result of results) {
    lines.push(
      `| ${result.scenario.id} | ${activeSensors(result)} | ${fmtInt(result.mqtt.messagesSent)} | ` +
        `${fmtInt(result.backend.messagesProcessed)} | ${fmtPct(deliveryRate(result))} | ` +
        `${fmtMs(result.backend.latencyAvgMs)} | ${fmtMs(result.backend.latencyP95Ms)} | ` +
        `${fmtRate(result.backend.processRatePerSec)} | ${fmtMb(result.backend.rssMbMax)} | ` +
        `${fmtInt(result.validation?.missingMessages)} |`
    );
  }

  return lines.join("\n");
}

function rabbitMqTable(results) {
  if (!results.some((result) => result.backend?.ingestMode !== "direct")) return "";

  const lines = [
    "## RabbitMQ Queue Depth",
    "",
    "| Scenario | Active Sensors | Queue Depth Max | Queue Depth Avg | Publish Rate Avg | Consume Rate Avg |",
    "| -------- | -------------- | --------------- | --------------- | ---------------- | ---------------- |",
  ];

  for (const result of results) {
    lines.push(
      `| ${result.scenario.id} | ${activeSensors(result)} | ${fmtInt(result.rabbitmq?.queueDepthMax)} | ` +
        `${fmt(result.rabbitmq?.queueDepthAvg)} | ${fmtRate(result.rabbitmq?.publishRateAvg)} | ` +
        `${fmtRate(result.rabbitmq?.consumeRateAvg)} |`
    );
  }

  return lines.join("\n");
}

function quantile(sorted, p) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

function boxStats(values) {
  const sorted = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (!sorted.length) return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
  return {
    min: sorted[0],
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1],
  };
}

function boxplotData(results) {
  return results.map((result) => {
    const samples = result.timeSeries?.backend ?? [];
    return {
      label: `${activeSensors(result)}`,
      scenario: result.scenario.id,
      throughput: boxStats(
        samples
          .filter((sample) => !sample.error)
          .map((sample) => sample.processRatePerSec)
          .filter((value) => Number.isFinite(value) && value > 0)
      ),
      latency: boxStats(
        samples
          .filter((sample) => !sample.error)
          .map((sample) => sample.latencyAvgMs)
          .filter((value) => Number.isFinite(value) && value > 0)
      ),
    };
  });
}

function chartData(results) {
  return {
    labels: results.map((result) => `${activeSensors(result)}`),
    throughput: results.map((result) => result.backend?.processRatePerSec ?? 0),
    avgLatency: results.map((result) => result.backend?.latencyAvgMs ?? 0),
    p95Latency: results.map((result) => result.backend?.latencyP95Ms ?? 0),
    deliveryRate: results.map((result) => deliveryRate(result) ?? 0),
    memory: results.map((result) => result.backend?.rssMbMax ?? 0),
    queueDepth: results.map((result) => result.rabbitmq?.queueDepthMax ?? 0),
  };
}

function buildAnalysis(results) {
  const sorted = [...results].sort((a, b) => activeSensors(a) - activeSensors(b));
  const firstDegraded = sorted.find(
    (result) => (deliveryRate(result) ?? 100) < 99 || (result.validation?.missingMessages ?? 0) > 0
  );
  const peak = sorted.reduce((best, result) => {
    const rate = result.backend?.processRatePerSec ?? 0;
    return !best || rate > (best.backend?.processRatePerSec ?? 0) ? result : best;
  }, null);
  const plateau = detectPlateau(sorted);
  const latencyJump = detectLatencyJump(sorted);

  const lines = [
    "## Analisis Hasil Pengujian",
    "",
    "Pengujian ini mengevaluasi performa backend saat menerima peningkatan jumlah data sensor. MQTT digunakan sebagai media simulasi sensor IoT, sedangkan metrik utama berasal dari backend, database, memori, dan RabbitMQ jika mode RabbitMQ aktif.",
    "",
  ];

  if (peak) {
    lines.push(
      `Throughput tertinggi tercatat pada ${activeSensors(peak)} active sensors dengan nilai ${fmtRate(peak.backend.processRatePerSec)}.`
    );
  }

  if (plateau) {
    lines.push(
      `Backend throughput meningkat hingga sekitar ${plateau.beforeSensors} active sensors, lalu mulai melambat pada ${plateau.afterSensors} active sensors.`
    );
  } else {
    lines.push("Backend throughput masih meningkat pada rentang skenario yang diuji.");
  }

  if (latencyJump) {
    lines.push(
      `Latency meningkat signifikan mulai ${latencyJump.sensors} active sensors; P95 naik dari ${fmtMs(latencyJump.previousP95)} menjadi ${fmtMs(latencyJump.currentP95)}.`
    );
  }

  if (firstDegraded) {
    lines.push(
      `Delivery rate mulai turun pada ${activeSensors(firstDegraded)} active sensors dengan missing ${fmtInt(firstDegraded.validation?.missingMessages)} pesan (${fmtPct(firstDegraded.validation?.missingPct)}).`
    );
  } else {
    lines.push("Seluruh skenario yang dipilih memiliki delivery rate mendekati 100% pada akhir jendela pengukuran.");
  }

  const final = sorted[sorted.length - 1];
  if (final) {
    lines.push(
      `Pada ${activeSensors(final)} active sensors, backend ${describeFinalState(final, plateau, latencyJump)}.`
    );
  }

  return lines.join("\n");
}

function detectPlateau(results) {
  for (let i = 1; i < results.length; i += 1) {
    const prev = results[i - 1].backend?.processRatePerSec ?? 0;
    const curr = results[i].backend?.processRatePerSec ?? 0;
    if (prev > 0 && curr / prev < 1.2) {
      return {
        beforeSensors: activeSensors(results[i - 1]),
        afterSensors: activeSensors(results[i]),
      };
    }
  }
  return null;
}

function detectLatencyJump(results) {
  for (let i = 1; i < results.length; i += 1) {
    const prev = results[i - 1].backend?.latencyP95Ms ?? 0;
    const curr = results[i].backend?.latencyP95Ms ?? 0;
    if (prev > 0 && curr / prev >= 2) {
      return {
        sensors: activeSensors(results[i]),
        previousP95: prev,
        currentP95: curr,
      };
    }
  }
  return null;
}

function describeFinalState(result, plateau, latencyJump) {
  const parts = [];
  if (plateau) parts.push("mulai mendekati batas throughput pemrosesan");
  else parts.push("masih menunjukkan peningkatan throughput");
  if (latencyJump) parts.push("dengan kenaikan latency yang perlu diperhatikan");
  if ((result.validation?.missingMessages ?? 0) > 0) parts.push("serta indikasi pesan belum terproses penuh");
  return parts.join(", ");
}

function buildMarkdown(results, mode) {
  const pipeline = mode === "direct" ? "MQTT -> Backend (direct)" : "MQTT -> RabbitMQ -> Backend";
  const sections = [
    "# Laporan Load Test Backend Screenhouse Monitoring",
    "",
    `Pipeline: **${pipeline}**`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Tabel Ringkasan",
    "",
    summaryTable(results),
    "",
    "Delivery Rate dihitung dari Messages Processed terhadap Messages Sent. Missing menunjukkan selisih pesan terkirim dan pesan yang telah tercatat di database pada akhir pengukuran.",
    "",
  ];

  const rabbitTable = rabbitMqTable(results);
  if (rabbitTable) sections.push(rabbitTable, "");

  sections.push(buildAnalysis(results), "");
  return sections.join("\n");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function boxStatsTable(boxes, key) {
  const rows = boxes
    .map((box) => {
      const stats = box[key];
      return `<tr><td>${box.label}</td><td>${fmt(stats.min)}</td><td>${fmt(stats.q1)}</td><td>${fmt(stats.median)}</td><td>${fmt(stats.q3)}</td><td>${fmt(stats.max)}</td></tr>`;
    })
    .join("");
  return `<table class="stats-table"><thead><tr><th>Sensors</th><th>Min</th><th>Q1</th><th>Median</th><th>Q3</th><th>Max</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function buildHtml(results, markdown, mode) {
  const cd = chartData(results);
  const boxes = boxplotData(results);
  const generatedAt = new Date().toISOString();
  const includeQueue = results.some((result) => result.backend?.ingestMode !== "direct");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Screenhouse Backend Load Test Report</title>
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
    pre { background: #f6f8fa; padding: 16px; overflow-x: auto; white-space: pre-wrap; border: 1px solid #d8dee4; }
    .stats-table { font-size: 12px; margin-top: 10px; }
    @media (max-width: 820px) { .charts { grid-template-columns: 1fr; } .wide { grid-column: auto; } }
  </style>
</head>
<body>
  <h1>Laporan Load Test Backend Screenhouse Monitoring</h1>
  <p class="meta">Generated: ${generatedAt} · ingest: ${mode === "direct" ? "MQTT -> Backend (direct)" : "MQTT -> RabbitMQ -> Backend"}</p>

  <h2>Tabel Ringkasan</h2>
  ${markdownTableToHtml(summaryTable(results))}

  <h2>Grafik Ringkasan</h2>
  <div class="charts">
    <div class="chart-panel"><canvas id="throughputChart"></canvas></div>
    <div class="chart-panel"><canvas id="avgLatencyChart"></canvas></div>
    <div class="chart-panel"><canvas id="p95LatencyChart"></canvas></div>
    <div class="chart-panel"><canvas id="deliveryChart"></canvas></div>
    <div class="chart-panel"><canvas id="memoryChart"></canvas></div>
    ${includeQueue ? '<div class="chart-panel"><canvas id="queueChart"></canvas></div>' : ""}
  </div>

  <h2>Box Plot Distribusi Selama Pengujian</h2>
  <div class="charts">
    <div class="chart-panel wide">
      <canvas id="throughputBoxChart"></canvas>
      ${boxStatsTable(boxes, "throughput")}
    </div>
    <div class="chart-panel wide">
      <canvas id="latencyBoxChart"></canvas>
      ${boxStatsTable(boxes, "latency")}
    </div>
  </div>

  <h2>Analisis Thesis</h2>
  <pre>${escapeHtml(buildAnalysis(results))}</pre>

  <script>
    const labels = ${JSON.stringify(cd.labels)};
    const chartData = ${JSON.stringify(cd)};
    const boxData = ${JSON.stringify(boxes)};

    const visibleBoxLabels = {
      id: 'visibleBoxLabels',
      afterDatasetsDraw(chart) {
        if (chart.config.type !== 'boxplot') return;
        const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
        const ctx = chart.ctx;
        const y = chart.scales.y;
        const meta = chart.getDatasetMeta(0);
        const statsKey = chart.canvas.id.includes('throughput') ? 'throughput' : 'latency';
        ctx.save();
        ctx.font = '10px Arial';
        ctx.fillStyle = '#111';
        ctx.textAlign = 'left';
        meta.data.forEach((element, index) => {
          const stats = boxData[index][statsKey];
          const x = element.x + 10;
          [
            ['Min', stats.min],
            ['Q1', stats.q1],
            ['Median', stats.median],
            ['Q3', stats.q3],
            ['Max', stats.max],
          ].forEach(([label, value]) => {
            const py = y.getPixelForValue(value);
            if (Number.isFinite(py)) ctx.fillText(label + ' ' + fmt.format(Number(value)), x, py - 2);
          });
        });
        ctx.restore();
      }
    };
    Chart.register(visibleBoxLabels);

    function axisTitle(text) {
      return { display: true, text, font: { size: 13, weight: 'bold' } };
    }

    function baseOptions(title, yText) {
      return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: { display: true, text: title, font: { size: 15, weight: 'bold' } },
          legend: { display: false }
        },
        scales: {
          x: { title: axisTitle('Number of Active Sensors'), grid: { display: false } },
          y: { title: axisTitle(yText), beginAtZero: true }
        }
      };
    }

    function barChart(id, title, yText, data, color) {
      new Chart(document.getElementById(id), {
        type: 'bar',
        data: { labels, datasets: [{ label: title, data, backgroundColor: color }] },
        options: baseOptions(title, yText)
      });
    }

    barChart('throughputChart', 'Throughput vs Number of Sensors', 'messages/second', chartData.throughput, '#2f80ed');
    barChart('avgLatencyChart', 'Avg Latency vs Number of Sensors', 'milliseconds', chartData.avgLatency, '#f2994a');
    barChart('p95LatencyChart', 'P95 Latency vs Number of Sensors', 'milliseconds', chartData.p95Latency, '#eb5757');
    barChart('deliveryChart', 'Delivery Rate vs Number of Sensors', 'percent', chartData.deliveryRate, '#27ae60');
    barChart('memoryChart', 'Memory Usage vs Number of Sensors', 'RSS MB', chartData.memory, '#4f4f4f');
    ${includeQueue ? "barChart('queueChart', 'RabbitMQ Queue Depth vs Number of Sensors', 'messages', chartData.queueDepth, '#9b51e0');" : ""}

    function boxChart(id, title, yText, key, color) {
      new Chart(document.getElementById(id), {
        type: 'boxplot',
        data: {
          labels,
          datasets: [{
            label: title,
            data: boxData.map((item) => item[key]),
            backgroundColor: color.background,
            borderColor: color.border,
            outlierColor: color.border,
            padding: 18,
          }]
        },
        options: {
          ...baseOptions(title, yText),
          aspectRatio: 2.4,
          plugins: {
            ...baseOptions(title, yText).plugins,
            legend: { display: false },
          }
        }
      });
    }

    boxChart('throughputBoxChart', 'Throughput Distribution', 'messages/second', 'throughput', { background: 'rgba(47,128,237,0.35)', border: '#2f80ed' });
    boxChart('latencyBoxChart', 'Latency Distribution', 'milliseconds', 'latency', { background: 'rgba(242,153,74,0.35)', border: '#f2994a' });
  </script>
</body>
</html>`;
}

function markdownTableToHtml(markdownTable) {
  const rows = markdownTable
    .split("\n")
    .filter((line) => line.startsWith("|") && !line.includes("---"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
  const [header, ...body] = rows;
  return `<table><thead><tr>${header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>${body
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function writeReport({ input, mode, outDir }) {
  const results = loadResults(input, { mode });
  if (!results.length) {
    console.error(`No JSON results in ${input} for mode=${mode}`);
    return false;
  }

  const reportBase = mode === "direct" ? "report-direct" : "report";
  const markdown = buildMarkdown(results, mode);
  const mdPath = path.join(outDir, `${reportBase}.md`);
  const htmlPath = path.join(outDir, `${reportBase}.html`);

  fs.writeFileSync(mdPath, markdown);
  fs.writeFileSync(htmlPath, buildHtml(results, markdown, mode));

  console.log(`Report written (${mode}):\n  ${mdPath}\n  ${htmlPath}`);
  console.log("\n" + summaryTable(results));
  return true;
}

function main() {
  const args = parseArgs();
  const outDir = path.join(ROOT, "results");
  fs.mkdirSync(outDir, { recursive: true });

  const modes = args.mode ? [args.mode] : ["rabbitmq", "direct"];
  let ok = false;
  for (const mode of modes) {
    if (writeReport({ input: args.input, mode, outDir })) ok = true;
  }
  if (!ok) process.exit(1);
}

main();
