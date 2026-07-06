/**
 * Reset kedua database: sisakan hanya baris di tabel `users` (App DB),
 * lalu isi ulang wilayah + 3 screenhouse demo + monitoring seed.
 *
 *   node database/scripts/reset-db-keep-users.js
 */

import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(ROOT, "services/app-service/.env") });

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

async function terminateBackends(pool, dbName) {
  await pool.query(
    `SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [dbName]
  );
}

async function resetMonitoringDb() {
  console.log("\n=== Reset Monitoring DB ===");
  await terminateBackends(monPool, process.env.DB_MON_NAME || "screenhouse_monitoring");

  await monPool.query(`
    TRUNCATE TABLE
      alerts,
      actuator_logs,
      sensor_data,
      sensor_nodes,
      sink_nodes,
      threshold_snapshots,
      screenhouse_registry
    RESTART IDENTITY CASCADE
  `);
  console.log("Monitoring tables truncated.");

  const seedMain = readFileSync(
    path.join(__dirname, "../monitoring/seed.sql"),
    "utf8"
  )
    .replace(/^\\ir data\/seed_sensor_history\.sql\s*$/m, "")
    .replace(/^BEGIN;\s*/m, "")
    .replace(/\s*COMMIT;\s*$/m, "");

  await monPool.query("BEGIN");
  await monPool.query(seedMain);

  const sensorHistory = readFileSync(
    path.join(__dirname, "../monitoring/data/seed_sensor_history.sql"),
    "utf8"
  );
  await monPool.query(sensorHistory);
  await monPool.query("COMMIT");
  console.log("Monitoring seed applied (3 screenhouse demo).");
}

async function resetAppDb() {
  console.log("\n=== Reset App DB (keep users) ===");
  await terminateBackends(appPool, process.env.DB_NAME || "screenhouse_app");

  const userCount = await appPool.query(`SELECT COUNT(*)::int AS n FROM users`);
  console.log(`Users preserved: ${userCount.rows[0].n}`);

  await appPool.query(`
    TRUNCATE TABLE
      push_subscriptions,
      thresholds,
      screenhouses,
      villages,
      districts,
      regencies,
      provinces
    RESTART IDENTITY CASCADE
  `);
  console.log("App catalog tables truncated.");

  const seedMain = readFileSync(path.join(__dirname, "../app/seed.sql"), "utf8")
    .replace(/-- ─── 2\. User demo[\s\S]*?super_admin', 'approved'\);\s*/m, "")
    .replace(/^BEGIN;\s*/m, "")
    .replace(/\s*COMMIT;\s*$/m, "");

  await appPool.query("BEGIN");
  await appPool.query(seedMain);
  const migration = readFileSync(
    path.join(__dirname, "../app/migrations/001_screenhouse_profile_fields.sql"),
    "utf8"
  );
  await appPool.query(migration);
  await appPool.query("COMMIT");
  console.log("App catalog seed applied (wilayah + 3 screenhouse demo).");
}

async function verify() {
  const app = await appPool.query(`
    SELECT (SELECT COUNT(*)::int FROM users) AS users,
           (SELECT COUNT(*)::int FROM screenhouses) AS screenhouses
  `);
  const mon = await monPool.query(`
    SELECT (SELECT COUNT(*)::int FROM screenhouse_registry) AS registries,
           (SELECT COUNT(*)::int FROM sensor_nodes) AS nodes,
           (SELECT COUNT(*)::int FROM sensor_data) AS sensor_data,
           (SELECT COUNT(*)::int FROM alerts) AS alerts
  `);
  console.log("\n=== Verifikasi ===");
  console.log("App:", app.rows[0]);
  console.log("Monitoring:", mon.rows[0]);

  const sh = await appPool.query(`SELECT id, name FROM screenhouses ORDER BY id`);
  console.log("Screenhouses:");
  console.table(sh.rows);
}

async function main() {
  console.log("Reset database — hanya tabel users yang dipertahankan.");
  await resetMonitoringDb();
  await resetAppDb();
  await verify();
  console.log("\nSelesai. Restart app-service & monitoring-service jika sedang jalan.");
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
