/**
 * Seed katalog stress test + demo UI — petani dummy, screenhouse di peta, node monitoring.
 * Satu titik peta = satu screenhouse (tanpa duplikat koordinat).
 *
 *   cd database/scripts && npm install
 *   npm run seed:stress                    # default 60 titik unik
 *   STRESS_SH_COUNT=40 npm run seed:stress
 *
 * Password petani demo: 123456 · Telepon: 081300000001 ..
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";
import { MAP_SCREENHOUSES, DEFAULT_THRESHOLD } from "./data/map-screenhouses.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(ROOT, "services/app-service/.env") });

const BCRYPT_123456 = "$2b$10$CpSrK0m24PkChDP3crnSjuarCH3OFl9m2tr3f.fPmD7J7GO3c4biS";
const REGENCY_KODE = "32.02";
const PROVINCE_KODE = "32";
const STRESS_PREFIX = "Stress Demo";

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

const MAX_MAP_POINTS = MAP_SCREENHOUSES.length;
const SH_COUNT = Math.min(
  Number(process.env.STRESS_SH_COUNT || MAX_MAP_POINTS),
  MAX_MAP_POINTS
);
const FARMER_COUNT = Number(process.env.STRESS_FARMER_COUNT || Math.min(25, SH_COUNT));

function formatShCode(screenhouseId) {
  return `SH${String(screenhouseId).padStart(2, "0")}`;
}

function farmerPhone(index) {
  return `0813${String(index).padStart(8, "0")}`;
}

async function deleteStressScreenhouse(monClient, appClient, screenhouseId) {
  await monClient.query(
    `DELETE FROM sensor_data WHERE sensor_node_id IN (SELECT id FROM sensor_nodes WHERE screenhouse_id = $1)`,
    [screenhouseId]
  );
  await monClient.query(
    `DELETE FROM alerts WHERE screenhouse_id = $1 OR sensor_node_id IN (
      SELECT id FROM sensor_nodes WHERE screenhouse_id = $1
    )`,
    [screenhouseId]
  );
  await monClient.query(`DELETE FROM actuator_logs WHERE screenhouse_id = $1`, [screenhouseId]);
  await monClient.query(`DELETE FROM sensor_nodes WHERE screenhouse_id = $1`, [screenhouseId]);
  await monClient.query(`DELETE FROM sink_nodes WHERE screenhouse_id = $1`, [screenhouseId]);
  await monClient.query(`DELETE FROM threshold_snapshots WHERE screenhouse_id = $1`, [screenhouseId]);
  await monClient.query(`DELETE FROM screenhouse_registry WHERE screenhouse_id = $1`, [screenhouseId]);
  await appClient.query(`DELETE FROM thresholds WHERE screenhouse_id = $1`, [screenhouseId]);
  await appClient.query(`DELETE FROM screenhouses WHERE id = $1`, [screenhouseId]);
}

function nearestMapIndex(lat, lng) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < MAP_SCREENHOUSES.length; i += 1) {
    const p = MAP_SCREENHOUSES[i];
    const d = (lat - p.lat) ** 2 + (lng - p.lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Hapus Stress Demo di titik peta sama — simpan id terbesar (terbaru) */
async function dedupeStressDemoByCoordinates(appClient, monClient) {
  const rows = await appClient.query(
    `SELECT id, latitude, longitude FROM screenhouses WHERE name LIKE $1 ORDER BY id`,
    [`${STRESS_PREFIX}%`]
  );

  const byMapPoint = new Map();
  for (const row of rows.rows) {
    const mapIdx = nearestMapIndex(Number(row.latitude), Number(row.longitude));
    if (!byMapPoint.has(mapIdx)) byMapPoint.set(mapIdx, []);
    byMapPoint.get(mapIdx).push(row.id);
  }

  const toDelete = [];
  for (const ids of byMapPoint.values()) {
    if (ids.length <= 1) continue;
    ids.sort((a, b) => b - a);
    toDelete.push(...ids.slice(1));
  }

  for (const screenhouseId of toDelete) {
    await deleteStressScreenhouse(monClient, appClient, screenhouseId);
  }
  return toDelete.length;
}

