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
import { MAP_SCREENHOUSES, DEFAULT_THRESHOLD, demoSensorValues } from "./data/map-screenhouses.js";
import { farmerName, seedProfile } from "./data/farmer-names.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(ROOT, "services/app-service/.env") });

const BCRYPT_123456 = "$2b$10$CpSrK0m24PkChDP3crnSjuarCH3OFl9m2tr3f.fPmD7J7GO3c4biS";
const REGENCY_KODE = "32.02";
const PROVINCE_KODE = "32";
const SH_NAME_PREFIX = "Screenhouse";
// Cocokkan hanya screenhouse hasil seed ini ("Screenhouse <Kecamatan> 001"),
// bukan sembarang screenhouse yang kebetulan berawalan "Screenhouse".
const SEED_NAME_RE = "^Screenhouse .+ [0-9]{3}$";

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

// Mode representatif untuk load test dashboard: setiap petani mendapat 1
// screenhouse + data (reading sensor + 1 siklus completed), supaya VU k6 tidak
// memukul endpoint kosong. 60 titik peta dipakai ulang dengan jitter koordinat,
// dan dedupe-per-koordinat dilewati (kalau tidak, screenhouse "kembar" dihapus).
const PER_FARMER = /^(1|true|yes)$/i.test(process.env.STRESS_PER_FARMER || "");

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

// Geser koordinat ~100 m per "lapisan" wrap supaya tiap screenhouse unik saat
// 60 titik peta dipakai ulang untuk ratusan petani (mode PER_FARMER).
function jitterPoint(point, wrap) {
  const d = 0.0009 * wrap;
  return {
    ...point,
    lat: point.lat + d,
    lng: point.lng + d * 0.6,
    address: `${point.address} (blok ${wrap + 1})`,
  };
}

