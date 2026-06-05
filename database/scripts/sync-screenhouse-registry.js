/**
 * Sinkronkan semua screenhouse aktif dari App DB → Monitoring DB
 * (registry + threshold_snapshots). Node tidak dibuat otomatis.
 *
 *   cd database/scripts && npm run sync:registry
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(ROOT, "services/app-service/.env") });

const THRESHOLD_COLS = [
  "min_nitrogen", "max_nitrogen", "min_phosphorus", "max_phosphorus",
  "min_potassium", "max_potassium", "min_soil_moisture", "max_soil_moisture",
  "min_soil_temperature", "max_soil_temperature", "min_soil_ph", "max_soil_ph",
  "min_conductivity", "max_conductivity", "min_air_temperature", "max_air_temperature",
  "min_air_humidity", "max_air_humidity", "min_light_intensity", "max_light_intensity",
];

const appPool = new pg.Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_APP_PORT || process.env.DB_PORT || 5432),
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

async function main() {
  const rows = await appPool.query(
    `
    SELECT s.id, s.name, s.owner_user_id, s.status, t.*
    FROM screenhouses s
    LEFT JOIN thresholds t ON t.screenhouse_id = s.id
    WHERE s.status = 'active'
    ORDER BY s.id
    `
  );

  const mon = await monPool.connect();
  let synced = 0;

  try {
    await mon.query("BEGIN");
    for (const row of rows.rows) {
      await mon.query(
        `
        INSERT INTO screenhouse_registry (screenhouse_id, owner_user_id, screenhouse_name, status, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (screenhouse_id) DO UPDATE SET
          owner_user_id = EXCLUDED.owner_user_id,
          screenhouse_name = EXCLUDED.screenhouse_name,
          status = EXCLUDED.status,
          updated_at = NOW()
        `,
        [row.id, row.owner_user_id, row.name, row.status]
      );

      if (row.min_nitrogen != null) {
        const vals = THRESHOLD_COLS.map((c) => row[c] ?? null);
        const setClause = THRESHOLD_COLS.map((c) => `${c} = EXCLUDED.${c}`).join(", ");
        const placeholders = THRESHOLD_COLS.map((_, i) => `$${i + 2}`).join(", ");
        await mon.query(
          `
          INSERT INTO threshold_snapshots (screenhouse_id, ${THRESHOLD_COLS.join(", ")}, updated_at)
          VALUES ($1, ${placeholders}, NOW())
          ON CONFLICT (screenhouse_id) DO UPDATE SET ${setClause}, updated_at = NOW()
          `,
          [row.id, ...vals]
        );
      }
      synced++;
    }
    await mon.query("COMMIT");
    console.log(`Synced ${synced} screenhouse ke monitoring registry.`);
  } catch (err) {
    await mon.query("ROLLBACK");
    throw err;
  } finally {
    mon.release();
    await appPool.end();
    await monPool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
