/**
 * Seed real-looking thesis screenhouses and active sensor_nodes.
 *
 * This script intentionally does not create LT-* virtual node codes. It creates
 * normal application records and matching monitoring records so the load test
 * can use the same users -> screenhouses -> sensor_nodes path as production.
 *
 *   npm run seed:nodes
 *   THESIS_TARGET_SENSOR_NODES=1600 npm run seed:nodes
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env") });

const TARGET_SENSOR_NODES = Number(process.env.THESIS_TARGET_SENSOR_NODES || 1600);
const TRAYS_PER_SCREENHOUSE = Math.min(
  20,
  Math.max(1, Number(process.env.THESIS_TRAYS_PER_SCREENHOUSE || 20))
);
const PHONE_PREFIX = process.env.THESIS_PHONE_PREFIX || "08270";
const USER_NAME_PREFIX = process.env.THESIS_USER_NAME_PREFIX || "Petani Thesis";
const SCREENHOUSE_NAME_PREFIX =
  process.env.THESIS_SCREENHOUSE_NAME_PREFIX || "Screenhouse Thesis";
const PASSWORD_HASH =
  process.env.THESIS_USER_PASSWORD_HASH ||
  "$2b$10$CpSrK0m24PkChDP3crnSjuarCH3OFl9m2tr3f.fPmD7J7GO3c4biS";

const IGNORED_PHONE_NUMBERS = ["081111111111", "081300000047"];

const THRESHOLD_DEFAULTS = {
  min_nitrogen: 20,
  max_nitrogen: 45,
  min_phosphorus: 10,
  max_phosphorus: 30,
  min_potassium: 40,
  max_potassium: 120,
  min_soil_moisture: 50,
  max_soil_moisture: 80,
  min_soil_temperature: 20,
  max_soil_temperature: 35,
  min_soil_ph: 5.5,
  max_soil_ph: 7.0,
  min_conductivity: 200,
  max_conductivity: 800,
  min_air_temperature: 22,
  max_air_temperature: 35,
  min_air_humidity: 40,
  max_air_humidity: 85,
  min_light_intensity: 5000,
  max_light_intensity: 50000,
};

const appPool = new pg.Pool({
  host: process.env.DB_APP_HOST || process.env.APP_DB_HOST || "localhost",
  port: Number(process.env.DB_APP_PORT || process.env.APP_DB_PORT || 5434),
  user: process.env.DB_APP_USER || process.env.APP_DB_USER || process.env.DB_USER || "postgres",
  password:
    process.env.DB_APP_PASSWORD ||
    process.env.APP_DB_PASSWORD ||
    process.env.DB_PASSWORD ||
    "postgres",
  database: process.env.DB_APP_NAME || process.env.APP_DB_NAME || "screenhouse_app",
});

const monitoringPool = new pg.Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5433),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "screenhouse_monitoring",
});

function formatShCode(screenhouseId) {
  return `SH${String(screenhouseId).padStart(2, "0")}`;
}

function formatSinkCode(screenhouseId) {
  return `${formatShCode(screenhouseId)}-SINK`;
}

function formatTrayCode(screenhouseId, trayIndex) {
  return `${formatShCode(screenhouseId)}-T${String(trayIndex).padStart(2, "0")}`;
}

function thesisPhone(index) {
  return `${PHONE_PREFIX}${String(index).padStart(7, "0")}`;
}

function thresholdColumns() {
  return Object.keys(THRESHOLD_DEFAULTS);
}

async function loadEligibleScreenhouseIds(appClient) {
  const result = await appClient.query(
    `
    SELECT sh.id
    FROM screenhouses sh
    INNER JOIN users u ON u.id = sh.owner_user_id
    WHERE sh.status = 'active'
      AND u.phone_number <> ALL($1::text[])
    ORDER BY sh.id
    `,
    [IGNORED_PHONE_NUMBERS]
  );
  return result.rows.map((row) => Number(row.id));
}

async function countEligibleSensorNodes(appClient, monitoringClient) {
  const screenhouseIds = await loadEligibleScreenhouseIds(appClient);
  if (!screenhouseIds.length) return 0;

  const result = await monitoringClient.query(
    `
    SELECT COUNT(*)::int AS total
    FROM sensor_nodes sn
    INNER JOIN sink_nodes sk
      ON sk.screenhouse_id = sn.screenhouse_id
     AND sk.is_active = true
    WHERE sn.is_active = true
      AND sn.screenhouse_id = ANY($1::int[])
    `,
    [screenhouseIds]
  );
  return result.rows[0]?.total ?? 0;
}

async function resolveWilayah(appClient) {
  const existing = await appClient.query(
    `
    SELECT province_id, regency_id, district_id, village_id
    FROM screenhouses
    WHERE province_id IS NOT NULL
      AND regency_id IS NOT NULL
      AND district_id IS NOT NULL
      AND village_id IS NOT NULL
    ORDER BY id
    LIMIT 1
    `
  );
  if (existing.rows[0]) return existing.rows[0];

  const fallback = await appClient.query(
    `
    SELECT
      p.id AS province_id,
      r.id AS regency_id,
      d.id AS district_id,
      v.id AS village_id
    FROM provinces p
    INNER JOIN regencies r ON r.province_id = p.id
    INNER JOIN districts d ON d.regency_id = r.id
    INNER JOIN villages v ON v.district_id = d.id
    ORDER BY p.id, r.id, d.id, v.id
    LIMIT 1
    `
  );
  if (!fallback.rows[0]) {
    throw new Error("Wilayah data is empty. Seed/import app wilayah data before seeding thesis nodes.");
  }
  return fallback.rows[0];
}

async function nextThesisIndex(appClient) {
  const result = await appClient.query(
    `
    SELECT phone_number
    FROM users
    WHERE phone_number LIKE $1
    ORDER BY phone_number DESC
    LIMIT 1
    `,
    [`${PHONE_PREFIX}%`]
  );
  const phone = result.rows[0]?.phone_number;
  if (!phone) return 1;

  const suffix = Number(phone.slice(PHONE_PREFIX.length));
  return Number.isInteger(suffix) ? suffix + 1 : 1;
}

async function createFarmer(appClient, index) {
  const phone = thesisPhone(index);
  const name = `${USER_NAME_PREFIX} ${String(index).padStart(4, "0")}`;

  if (IGNORED_PHONE_NUMBERS.includes(phone)) {
    throw new Error(`Generated phone number is ignored by load test: ${phone}`);
  }

  const result = await appClient.query(
    `
    INSERT INTO users (name, phone_number, password, role, status)
    VALUES ($1, $2, $3, 'petani', 'approved')
    ON CONFLICT (phone_number) DO UPDATE SET
      name = EXCLUDED.name,
      role = 'petani',
      status = 'approved'
    RETURNING id, name, phone_number
    `,
    [name, phone, PASSWORD_HASH]
  );
  return result.rows[0];
}

async function createScreenhouse(appClient, { farmer, wilayah, index, trayCount }) {
  const name = `${SCREENHOUSE_NAME_PREFIX} ${String(index).padStart(4, "0")}`;
  const latitude = -6.9 + (index % 90) * 0.001;
  const longitude = 107.5 + (index % 90) * 0.001;

  const result = await appClient.query(
    `
    INSERT INTO screenhouses (
      name, province_id, regency_id, district_id, village_id,
      owner_user_id, address_detail, latitude, longitude, tray_count,
      seed_variety, seedling_start_date, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Ciherang', CURRENT_DATE - 14, 'active')
    RETURNING id, name, owner_user_id, tray_count
    `,
    [
      name,
      wilayah.province_id,
      wilayah.regency_id,
      wilayah.district_id,
      wilayah.village_id,
      farmer.id,
      `Dataset thesis load test ${index}`,
      latitude,
      longitude,
      trayCount,
    ]
  );
  return result.rows[0];
}

async function upsertAppThreshold(appClient, screenhouseId) {
  const cols = thresholdColumns();
  const values = cols.map((col) => THRESHOLD_DEFAULTS[col]);
  const placeholders = cols.map((_, i) => `$${i + 2}`).join(", ");
  const updates = cols.map((col) => `${col} = EXCLUDED.${col}`).join(", ");

  await appClient.query(
    `
    INSERT INTO thresholds (screenhouse_id, ${cols.join(", ")})
    VALUES ($1, ${placeholders})
    ON CONFLICT (screenhouse_id) DO UPDATE SET ${updates}
    `,
    [screenhouseId, ...values]
  );
}

async function provisionMonitoring(monitoringClient, screenhouse) {
  const screenhouseId = Number(screenhouse.id);
  const trayCount = Number(screenhouse.tray_count);
  const cols = thresholdColumns();
  const values = cols.map((col) => THRESHOLD_DEFAULTS[col]);

  await monitoringClient.query(
    `
    INSERT INTO screenhouse_registry (screenhouse_id, owner_user_id, screenhouse_name, status, updated_at)
    VALUES ($1, $2, $3, 'active', NOW())
    ON CONFLICT (screenhouse_id) DO UPDATE SET
      owner_user_id = EXCLUDED.owner_user_id,
      screenhouse_name = EXCLUDED.screenhouse_name,
      status = 'active',
      updated_at = NOW()
    `,
    [screenhouseId, screenhouse.owner_user_id, screenhouse.name]
  );

  const thresholdPlaceholders = cols.map((_, i) => `$${i + 2}`).join(", ");
  const thresholdUpdates = cols.map((col) => `${col} = EXCLUDED.${col}`).join(", ");
  await monitoringClient.query(
    `
    INSERT INTO threshold_snapshots (screenhouse_id, ${cols.join(", ")}, updated_at)
    VALUES ($1, ${thresholdPlaceholders}, NOW())
    ON CONFLICT (screenhouse_id) DO UPDATE SET ${thresholdUpdates}, updated_at = NOW()
    `,
    [screenhouseId, ...values]
  );

  await monitoringClient.query(
    `
    INSERT INTO sink_nodes (screenhouse_id, node_code, node_name, relay_channels, is_active)
    VALUES ($1, $2, $3, 3, true)
    ON CONFLICT (screenhouse_id) DO UPDATE SET
      node_code = EXCLUDED.node_code,
      node_name = EXCLUDED.node_name,
      is_active = true,
      updated_at = NOW()
    `,
    [screenhouseId, formatSinkCode(screenhouseId), `Sink Node ${formatShCode(screenhouseId)}`]
  );

  for (let tray = 1; tray <= trayCount; tray += 1) {
    await monitoringClient.query(
      `
      INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
      VALUES ($1, $2, $3, $4, 60, true)
      ON CONFLICT (node_code) DO UPDATE SET
        screenhouse_id = EXCLUDED.screenhouse_id,
        node_name = EXCLUDED.node_name,
        location = EXCLUDED.location,
        send_interval_seconds = EXCLUDED.send_interval_seconds,
        is_active = true
      `,
      [
        screenhouseId,
        formatTrayCode(screenhouseId, tray),
        `Rak bibit ${tray}`,
        `Area pembibitan ${Math.ceil(tray / 4)}`,
      ]
    );
  }
}

async function seedMissingNodes() {
  const appClient = await appPool.connect();
  const monitoringClient = await monitoringPool.connect();

  try {
    const before = await countEligibleSensorNodes(appClient, monitoringClient);
    const missing = Math.max(TARGET_SENSOR_NODES - before, 0);

    console.log("Thesis load-test sensor seed");
    console.log(`  Eligible active sensor_nodes now : ${before}`);
    console.log(`  Target eligible sensor_nodes     : ${TARGET_SENSOR_NODES}`);

    if (missing === 0) {
      console.log("  No seed needed.");
      return;
    }

    const screenhousesNeeded = Math.ceil(missing / TRAYS_PER_SCREENHOUSE);
    const wilayah = await resolveWilayah(appClient);
    let index = await nextThesisIndex(appClient);

    console.log(`  Missing sensor_nodes             : ${missing}`);
    console.log(`  Creating screenhouses            : ${screenhousesNeeded}`);
    console.log(`  Trays per screenhouse            : ${TRAYS_PER_SCREENHOUSE}`);

    await appClient.query("BEGIN");
    await monitoringClient.query("BEGIN");

    let createdSensors = 0;
    for (let i = 0; i < screenhousesNeeded; i += 1) {
      const remaining = missing - createdSensors;
      const trayCount = Math.min(TRAYS_PER_SCREENHOUSE, remaining);
      const farmer = await createFarmer(appClient, index);
      const screenhouse = await createScreenhouse(appClient, {
        farmer,
        wilayah,
        index,
        trayCount,
      });

      await upsertAppThreshold(appClient, screenhouse.id);
      await provisionMonitoring(monitoringClient, screenhouse);

      createdSensors += trayCount;
      console.log(
        `  + ${screenhouse.name} (${formatSinkCode(screenhouse.id)}) ` +
          `${trayCount} sensors, owner ${farmer.phone_number}`
      );
      index += 1;
    }

    await appClient.query("COMMIT");
    await monitoringClient.query("COMMIT");

    const after = await countEligibleSensorNodes(appClient, monitoringClient);
    console.log(`Done. Eligible active sensor_nodes: ${after}`);
  } catch (err) {
    await appClient.query("ROLLBACK").catch(() => {});
    await monitoringClient.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    appClient.release();
    monitoringClient.release();
    await appPool.end();
    await monitoringPool.end();
  }
}

seedMissingNodes().catch((err) => {
  console.error("seed:nodes failed:", err.message);
  process.exit(1);
});
