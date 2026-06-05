/**
 * Seed screenhouse demo tersebar di peta Kab. Sukabumi (App DB + Monitoring DB).
 *
 * Prasyarat: import wilayah sudah jalan (npm run import).
 *
 *   cd database/scripts && npm run seed:map
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(ROOT, "services/app-service/.env") });

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

const OWNER_ID = 1;
const REGENCY_KODE = "32.02";
const PROVINCE_KODE = "32";

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

  if (exact.rows[0]) return { ...exact.rows[0], matched: districtName };

  if (allDistricts.length === 0) return null;

  const fallback = allDistricts[index % allDistricts.length];
  return {
    province_id: fallback.province_id,
    regency_id: fallback.regency_id,
    district_id: fallback.district_id,
    matched: `${fallback.name} (koordinat peta: ${districtName})`,
  };
}

async function getVillageId(client, districtId) {
  const v = await client.query(
    `SELECT id FROM villages WHERE district_id = $1 ORDER BY id LIMIT 1`,
    [districtId]
  );
  return v.rows[0]?.id || null;
}

async function seedOne(appClient, monClient, point, index, allDistricts) {
  const wilayah = await resolveWilayah(appClient, point.district, allDistricts, index);
  if (!wilayah) {
    console.warn(`  SKIP ${point.name} — tidak ada data kecamatan (jalankan app seed atau npm run import)`);
    return { skipped: true };
  }

  const villageId = await getVillageId(appClient, wilayah.district_id);
  if (!villageId) {
    console.warn(`  SKIP ${point.name} — tidak ada desa di kecamatan ${point.district}`);
    return { skipped: true };
  }

  const existing = await appClient.query(
    `SELECT id FROM screenhouses WHERE name = $1`,
    [point.name]
  );

  let screenhouseId;
  if (existing.rows[0]) {
    screenhouseId = existing.rows[0].id;
  } else {
    const ins = await appClient.query(
      `
      INSERT INTO screenhouses (
        name, province_id, regency_id, district_id, village_id,
        owner_user_id, address_detail, latitude, longitude, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
      RETURNING id
      `,
      [
        point.name,
        wilayah.province_id,
        wilayah.regency_id,
        wilayah.district_id,
        villageId,
        OWNER_ID,
        point.address,
        point.lat,
        point.lng,
      ]
    );
    screenhouseId = ins.rows[0].id;
  }

  const thCols = Object.keys(DEFAULT_THRESHOLD);
  const thExists = await appClient.query(
    `SELECT 1 FROM thresholds WHERE screenhouse_id = $1`,
    [screenhouseId]
  );
  if (!thExists.rows[0]) {
    const placeholders = thCols.map((_, i) => `$${i + 2}`).join(", ");
    await appClient.query(
      `INSERT INTO thresholds (screenhouse_id, ${thCols.join(", ")})
       VALUES ($1, ${placeholders})`,
      [screenhouseId, ...thCols.map((c) => DEFAULT_THRESHOLD[c])]
    );
  }

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
    [screenhouseId, OWNER_ID, point.name]
  );

  const snapCols = Object.keys(DEFAULT_THRESHOLD);
  const snapPlaceholders = snapCols.map((_, i) => `$${i + 2}`).join(", ");
  const snapSet = snapCols.map((c) => `${c} = EXCLUDED.${c}`).join(", ");
  await monClient.query(
    `
    INSERT INTO threshold_snapshots (screenhouse_id, ${snapCols.join(", ")}, updated_at)
    VALUES ($1, ${snapPlaceholders}, NOW())
    ON CONFLICT (screenhouse_id) DO UPDATE SET ${snapSet}, updated_at = NOW()
    `,
    [screenhouseId, ...snapCols.map((c) => DEFAULT_THRESHOLD[c])]
  );

  const nodeExists = await monClient.query(
    `SELECT id FROM sensor_nodes WHERE node_code = $1`,
    [point.nodeCode]
  );

  let nodeId;
  if (nodeExists.rows[0]) {
    nodeId = nodeExists.rows[0].id;
  } else {
    const nodeIns = await monClient.query(
      `
      INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
      VALUES ($1, $2, 'Node Utama', 'Pusat screenhouse', 60, true)
      RETURNING id
      `,
      [screenhouseId, point.nodeCode]
    );
    nodeId = nodeIns.rows[0].id;
  }

  const sensor = demoSensorValues(index);
  const hasRecent = await monClient.query(
    `SELECT 1 FROM sensor_data WHERE sensor_node_id = $1 AND created_at >= NOW() - INTERVAL '24 hours' LIMIT 1`,
    [nodeId]
  );

  if (!hasRecent.rows[0]) {
    await monClient.query(
      `
      INSERT INTO sensor_data (
        sensor_node_id, nitrogen, phosphorus, potassium,
        soil_temperature, soil_moisture, soil_ph, conductivity,
        air_temperature, air_humidity, light_intensity,
        fan_status, irrigation_status, lamp_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW() - INTERVAL '2 hours')
      `,
      [
        nodeId,
        sensor.nitrogen,
        sensor.phosphorus,
        sensor.potassium,
        sensor.soil_temperature,
        sensor.soil_moisture,
        sensor.soil_ph,
        sensor.conductivity,
        sensor.air_temperature,
        sensor.air_humidity,
        sensor.light_intensity,
        sensor.fan_status,
        sensor.irrigation_status,
        sensor.lamp_status,
      ]
    );
  }

  return { skipped: false, screenhouseId, created: !existing.rows[0] };
}

async function main() {
  console.log(`Seeding ${MAP_SCREENHOUSES.length} titik peta...`);
  console.log(`  App DB: ${appPool.options.database} @ ${appPool.options.port}`);
  console.log(`  Monitoring DB: ${monPool.options.database} @ ${monPool.options.port}`);

  const appClient = await appPool.connect();
  const monClient = await monPool.connect();

  let created = 0;
  let skipped = 0;
  let existing = 0;

  try {
    await appClient.query("BEGIN");
    await monClient.query("BEGIN");

    const allDistricts = await loadDistricts(appClient);
    if (allDistricts.length === 0) {
      console.error("Tidak ada kecamatan di DB. Jalankan database/app/seed.sql dulu.");
      process.exit(1);
    }
    console.log(`  Kecamatan di DB: ${allDistricts.length} (titik peta pakai lat/lng, wilayah fallback jika perlu)`);

    for (let i = 0; i < MAP_SCREENHOUSES.length; i++) {
      const result = await seedOne(appClient, monClient, MAP_SCREENHOUSES[i], i, allDistricts);
      if (result.skipped) skipped++;
      else if (result.created) {
        created++;
        console.log(`  + ${MAP_SCREENHOUSES[i].name} (id ${result.screenhouseId})`);
      } else existing++;
    }

    await appClient.query("COMMIT");
    await monClient.query("COMMIT");

    console.log(`\nSelesai: ${created} baru, ${existing} sudah ada, ${skipped} dilewati.`);
    console.log(`Total target: ${MAP_SCREENHOUSES.length} screenhouse di peta.`);
  } catch (err) {
    await appClient.query("ROLLBACK");
    await monClient.query("ROLLBACK");
    console.error(err);
    process.exit(1);
  } finally {
    appClient.release();
    monClient.release();
    await appPool.end();
    await monPool.end();
  }
}

main();
