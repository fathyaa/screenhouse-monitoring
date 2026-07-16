/**
 * Run all scenarios sequentially and generate consolidated report.
 *
 *   node runner/run-all.js
 *   node runner/run-all.js --only=S1,S2,S3
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env") });

function loadScenarios() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "config/scenarios.json"), "utf8"));
}

function parseArgs() {
  const args = {};
  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith("--only=")) {
      args.only = raw.slice(7).split(",");
    }
  }
  return args;
}

function runScenario(id) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["runner/run-scenario.js", id], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${id} exited ${code}`))));
  });
}

async function fetchIngestMode() {
  const base = process.env.MONITORING_URL || "http://localhost:3001";
  const res = await fetch(`${base}/`);
  const data = await res.json();
  return data.ingestMode || "direct";
}

async function main() {
  const args = parseArgs();
  const config = loadScenarios();
  let ids = config.scenarios.map((s) => s.id);
  if (args.only?.length) ids = ids.filter((id) => args.only.includes(id));

  const ingestMode = await fetchIngestMode();
  console.log(`Ingest mode: ${ingestMode}`);
  console.log(`Running ${ids.length} scenarios: ${ids.join(", ")}`);
  const suiteStartedAt = new Date().toISOString();

  for (const id of ids) {
    await runScenario(id);
    console.log(`\n--- ${id} selesai, jeda 60s sebelum skenario berikutnya ---\n`);
    await new Promise((r) => setTimeout(r, 60_000));
  }

  const reportArgs = ["reporter/generate-report.js"];
  if (ingestMode === "direct") reportArgs.push("--mode=direct");

  const reportChild = spawn("node", reportArgs, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, SUITE_STARTED_AT: suiteStartedAt },
  });

  reportChild.on("close", (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
