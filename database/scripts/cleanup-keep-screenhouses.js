/**
 * Hapus semua screenhouse kecuali daftar KEEP_IDS (app + monitoring DB).
 * sensor_data dihapus per batch node agar tidak hang di jutaan baris.
 *
 *   node database/scripts/cleanup-keep-screenhouses.js
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(ROOT, "services/app-service/.env") });

const KEEP_IDS = (process.env.KEEP_IDS ?? "1,2,3")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isInteger(n) && n > 0);

const NODE_BATCH = Number(process.env.CLEANUP_NODE_BATCH ?? 25);

const appPool = new pg.Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_APP_PORT || process.env.DB_PORT || 5434),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "screenhouse_app",
});

const monPool = new pg.Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_MON_PORT || 5433),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_MON_NAME || "screenhouse_monitoring",
});

async function run(pool, label, sql, params) {
  const t0 = Date.now();
  const r = await pool.query(sql, params);
  console.log(`${label}: ${r.rowCount} rows (${Date.now() - t0}ms)`);
  return r.rowCount;
}

async function deleteSensorDataForScreenhouse(screenhouseId) {
  const allNodes = await monPool.query(
    `SELECT id FROM sensor_nodes WHERE screenhouse_id = $1 ORDER BY id`,
    [screenhouseId]
  );
  const nodeIds = allNodes.rows.map((r) => r.id);
  if (!nodeIds.length) return 0;

  let total = 0;
  for (let i = 0; i < nodeIds.length; i += NODE_BATCH) {
    const batch = nodeIds.slice(i, i + NODE_BATCH);
    const n = await run(
      monPool,
      `  sensor_data batch ${Math.floor(i / NODE_BATCH) + 1}/${Math.ceil(nodeIds.length / NODE_BATCH)} (sh ${screenhouseId})`,
      `DELETE FROM sensor_data WHERE sensor_node_id = ANY($1::int[])`,
      [batch]
    );
    total += n;
  }
  return total;
}

async function deleteMonitoringScreenhouse(screenhouseId) {
  console.log(`\n--- screenhouse ${screenhouseId} ---`);
  const sdTotal = await deleteSensorDataForScreenhouse(screenhouseId);
  if (sdTotal > 0) console.log(`  total sensor_data removed: ${sdTotal}`);

  await run(
    monPool,
    `  alerts (sh ${screenhouseId})`,
    `DELETE FROM alerts WHERE screenhouse_id = $1`,
    [screenhouseId]
  );
  await run(
    monPool,
    `  actuator_logs (sh ${screenhouseId})`,
    `DELETE FROM actuator_logs WHERE screenhouse_id = $1`,
    [screenhouseId]
  );
  await run(
    monPool,
    `  sensor_nodes (sh ${screenhouseId})`,
    `DELETE FROM sensor_nodes WHERE screenhouse_id = $1`,
    [screenhouseId]
  );
  await run(
    monPool,
    `  sink_nodes (sh ${screenhouseId})`,
    `DELETE FROM sink_nodes WHERE screenhouse_id = $1`,
    [screenhouseId]
  );
  await run(
    monPool,
    `  threshold_snapshots (sh ${screenhouseId})`,
    `DELETE FROM threshold_snapshots WHERE screenhouse_id = $1`,
    [screenhouseId]
  );
  await run(
    monPool,
    `  screenhouse_registry (sh ${screenhouseId})`,
    `DELETE FROM screenhouse_registry WHERE screenhouse_id = $1`,
    [screenhouseId]
  );
}

async function deleteMonitoringExceptKeep() {
  console.log("\n=== Monitoring DB ===");
  console.log("Keep screenhouse IDs:", KEEP_IDS.join(", "));

  await run(
    monPool,
    "alerts (non-keep)",
    `DELETE FROM alerts WHERE NOT (screenhouse_id = ANY($1::int[]))`,
    [KEEP_IDS]
  );

  const toDelete = await monPool.query(
    `SELECT screenhouse_id FROM screenhouse_registry
     WHERE NOT (screenhouse_id = ANY($1::int[]))
     ORDER BY screenhouse_id = 9999 DESC, screenhouse_id`,
    [KEEP_IDS]
  );

  for (const { screenhouse_id: shId } of toDelete.rows) {
    await deleteMonitoringScreenhouse(shId);
  }
}

async function deleteAppExceptKeep() {
  console.log("\n=== App DB ===");
  await run(
    appPool,
    "thresholds",
    `DELETE FROM thresholds WHERE NOT (screenhouse_id = ANY($1::int[]))`,
    [KEEP_IDS]
  );
  await run(
    appPool,
    "screenhouses",
    `DELETE FROM screenhouses WHERE NOT (id = ANY($1::int[]))`,
    [KEEP_IDS]
  );
}

async function verify() {
  const appRows = await appPool.query(`SELECT id, name FROM screenhouses ORDER BY id`);
  const monRows = await monPool.query(
    `SELECT screenhouse_id, screenhouse_name FROM screenhouse_registry ORDER BY screenhouse_id`
  );
  const lt = await monPool.query(
    `SELECT COUNT(*)::int AS nodes FROM sensor_nodes sn
     JOIN screenhouse_registry sr ON sr.screenhouse_id = sn.screenhouse_id
     WHERE sr.screenhouse_id = 9999 OR sr.screenhouse_name ILIKE '%load test%'`
  );

  console.log("\n=== Sisa screenhouse (app) ===");
  console.table(appRows.rows);
  console.log("=== Sisa screenhouse (monitoring) ===");
  console.table(monRows.rows);
  console.log("Load test nodes remaining:", lt.rows[0].nodes);
}

async function main() {
  if (KEEP_IDS.length === 0) {
    console.error("KEEP_IDS kosong — abort.");
    process.exit(1);
  }

  console.log("Cleanup dimulai — hanya menyisakan screenhouse:", KEEP_IDS.join(", "));
  await deleteMonitoringExceptKeep();
  await deleteAppExceptKeep();
  await verify();
  console.log("\nSelesai.");
}

main()
  .catch((err) => {
    console.error("FAILED:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await appPool.end();
    await monPool.end();
  });
