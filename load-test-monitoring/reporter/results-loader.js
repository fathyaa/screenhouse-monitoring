/**
 * Pemilihan run yang dipakai laporan.
 *
 * Dipakai bersama oleh generate-report.js (per mode) dan generate-compare.js
 * (dua mode berdampingan) supaya keduanya selalu mengutip run yang sama:
 * satu run terbaru per skenario per mode, kecuali dipatok di
 * config/report-selection.json.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");

export function loadScenarioDefinitions() {
  const configPath = path.join(ROOT, "config/scenarios.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return new Map(config.scenarios.map((scenario) => [scenario.id, scenario]));
}

function loadReportSelection() {
  const selectionPath = path.join(ROOT, "config/report-selection.json");
  if (!fs.existsSync(selectionPath)) return { pinnedRuns: {} };
  return JSON.parse(fs.readFileSync(selectionPath, "utf8"));
}

export function activeSensors(result) {
  return Number(result.scenario?.activeSensors ?? result.scenario?.sensors ?? 0);
}

export function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

/**
 * Buang hasil run dari desain skenario lama. Kalau S6 pernah dijalankan dengan
 * 250 sensor lalu definisinya diubah, run lamanya tidak boleh ikut ke laporan.
 */
export function matchesCurrentScenarioDesign(result, scenarioDefinitions) {
  const id = result.scenario?.id;
  const expected = scenarioDefinitions.get(id);
  if (!expected) return false;

  // Run dengan fase beban terpotong (mesin tidur di tengah) tidak boleh ikut:
  // durasi yang tercatat 5 menit, tapi bebannya cuma berjalan sebagian.
  if (result.validation?.loadPhaseComplete === false) return false;

  return (
    activeSensors(result) === expected.sensors &&
    Number(result.scenario?.intervalSec) === expected.intervalSec &&
    Number(result.scenario?.durationSec) === expected.durationSec
  );
}

export function loadResults(dir, { mode } = {}) {
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

  for (const [, scenarioEntries] of byScenario) {
    const pinnedByMode = mode ? pinnedRuns[`${scenarioEntries[0].data.scenario.id}:${mode}`] : null;
    const pinned = pinnedByMode ?? pinnedRuns[scenarioEntries[0].data.scenario.id];
    const selected =
      scenarioEntries.find((entry) => entry.file === pinned) ||
      scenarioEntries.sort(
        (a, b) => new Date(b.data.timing.startedAt) - new Date(a.data.timing.startedAt)
      )[0];

    picked.push({ ...selected.data, _sourceFile: selected.file });
  }

  return picked.sort((a, b) => activeSensors(a) - activeSensors(b));
}
