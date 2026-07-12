/**
 * Pastikan setiap petani approved punya ≥1 screenhouse lengkap
 * (profil pembibitan, threshold, sink/tray, reading sensor).
 * Rename "Petani Demo XX" → nama manusia.
 *
 *   cd database/scripts && npm run seed:petani
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";
import {
  MAP_SCREENHOUSES,
  DEFAULT_THRESHOLD,
  demoSensorValues,
} from "./data/map-screenhouses.js";
import { farmerName, seedProfile } from "./data/farmer-names.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(ROOT, "services/app-service/.env") });

const REGENCY_KODE = "32.02";
const PROVINCE_KODE = "32";

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

function formatShCode(screenhouseId) {
  return `SH${String(screenhouseId).padStart(2, "0")}`;
}

function phoneToFarmerIndex(phone) {
  const digits = String(phone).replace(/\D/g, "");
  const tail = digits.slice(-8);
  const n = Number.parseInt(tail, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

async function loadDistricts(client) {
  const res = await client.query(
    `
    SELECT d.id AS district_id, d.name, r.id AS regency_id, p.id AS province_id
    FROM districts d
    JOIN regencies r ON r.id = d.regency_id AND r.kode = $1
    JOIN provinces p ON p.id = r.province_id AND p.kode = $2
    ORDER BY d.id
    `,
    [REGENCY_KODE, PROVINCE_KODE]
  );
  return res.rows;
}

async function resolveWilayah(client, districtName, allDistricts, index) {
  const exact = await client.query(
    `
    SELECT p.id AS province_id, r.id AS regency_id, d.id AS district_id
    FROM provinces p
    JOIN regencies r ON r.province_id = p.id AND r.kode = $1
    JOIN districts d ON d.regency_id = r.id AND lower(trim(d.name)) = lower(trim($2))
    WHERE p.kode = $3
    `,
    [REGENCY_KODE, districtName, PROVINCE_KODE]
  );
  if (exact.rows[0]) return exact.rows[0];

  if (allDistricts.length === 0) return null;
  const fallback = allDistricts[index % allDistricts.length];
  return {
    province_id: fallback.province_id,
    regency_id: fallback.regency_id,
    district_id: fallback.district_id,
  };
}

async function getVillageIdOrFallback(client, districtId) {
  const v = await client.query(
    `SELECT id FROM villages WHERE district_id = $1 ORDER BY id LIMIT 1`,
    [districtId]
  );
  if (v.rows[0]?.id) return v.rows[0].id;
  const any = await client.query(`SELECT id FROM villages ORDER BY id LIMIT 1`);
  return any.rows[0]?.id ?? null;
}

async function renamePetaniDemo(appClient) {
  const rows = await appClient.query(
    `SELECT id, phone_number, name FROM users WHERE name LIKE 'Petani Demo%' ORDER BY id`
  );
  let count = 0;
  for (const row of rows.rows) {
    const idx = phoneToFarmerIndex(row.phone_number);
    const name = farmerName(idx);
    await appClient.query(`UPDATE users SET name = $2 WHERE id = $1`, [row.id, name]);
    count += 1;
    console.log(`  ${row.name} → ${name}`);
  }
  return count;
}

async function upsertThreshold(appClient, screenhouseId) {
  const cols = Object.keys(DEFAULT_THRESHOLD);
  const exists = await appClient.query(
    `SELECT 1 FROM thresholds WHERE screenhouse_id = $1`,
    [screenhouseId]
  );
  if (exists.rows[0]) {
    await appClient.query(
      `UPDATE thresholds SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(", ")} WHERE screenhouse_id = $1`,
      [screenhouseId, ...cols.map((c) => DEFAULT_THRESHOLD[c])]
    );
    return;
  }
  const placeholders = cols.map((_, i) => `$${i + 2}`).join(", ");
  await appClient.query(
    `INSERT INTO thresholds (screenhouse_id, ${cols.join(", ")}) VALUES ($1, ${placeholders})`,
    [screenhouseId, ...cols.map((c) => DEFAULT_THRESHOLD[c])]
  );
}

async function insertScreenhouse(appClient, {
  name,
  ownerId,
  point,
  wilayah,
  villageId,
  profileIndex,
}) {
  const profile = seedProfile(profileIndex);
  const ins = await appClient.query(
    `
    INSERT INTO screenhouses (
      name, province_id, regency_id, district_id, village_id,
      owner_user_id, address_detail, latitude, longitude, tray_count,
      seed_variety, seedling_start_date, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, CURRENT_DATE - $11::int, 'active')
    RETURNING id
    `,
    [
      name,
      wilayah.province_id,
      wilayah.regency_id,
      wilayah.district_id,
      villageId,
      ownerId,
      point.address,
      point.lat,
      point.lng,
      profile.seed_variety,
      profile.seedling_days,
    ]
  );
  return ins.rows[0].id;
}

async function provisionMonitoring(monClient, screenhouseId, ownerId, screenhouseName, profileIndex) {
  const snapCols = Object.keys(DEFAULT_THRESHOLD);
  const snapPh = snapCols.map((_, i) => `$${i + 2}`).join(", ");
  const snapSet = snapCols.map((c) => `${c} = EXCLUDED.${c}`).join(", ");

  await monClient.query(
    `
    INSERT INTO screenhouse_registry (screenhouse_id, owner_user_id, screenhouse_name, status, updated_at)
    VALUES ($1, $2, $3, 'active', NOW())
    ON CONFLICT (screenhouse_id) DO UPDATE SET
      owner_user_id = EXCLUDED.owner_user_id,
      screenhouse_name = EXCLUDED.screenhouse_name,
      status = 'active',
      updated_at = NOW()
    `,
    [screenhouseId, ownerId, screenhouseName]
  );

  await monClient.query(
    `
    INSERT INTO threshold_snapshots (screenhouse_id, ${snapCols.join(", ")}, updated_at)
    VALUES ($1, ${snapPh}, NOW())
    ON CONFLICT (screenhouse_id) DO UPDATE SET ${snapSet}, updated_at = NOW()
    `,
    [screenhouseId, ...snapCols.map((c) => DEFAULT_THRESHOLD[c])]
  );

  const sinkCode = `${formatShCode(screenhouseId)}-SINK`;
  const trayCode = `${formatShCode(screenhouseId)}-T01`;

  const sinkRes = await monClient.query(
    `
    INSERT INTO sink_nodes (screenhouse_id, node_code, node_name, relay_channels, is_active)
    VALUES ($1, $2, $3, 3, true)
    ON CONFLICT (screenhouse_id) DO UPDATE SET
      node_code = EXCLUDED.node_code,
      node_name = EXCLUDED.node_name,
      is_active = true
    RETURNING id
    `,
    [screenhouseId, sinkCode, `Sink ${formatShCode(screenhouseId)}`]
  );
  const sinkId = sinkRes.rows[0].id;

  const sensorRes = await monClient.query(
    `
    INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
    VALUES ($1, $2, 'Tray A1', 'Pusat pembibitan', 60, true)
    ON CONFLICT (node_code) DO UPDATE SET
      screenhouse_id = EXCLUDED.screenhouse_id,
      node_name = EXCLUDED.node_name,
      is_active = true
    RETURNING id
    `,
    [screenhouseId, trayCode]
  );
  const sensorNodeId = sensorRes.rows[0].id;

  const existingReading = await monClient.query(
    `SELECT 1 FROM sensor_data WHERE sensor_node_id = $1 LIMIT 1`,
    [sensorNodeId]
  );
  if (!existingReading.rows[0]) {
    const vals = demoSensorValues(profileIndex);
    await monClient.query(
      `
      INSERT INTO sensor_data (
        sensor_node_id, sink_node_id,
        nitrogen, phosphorus, potassium,
        soil_temperature, soil_moisture, soil_ph, conductivity,
        air_temperature, air_humidity, light_intensity,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      `,
      [
        sensorNodeId,
        sinkId,
        vals.nitrogen,
        vals.phosphorus,
        vals.potassium,
        vals.soil_temperature,
        vals.soil_moisture,
        vals.soil_ph,
        vals.conductivity,
        vals.air_temperature,
        vals.air_humidity,
        vals.light_intensity,
      ]
    );
  }

  return { sinkCode, trayCode, sensorNodeId };
}

async function backfillScreenhouseProfiles(appClient) {
  const rows = await appClient.query(
    `SELECT id FROM screenhouses WHERE seed_variety IS NULL OR seedling_start_date IS NULL ORDER BY id`
  );
  for (const row of rows.rows) {
    const profile = seedProfile(row.id);
    await appClient.query(
      `
      UPDATE screenhouses SET
        seed_variety = COALESCE(seed_variety, $2),
        seedling_start_date = COALESCE(seedling_start_date, CURRENT_DATE - $3::int)
      WHERE id = $1
      `,
      [row.id, profile.seed_variety, profile.seedling_days]
    );
  }
  return rows.rowCount;
}

async function ensureMonitoringForExisting(appClient, monClient) {
  const rows = await appClient.query(
    `SELECT s.id, s.name, s.owner_user_id FROM screenhouses s WHERE s.status = 'active' ORDER BY s.id`
  );
  let synced = 0;
  for (const sh of rows.rows) {
    const reg = await monClient.query(
      `SELECT 1 FROM screenhouse_registry WHERE screenhouse_id = $1`,
      [sh.id]
    );
    if (reg.rows[0]) {
      const hasReading = await monClient.query(
        `
        SELECT 1 FROM sensor_data sd
        JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
        WHERE sn.screenhouse_id = $1 LIMIT 1
        `,
        [sh.id]
      );
      if (hasReading.rows[0]) continue;
    }
    await upsertThreshold(appClient, sh.id);
    await provisionMonitoring(monClient, sh.id, sh.owner_user_id, sh.name, sh.id);
    synced += 1;
  }
  return synced;
}

async function ensureAllPetaniHaveScreenhouse(appClient, monClient, districts) {
  const petani = await appClient.query(
    `
    SELECT u.id, u.name
    FROM users u
    WHERE u.role = 'petani' AND u.status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM screenhouses s
        WHERE s.owner_user_id = u.id AND s.status IN ('active', 'pending')
      )
    ORDER BY u.id
    `
  );

  let mapIndex = 0;
  const created = [];

  for (const farmer of petani.rows) {
    const point = MAP_SCREENHOUSES[mapIndex % MAP_SCREENHOUSES.length];
    mapIndex += 1;

    const wilayah = await resolveWilayah(appClient, point.district, districts, mapIndex);
    if (!wilayah) continue;

    const villageId = await getVillageIdOrFallback(appClient, wilayah.district_id);
    if (!villageId) continue;

    const name = `Screenhouse ${point.district}`;

    const screenhouseId = await insertScreenhouse(appClient, {
      name,
      ownerId: farmer.id,
      point,
      wilayah,
      villageId,
      profileIndex: farmer.id,
    });
    await upsertThreshold(appClient, screenhouseId);
    await provisionMonitoring(monClient, screenhouseId, farmer.id, name, farmer.id);
    created.push({ screenhouseId, name, owner: farmer.name });
    console.log(`  + ${farmer.name} → ${name} (id ${screenhouseId})`);
  }

  return created;
}

async function main() {
  console.log("═══ Seed petani: rename + screenhouse lengkap ═══");

  const appClient = await appPool.connect();
  const monClient = await monPool.connect();

  try {
    await appClient.query("BEGIN");
    await monClient.query("BEGIN");

    console.log("\n1. Rename Petani Demo → nama manusia");
    const renamed = await renamePetaniDemo(appClient);
    console.log(`   ${renamed} user diperbarui`);

    const districts = await loadDistricts(appClient);
    if (districts.length === 0) {
      throw new Error("Wilayah kosong — jalankan database/app/seed.sql atau npm run import");
    }

    console.log("\n2. Backfill profil pembibitan screenhouse yang ada");
    const backfilled = await backfillScreenhouseProfiles(appClient);
    console.log(`   ${backfilled} screenhouse diperbarui`);

    console.log("\n3. Sync monitoring + sensor reading untuk screenhouse existing");
    const synced = await ensureMonitoringForExisting(appClient, monClient);
    console.log(`   ${synced} screenhouse di-provision`);

    console.log("\n4. Buat screenhouse untuk petani yang belum punya");
    const created = await ensureAllPetaniHaveScreenhouse(appClient, monClient, districts);
    console.log(`   ${created.length} screenhouse baru`);

    await appClient.query("COMMIT");
    await monClient.query("COMMIT");

    const summary = await appClient.query(`
      SELECT u.name, COUNT(s.id)::int AS sh_count
      FROM users u
      LEFT JOIN screenhouses s ON s.owner_user_id = u.id AND s.status = 'active'
      WHERE u.role = 'petani'
      GROUP BY u.id, u.name
      HAVING COUNT(s.id) = 0
    `);
    console.log("\nPetani tanpa screenhouse:", summary.rowCount);
    if (summary.rowCount > 0) console.table(summary.rows);

    console.log("\nSelesai.");
  } catch (err) {
    await appClient.query("ROLLBACK");
    await monClient.query("ROLLBACK");
    throw err;
  } finally {
    appClient.release();
    monClient.release();
    await appPool.end();
    await monPool.end();
  }
}

main().catch((err) => {
  console.error("seed:petani gagal:", err.message);
  process.exit(1);
});
