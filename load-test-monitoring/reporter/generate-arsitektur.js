/**
 * Bangun results/report-arsitektur.html — perbandingan arsitektur lama vs baru.
 *
 *   node reporter/generate-arsitektur.js
 *
 * Terpisah dari report-compare.html, dan sengaja: yang itu membandingkan DUA
 * mode ingest dalam satu arsitektur (direct vs rabbitmq) dengan satu run per
 * skenario. Yang ini membandingkan TIGA konfigurasi lintas arsitektur, dengan
 * beberapa run per konfigurasi supaya sebarannya kelihatan:
 *
 *   direct       arsitektur lama, tanpa antrean
 *   rabbitmq     arsitektur lama, antrean di dalam satu proses
 *   listener@N   arsitektur baru, N replica persistence
 *
 * Perbedaan penting lainnya: laporan ini MEMERIKSA KESEBANDINGAN. Run dengan
 * profil resource berbeda (atau tanpa catatan resource sama sekali) ditandai,
 * bukan diam-diam dirata-rata bersama yang lain.
 */

import fs from "fs";
import path from "path";
import {
  ROOT,
  loadScenarioDefinitions,
  matchesCurrentScenarioDesign,
  activeSensors,
} from "./results-loader.js";

const CONFIG_LABELS = {
  direct: "Direct (lama)",
  rabbitmq: "RabbitMQ (lama)",
};

function parseArgs() {
  const args = { input: path.join(ROOT, "results"), output: null };
  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith("--input=")) args.input = raw.slice(8);
    if (raw.startsWith("--output=")) args.output = raw.slice(9);
  }
  args.output ??= path.join(args.input, "report-arsitektur.html");
  return args;
}

// --- Pemuatan & pengelompokan ------------------------------------------------

/** Kunci konfigurasi: arsitektur + jumlah replica yang benar-benar berjalan. */
function configKey(result) {
  const mode = result.backend?.ingestMode ?? "rabbitmq";
  if (mode !== "listener") return mode;
  const replicas = Number(result.environment?.replicas?.persistence ?? 1);
  return `listener@${replicas}`;
}

function configLabel(key) {
  if (CONFIG_LABELS[key]) return CONFIG_LABELS[key];
  const n = key.split("@")[1] ?? "?";
  return `Listener ×${n} (baru)`;
}

/** Semua run yang sah, dikelompokkan per skenario per konfigurasi. */
function loadRuns(inputDir) {
  if (!fs.existsSync(inputDir)) return [];
  const definitions = loadScenarioDefinitions();

  return fs
    .readdirSync(inputDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ file: f, data: JSON.parse(fs.readFileSync(path.join(inputDir, f), "utf8")) }))
    .filter(({ data }) => matchesCurrentScenarioDesign(data, definitions))
    .map(({ file, data }) => ({
      file,
      scenarioId: data.scenario.id,
      sensors: activeSensors(data),
      config: configKey(data),
      profile: data.environment?.resourceProfile ?? "unknown",
      startedAt: data.timing?.startedAt ?? null,
      deliveryPct: data.validation?.databaseDeliveryRatePct ?? null,
      procRate: data.backend?.processRatePerSec ?? null,
      p95Ms: data.backend?.latencyP95Ms ?? null,
      avgMs: data.backend?.latencyAvgMs ?? null,
      rssMb: data.backend?.rssMbMax ?? null,
      drainSec: data.validation?.cooldown?.elapsedSec ?? null,
      conclusive: data.validation?.missingIsConclusive ?? false,
    }));
}

// --- Statistik ringkas -------------------------------------------------------