// Satu siklus semai "completed" per screenhouse agar GET /my-cycles?status=completed
// mengembalikan data (dengan payload analytics JSONB) — bukan array kosong.
async function upsertCompletedCycle(appClient, screenhouseId, profileIndex) {
  const exists = await appClient.query(
    `SELECT 1 FROM semai_cycles WHERE screenhouse_id = $1 AND status = 'completed' LIMIT 1`,
    [screenhouseId]
  );
  if (exists.rows[0]) return;

  const profile = seedProfile(profileIndex);
  const grade = ["A", "B", "C"][profileIndex % 3];
  const durasi = profile.seedling_days || 21;
  const analytics = {
    durasi,
    uptime: 98,
    stability: [],
    stress: [],
    actuators: [],
    grade,
    computed_at: new Date().toISOString(),
  };

  await appClient.query(
    `
    INSERT INTO semai_cycles (
      screenhouse_id, varietas_nama, tanggal_mulai, tanggal_selesai, estimasi_siap,
      durasi_target_hari, status, grade, analytics
    ) VALUES (
      $1, $2, CURRENT_DATE - ($3 + 14)::int, CURRENT_DATE - 14, CURRENT_DATE - 14,
      $3, 'completed', $4, $5::jsonb
    )
    `,
    [screenhouseId, profile.seed_variety, durasi, grade, JSON.stringify(analytics)]
  );
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

/** Hapus screenhouse seed di titik peta sama — simpan id terbesar (terbaru) */
async function dedupeStressDemoByCoordinates(appClient, monClient) {
  const rows = await appClient.query(
    `SELECT id, latitude, longitude FROM screenhouses WHERE name ~ $1 ORDER BY id`,
    [SEED_NAME_RE]
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
  const name = farmerName(farmerIndex);
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

async function upsertScreenhouse(appClient, { name, ownerId, point, wilayah, villageId, profileIndex = 0 }) {
  const profile = seedProfile(profileIndex);
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
        village_id = $9,
        seed_variety = $10,
        seedling_start_date = CURRENT_DATE - $11::int
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
        profile.seed_variety,
        profile.seedling_days,
      ]
    );
    return existing.rows[0].id;
  }

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

async function provisionMonitoring(monClient, screenhouseId, ownerId, screenhouseName, profileIndex = 0) {
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
      is_active = true
    RETURNING id
    `,
    [screenhouseId, trayCode]
  );
  const sensorNodeId = sensorRes.rows[0].id;

  const hasReading = await monClient.query(
    `SELECT 1 FROM sensor_data WHERE sensor_node_id = $1 LIMIT 1`,
    [sensorNodeId]
  );
  if (!hasReading.rows[0]) {
    const vals = demoSensorValues(profileIndex);
    await monClient.query(
      `
      INSERT INTO sensor_data (
        sensor_node_id, sink_node_id,
        nitrogen, phosphorus, potassium,
        soil_temperature, soil_moisture, soil_ph, conductivity,
        air_temperature, air_humidity, light_intensity, created_at
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

  return { sinkCode, trayCode, sinkId, sensorNodeId };
}

async function main() {
  const dedupeOnly = process.argv.includes("--dedupe-only");
  const shPlan = PER_FARMER ? `${FARMER_COUNT} screenhouse (1/petani)` : `${SH_COUNT} titik unik`;
  console.log(
    `═══ Seed stress test + demo UI (${shPlan}, ${FARMER_COUNT} petani${PER_FARMER ? ", mode PER_FARMER" : ""}) ═══`
  );

  const appClient = await appPool.connect();
  const monClient = await monPool.connect();

  try {
    await appClient.query("BEGIN");
    await monClient.query("BEGIN");

    if (!dedupeOnly) {
      await cleanupLegacyLoadTest(monClient);
    }

    // Mode PER_FARMER sengaja memakai koordinat kembar (jitter) — jangan dedupe,
    // karena dedupe-per-koordinat akan menghapus screenhouse per petani ini.
    if (!PER_FARMER) {
      const removed = await dedupeStressDemoByCoordinates(appClient, monClient);
      if (removed > 0) {
        console.log(`Dedupe koordinat: ${removed} screenhouse lama dihapus (simpan yang terbaru)`);
      }
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

    // Mode default: 1 screenhouse per titik peta unik (demo UI).
    // Mode PER_FARMER: 1 screenhouse per petani (data representatif load test).
    const shTargets = PER_FARMER ? FARMER_COUNT : SH_COUNT;
    const created = [];
    for (let i = 0; i < shTargets; i += 1) {
      const basePoint = MAP_SCREENHOUSES[i % MAX_MAP_POINTS];
      const wrap = Math.floor(i / MAX_MAP_POINTS);
      const point = wrap === 0 ? basePoint : jitterPoint(basePoint, wrap);
      const ownerId = PER_FARMER ? farmerIds[i] : farmerIds[i % farmerIds.length];
      const seq = String(i + 1).padStart(3, "0");
      const name = `${SH_NAME_PREFIX} ${basePoint.district} ${seq}`;

      const wilayah = await resolveWilayah(appClient, basePoint.district, districts, i);
      if (!wilayah) continue;

      const villageId = await getVillageId(appClient, wilayah.district_id);
      if (!villageId) continue;

      const screenhouseId = await upsertScreenhouse(appClient, {
        name,
        ownerId,
        point,
        wilayah,
        villageId,
        profileIndex: i,
      });
      await upsertThreshold(appClient, screenhouseId);
      const nodes = await provisionMonitoring(monClient, screenhouseId, ownerId, name, i);
      if (PER_FARMER) {
        await upsertCompletedCycle(appClient, screenhouseId, i);
      }
      created.push({ screenhouseId, name, ownerId, ...nodes });
    }

    if (!PER_FARMER) {
      await dedupeStressDemoByCoordinates(appClient, monClient);
    }

    await appClient.query("COMMIT");
    await monClient.query("COMMIT");

    const total = await appClient.query(
      `SELECT COUNT(*)::int AS n FROM screenhouses WHERE name ~ $1`,
      [SEED_NAME_RE]
    );

    console.log(`Selesai: ${created.length} di-upsert · ${total.rows[0].n} screenhouse seed aktif (unik per koordinat)`);
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