async function cleanupLegacyLoadTest(monClient) {
  await monClient.query(`
    DELETE FROM sensor_data
    WHERE sensor_node_id IN (SELECT id FROM sensor_nodes WHERE node_code LIKE 'LT-%')
  `);
  await monClient.query(`
    DELETE FROM alerts WHERE sensor_node_id IN (
      SELECT id FROM sensor_nodes WHERE node_code LIKE 'LT-%'
    )
  `);
  await monClient.query(`DELETE FROM sensor_nodes WHERE node_code LIKE 'LT-%'`);
  await monClient.query(`DELETE FROM sink_nodes WHERE node_code LIKE 'LT-%'`);
  await monClient.query(`
    DELETE FROM threshold_snapshots
    WHERE screenhouse_id >= 10001 AND screenhouse_id < 20000
  `);
  await monClient.query(`
    DELETE FROM screenhouse_registry
    WHERE screenhouse_id >= 10001 AND screenhouse_id < 20000
  `);
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

async function getVillageId(client, districtId) {
  const v = await client.query(
    `SELECT id FROM villages WHERE district_id = $1 ORDER BY id LIMIT 1`,
    [districtId]
  );
  return v.rows[0]?.id ?? null;
}

async function upsertFarmer(appClient, farmerIndex) {
  const phone = farmerPhone(farmerIndex);
  const name = `Petani Demo ${String(farmerIndex).padStart(2, "0")}`;
  const existing = await appClient.query(`SELECT id FROM users WHERE phone_number = $1`, [phone]);
  if (existing.rows[0]) {
    await appClient.query(
      `UPDATE users SET name = $2, role = 'petani', status = 'approved' WHERE id = $1`,
      [existing.rows[0].id, name]
    );
    return existing.rows[0].id;
  }
  const ins = await appClient.query(
    `
    INSERT INTO users (name, phone_number, password, role, status)
    VALUES ($1, $2, $3, 'petani', 'approved')
    RETURNING id
    `,
    [name, phone, BCRYPT_123456]
  );
  return ins.rows[0].id;
}

async function upsertScreenhouse(appClient, { name, ownerId, point, wilayah, villageId }) {
  const existing = await appClient.query(`SELECT id FROM screenhouses WHERE name = $1`, [name]);
  if (existing.rows[0]) {
    await appClient.query(
      `
      UPDATE screenhouses SET
        owner_user_id = $2,
        address_detail = $3,
        latitude = $4,
        longitude = $5,
        tray_count = 1,
        status = 'active',
        province_id = $6,
        regency_id = $7,
        district_id = $8,
        village_id = $9
      WHERE id = $1
      `,
      [
        existing.rows[0].id,
        ownerId,
        point.address,
        point.lat,
        point.lng,
        wilayah.province_id,
        wilayah.regency_id,
        wilayah.district_id,
        villageId,
      ]
    );
    return existing.rows[0].id;
  }

  const ins = await appClient.query(
    `
    INSERT INTO screenhouses (
      name, province_id, regency_id, district_id, village_id,
      owner_user_id, address_detail, latitude, longitude, tray_count, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, 'active')
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
    ]
  );
  return ins.rows[0].id;
}

async function upsertThreshold(appClient, screenhouseId) {
  const cols = Object.keys(DEFAULT_THRESHOLD);
  const exists = await appClient.query(`SELECT 1 FROM thresholds WHERE screenhouse_id = $1`, [screenhouseId]);
  if (exists.rows[0]) return;
  const placeholders = cols.map((_, i) => `$${i + 2}`).join(", ");
  await appClient.query(
    `INSERT INTO thresholds (screenhouse_id, ${cols.join(", ")}) VALUES ($1, ${placeholders})`,
    [screenhouseId, ...cols.map((c) => DEFAULT_THRESHOLD[c])]
  );
}

async function provisionMonitoring(monClient, screenhouseId, ownerId, screenhouseName) {
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

  await monClient.query(
    `
    INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
    VALUES ($1, $2, 'Tray A1', 'Pusat pembibitan', 60, true)
    ON CONFLICT (node_code) DO UPDATE SET
      screenhouse_id = EXCLUDED.screenhouse_id,
      is_active = true
    `,
    [screenhouseId, trayCode]
  );

  return { sinkCode, trayCode, sinkId };
}

async function main() {
  const dedupeOnly = process.argv.includes("--dedupe-only");
  console.log(`═══ Seed stress test + demo UI (${SH_COUNT} titik unik, ${FARMER_COUNT} petani) ═══`);

  const appClient = await appPool.connect();
  const monClient = await monPool.connect();

  try {
    await appClient.query("BEGIN");
    await monClient.query("BEGIN");

    if (!dedupeOnly) {
      await cleanupLegacyLoadTest(monClient);
    }

    const removed = await dedupeStressDemoByCoordinates(appClient, monClient);
    if (removed > 0) {
      console.log(`Dedupe koordinat: ${removed} screenhouse lama dihapus (simpan yang terbaru)`);
    }

    if (dedupeOnly) {
      await appClient.query("COMMIT");
      await monClient.query("COMMIT");
      console.log("Selesai (--dedupe-only).");
      return;
    }

    const districts = await loadDistricts(appClient);
    if (districts.length === 0) {
      throw new Error("Wilayah kosong — jalankan database/app/seed.sql atau npm run import");
    }

    const farmerIds = [];
    for (let f = 1; f <= FARMER_COUNT; f += 1) {
      farmerIds.push(await upsertFarmer(appClient, f));
    }

    const created = [];
    for (let i = 0; i < SH_COUNT; i += 1) {
      const point = MAP_SCREENHOUSES[i];
      const ownerId = farmerIds[i % farmerIds.length];
      const seq = String(i + 1).padStart(3, "0");
      const name = `${STRESS_PREFIX} ${point.district} ${seq}`;

      const wilayah = await resolveWilayah(appClient, point.district, districts, i);
      if (!wilayah) continue;

      const villageId = await getVillageId(appClient, wilayah.district_id);
      if (!villageId) continue;

      const screenhouseId = await upsertScreenhouse(appClient, {
        name,
        ownerId,
        point,
        wilayah,
        villageId,
      });
      await upsertThreshold(appClient, screenhouseId);
      const nodes = await provisionMonitoring(monClient, screenhouseId, ownerId, name);
      created.push({ screenhouseId, name, ownerId, ...nodes });
    }

    await dedupeStressDemoByCoordinates(appClient, monClient);

    await appClient.query("COMMIT");
    await monClient.query("COMMIT");

    const total = await appClient.query(
      `SELECT COUNT(*)::int AS n FROM screenhouses WHERE name LIKE $1`,
      [`${STRESS_PREFIX}%`]
    );

    console.log(`Selesai: ${created.length} di-upsert · ${total.rows[0].n} Stress Demo aktif (unik per koordinat)`);
    console.log(`Contoh login petani: ${farmerPhone(1)} / 123456`);
    if (created[0]) {
      console.log(
        `Contoh node: ${created[0].trayCode} → screenhouse/${created[0].screenhouseId}/sink/${created[0].sinkCode}/sensor`
      );
    }
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
  console.error("seed:stress gagal:", err.message);
  process.exit(1);
});