function median(values) {
  const s = values.filter((v) => v != null).sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function spread(values) {
  const s = values.filter((v) => v != null);
  if (!s.length) return null;
  return { min: Math.min(...s), max: Math.max(...s), n: s.length };
}

function summarize(runs, key) {
  const values = runs.map((r) => r[key]);
  return { median: median(values), ...(spread(values) ?? { min: null, max: null, n: 0 }) };
}

function groupRuns(runs) {
  const byScenario = new Map();
  for (const run of runs) {
    if (!byScenario.has(run.scenarioId)) {
      byScenario.set(run.scenarioId, { scenarioId: run.scenarioId, sensors: run.sensors, configs: new Map() });
    }
    const scenario = byScenario.get(run.scenarioId);
    if (!scenario.configs.has(run.config)) scenario.configs.set(run.config, []);
    scenario.configs.get(run.config).push(run);
  }
  return [...byScenario.values()].sort((a, b) => a.sensors - b.sensors);
}

// --- Pemeriksaan kesebandingan ----------------------------------------------

/**
 * Perbandingan hanya sah bila semua run dijalankan pada profil resource yang
 * sama. Ini yang paling gampang terlewat dan paling telak kalau ditanya penguji.
 */
function comparabilityIssues(runs) {
  const issues = [];
  const profiles = new Map();
  for (const run of runs) {
    profiles.set(run.profile, (profiles.get(run.profile) ?? 0) + 1);
  }

  if (profiles.has("unknown")) {
    issues.push({
      level: "kritis",
      text:
        `${profiles.get("unknown")} run tidak menyimpan catatan resource sama sekali. ` +
        `Run ini dijalankan sebelum pencatatan kondisi ditambahkan, jadi tidak bisa ` +
        `dibuktikan memakai batas yang sama — perlakukan sebagai data pendahuluan, bukan hasil final.`,
    });
  }
  if (profiles.has("mixed")) {
    issues.push({
      level: "kritis",
      text:
        `${profiles.get("mixed")} run dijalankan saat sebagian container dibatasi dan ` +
        `sebagian tidak. Angkanya tidak sebanding dengan run mana pun dan harus diulang.`,
    });
  }
  const known = [...profiles.keys()].filter((p) => p !== "unknown" && p !== "mixed");
  if (known.length > 1) {
    issues.push({
      level: "kritis",
      text: `Run tercampur antara profil ${known.join(" dan ")}. Pisahkan atau ulangi salah satunya.`,
    });
  }

  const thin = [];
  for (const scenario of groupRuns(runs)) {
    for (const [config, list] of scenario.configs) {
      if (list.length < 3) thin.push(`${scenario.scenarioId}/${configLabel(config)} (n=${list.length})`);
    }
  }
  if (thin.length) {
    issues.push({
      level: "perhatian",
      text:
        `Kurang dari 3 run: ${thin.join(", ")}. Selisih antar-run pada beban tinggi ` +
        `pernah mencapai 14 poin persen, jadi klaim dari n=1 mudah dipatahkan.`,
    });
  }

  return issues;
}

// --- Format ------------------------------------------------------------------

const nf = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d));
const ni = (v) => (v == null ? "—" : Math.round(Number(v)).toLocaleString("id-ID"));

function cell(stat, format, unit = "") {
  if (stat == null || stat.median == null) return "—";
  const main = format(stat.median);
  if (stat.n <= 1) return `${main}${unit} <span class="n">n=1</span>`;
  return `${main}${unit} <span class="n">${format(stat.min)}–${format(stat.max)}, n=${stat.n}</span>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

// --- Grafik garis sederhana --------------------------------------------------

function lineChart({ scenarios, configs, metric, title, unit, log = false }) {
  const W = 760;
  const H = 300;
  const P = { t: 30, r: 150, b: 45, l: 70 };
  const plotW = W - P.l - P.r;
  const plotH = H - P.t - P.b;

  const points = [];
  for (const config of configs) {
    const series = scenarios
      .map((s) => {
        const runs = s.configs.get(config) ?? [];
        const stat = runs.length ? summarize(runs, metric) : null;
        return stat?.median == null ? null : { x: s.sensors, y: stat.median, id: s.scenarioId };
      })
      .filter(Boolean);
    if (series.length) points.push({ config, series });
  }
  if (!points.length) return "<p class=\"empty\">Belum ada data.</p>";

  const xs = points.flatMap((p) => p.series.map((d) => d.x));
  const ys = points.flatMap((p) => p.series.map((d) => d.y));
  const xMax = Math.max(...xs);
  const yMaxRaw = Math.max(...ys, 1);
  const yMin = log ? Math.max(Math.min(...ys.filter((v) => v > 0)), 0.1) : 0;

  const sx = (x) => P.l + (x / xMax) * plotW;
  const sy = (y) => {
    if (!log) return P.t + plotH - (y / yMaxRaw) * plotH;
    const lo = Math.log10(yMin);
    const hi = Math.log10(yMaxRaw);
    return P.t + plotH - ((Math.log10(Math.max(y, yMin)) - lo) / (hi - lo)) * plotH;
  };

  const palette = ["#b45309", "#0f766e", "#1d4ed8", "#7c3aed", "#be123c"];
  const paths = points
    .map((p, i) => {
      const d = p.series.map((pt, j) => `${j ? "L" : "M"}${sx(pt.x).toFixed(1)},${sy(pt.y).toFixed(1)}`).join(" ");
      const dots = p.series
        .map((pt) => `<circle cx="${sx(pt.x).toFixed(1)}" cy="${sy(pt.y).toFixed(1)}" r="3.5" fill="${palette[i % palette.length]}"/>`)
        .join("");
      return `<path d="${d}" fill="none" stroke="${palette[i % palette.length]}" stroke-width="2"/>${dots}`;
    })
    .join("");

  const legend = points
    .map(
      (p, i) =>
        `<g transform="translate(${W - P.r + 12},${P.t + 6 + i * 20})">` +
        `<rect width="12" height="3" y="5" fill="${palette[i % palette.length]}"/>` +
        `<text x="18" y="10" class="lg">${escapeHtml(configLabel(p.config))}</text></g>`
    )
    .join("");

  const xTicks = scenarios
    .map(
      (s) =>
        `<text x="${sx(s.sensors).toFixed(1)}" y="${H - P.b + 18}" text-anchor="middle" class="ax">${s.sensors}</text>`
    )
    .join("");

  const yTickVals = log
    ? [yMin, yMaxRaw / 100, yMaxRaw / 10, yMaxRaw].filter((v) => v >= yMin)
    : [0, yMaxRaw / 2, yMaxRaw];
  const yTicks = yTickVals
    .map(
      (v) =>
        `<line x1="${P.l}" x2="${P.l + plotW}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}" class="grid"/>` +
        `<text x="${P.l - 8}" y="${(sy(v) + 4).toFixed(1)}" text-anchor="end" class="ax">${ni(v)}</text>`
    )
    .join("");

  return `
  <figure>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(title)}">
      ${yTicks}
      <line x1="${P.l}" y1="${P.t + plotH}" x2="${P.l + plotW}" y2="${P.t + plotH}" class="axis"/>
      <line x1="${P.l}" y1="${P.t}" x2="${P.l}" y2="${P.t + plotH}" class="axis"/>
      ${paths}${xTicks}${legend}
      <text x="${P.l + plotW / 2}" y="${H - 6}" text-anchor="middle" class="ax">Active sensors</text>
    </svg>
    <figcaption>${escapeHtml(title)}${unit ? ` (${escapeHtml(unit)})` : ""}${log ? " — sumbu Y logaritmik" : ""}</figcaption>
  </figure>`;
}

// --- Halaman -----------------------------------------------------------------

function buildHtml(runs) {
  const scenarios = groupRuns(runs);
  const configs = [...new Set(runs.map((r) => r.config))].sort((a, b) => {
    const order = { direct: 0, rabbitmq: 1 };
    const oa = order[a] ?? 2 + Number(a.split("@")[1] ?? 0);
    const ob = order[b] ?? 2 + Number(b.split("@")[1] ?? 0);
    return oa - ob;
  });
  const issues = comparabilityIssues(runs);

  const metrics = [
    { key: "deliveryPct", label: "Delivery rate", fmt: (v) => nf(v, 2), unit: "%" },
    { key: "procRate", label: "Laju proses", fmt: (v) => nf(v, 0), unit: "/s" },
    { key: "p95Ms", label: "Latency p95", fmt: (v) => ni(v), unit: " ms" },
    { key: "rssMb", label: "RSS puncak", fmt: (v) => nf(v, 0), unit: " MB" },
    { key: "drainSec", label: "Waktu kuras", fmt: (v) => ni(v), unit: " s" },
  ];

  const tables = metrics
    .map((m) => {
      const rows = scenarios
        .map((s) => {
          const cells = configs
            .map((c) => {
              const list = s.configs.get(c) ?? [];
              return `<td>${list.length ? cell(summarize(list, m.key), m.fmt, m.unit) : "—"}</td>`;
            })
            .join("");
          return `<tr><th>${escapeHtml(s.scenarioId)} <span class="n">${s.sensors} sensor</span></th>${cells}</tr>`;
        })
        .join("");
      return `
      <section>
        <h3>${escapeHtml(m.label)}</h3>
        <div class="tw"><table>
          <thead><tr><th>Skenario</th>${configs.map((c) => `<th>${escapeHtml(configLabel(c))}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <p class="note">Angka besar = median. Angka kecil = rentang min–max dan jumlah run.</p>
      </section>`;
    })
    .join("");

  const issueHtml = issues.length
    ? `<div class="issues">${issues
        .map(
          (i) =>
            `<div class="issue ${i.level === "kritis" ? "crit" : "warn"}"><strong>${i.level.toUpperCase()}</strong> ${escapeHtml(i.text)}</div>`
        )
        .join("")}</div>`
    : `<div class="issues"><div class="issue ok"><strong>OK</strong> Semua run berada pada profil resource yang sama dengan minimal 3 pengulangan.</div></div>`;

  const profiles = [...new Set(runs.map((r) => r.profile))].join(", ");

  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Perbandingan Arsitektur — Kapasitas Ingest BibitLive</title>
<style>
  :root { --ink:#16201c; --muted:#5c6a63; --rule:#d3dbd5; --paper:#f4f6f4; --card:#fff; --sig:#0d6e63; --crit:#b3261e; --warn:#8a5a10; }
  @media (prefers-color-scheme: dark) {
    :root { --ink:#e3e8e3; --muted:#95a09a; --rule:#2a322d; --paper:#111614; --card:#171d1a; --sig:#4ecdc0; --crit:#f2b8b5; --warn:#d9a441; }
  }
  * { box-sizing:border-box; }
  body { margin:0; padding:2.5rem 1.25rem 5rem; background:var(--paper); color:var(--ink);
         font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif; }
  .wrap { max-width:1000px; margin:0 auto; display:flex; flex-direction:column; gap:2.5rem; }
  h1 { font-size:1.9rem; line-height:1.2; margin:0 0 .5rem; }
  h2 { font-size:1.3rem; margin:0 0 .75rem; }
  h3 { font-size:1rem; margin:0 0 .6rem; }
  .meta { font-family:ui-monospace,Menlo,monospace; font-size:.76rem; color:var(--muted); }
  .tw { overflow-x:auto; border:1px solid var(--rule); border-radius:8px; background:var(--card); }
  table { border-collapse:collapse; width:100%; font-size:.88rem; }
  th,td { padding:.55rem .8rem; text-align:left; border-bottom:1px solid var(--rule); white-space:nowrap;
          font-variant-numeric:tabular-nums; }
  thead th { font-size:.7rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); font-weight:600; }
  tbody tr:last-child td, tbody tr:last-child th { border-bottom:none; }
  .n { color:var(--muted); font-size:.74em; font-family:ui-monospace,Menlo,monospace; }
  .note { color:var(--muted); font-size:.82rem; margin:.5rem 0 0; }
  .issues { display:flex; flex-direction:column; gap:.6rem; }
  .issue { padding:.7rem .9rem; border-radius:6px; border-left:3px solid; font-size:.9rem; background:var(--card); }
  .issue.crit { border-color:var(--crit); }
  .issue.warn { border-color:var(--warn); }
  .issue.ok { border-color:var(--sig); }
  .issue strong { font-family:ui-monospace,Menlo,monospace; font-size:.72rem; letter-spacing:.06em; margin-right:.5rem; }
  figure { margin:0; background:var(--card); border:1px solid var(--rule); border-radius:8px; padding:1rem; overflow-x:auto; }
  svg { width:100%; height:auto; min-width:640px; }
  .grid { stroke:var(--rule); stroke-width:1; }
  .axis { stroke:var(--muted); stroke-width:1; }
  .ax, .lg { fill:var(--muted); font-size:11px; font-family:ui-monospace,Menlo,monospace; }
  .empty { color:var(--muted); }
  section { display:flex; flex-direction:column; gap:.5rem; }
</style></head>
<body><div class="wrap">
  <header>
    <h1>Perbandingan Arsitektur — Kapasitas Ingest</h1>
    <p class="meta">Dibuat ${new Date().toISOString()} · ${runs.length} run · profil resource: ${escapeHtml(profiles)}</p>
  </header>

  <section>
    <h2>Kesebandingan</h2>
    ${issueHtml}
  </section>

  <section>
    <h2>Ringkasan per metrik</h2>
    ${tables}
  </section>

  <section>
    <h2>Grafik</h2>
    ${lineChart({ scenarios, configs, metric: "procRate", title: "Laju proses vs beban", unit: "pesan/detik" })}
    ${lineChart({ scenarios, configs, metric: "deliveryPct", title: "Delivery rate vs beban", unit: "%" })}
    ${lineChart({ scenarios, configs, metric: "p95Ms", title: "Latency p95 vs beban", unit: "ms", log: true })}
    ${lineChart({ scenarios, configs, metric: "rssMb", title: "Memori puncak vs beban", unit: "MB" })}
  </section>

  <section>
    <h2>Cara membaca</h2>
    <p class="note"><strong>Delivery rate</strong> dihitung dari baris yang benar-benar mendarat di
    <code>sensor_data</code> terhadap pesan terkirim, diukur setelah antrean tuntas terkuras. Angka ini
    tidak bergantung pada counter internal, jadi ia satu-satunya metrik yang sebanding lintas arsitektur
    tanpa syarat.</p>
    <p class="note"><strong>Laju proses</strong> adalah kapasitas layanan sesungguhnya. Antrean tidak
    menaikkan angka ini kecuali konsumennya ditambah — kalau <em>Listener ×4</em> tidak lebih tinggi dari
    <em>Direct</em>, berarti leher botolnya ada di database, bukan di aplikasi.</p>
    <p class="note"><strong>Waktu kuras</strong> adalah harga yang dibayar untuk delivery 100%. Delivery
    tinggi dengan waktu kuras belasan menit berarti data mendarat terlambat, bukan tepat waktu.</p>
  </section>
</div></body></html>`;
}

function main() {
  const args = parseArgs();
  const runs = loadRuns(args.input);
  if (!runs.length) {
    console.error(`Tidak ada hasil yang cocok di ${args.input}`);
    process.exit(1);
  }
  fs.writeFileSync(args.output, buildHtml(runs));
  console.log(`report-arsitektur: ${runs.length} run → ${args.output}`);

  for (const issue of comparabilityIssues(runs)) {
    console.warn(`  [${issue.level}] ${issue.text}`);
  }
}

main();
