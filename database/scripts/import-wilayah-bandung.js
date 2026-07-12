/**
 * Import wilayah Bandung (Jawa Barat) dari idn-area-data.
 *
 * Mencakup:
 *   - Kabupaten Bandung (32.04)
 *   - Kabupaten Bandung Barat (32.17)
 *   - Kota Bandung (32.73)
 *
 * Jalankan:
 *   cd database/scripts && npm run import:bandung
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(ROOT, "services/app-service/.env") });

const { Pool } = pg;

const BANDUNG_REGENCY_CODES = new Set(["32.04", "32.17", "32.73"]);
const JABAR_CODE = "32";

function formatName(raw) {
  if (!raw) return raw;
  return raw
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word === "dki") return "DKI";
      if (word === "di") return "DI";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

async function upsertProvince(client, province) {
  await client.query(
    `
    INSERT INTO provinces (name, kode)
    VALUES ($1, $2)
    ON CONFLICT (kode) DO UPDATE SET name = EXCLUDED.name
    `,
    [formatName(province.name), province.code]
  );
}

async function upsertRegencies(client, regencies, provinceId) {
  for (const row of regencies) {
    await client.query(
      `
      INSERT INTO regencies (province_id, name, kode)
      VALUES ($1, $2, $3)
      ON CONFLICT (kode) DO UPDATE
        SET name = EXCLUDED.name, province_id = EXCLUDED.province_id
      `,
      [provinceId, formatName(row.name), row.code]
    );
  }
}

async function upsertDistricts(client, districts, regencyIdByKode) {
  let count = 0;
  for (const row of districts) {
    const regencyId = regencyIdByKode.get(row.regency_code);
    if (!regencyId) continue;
    await client.query(
      `
      INSERT INTO districts (regency_id, name, kode)
      VALUES ($1, $2, $3)
      ON CONFLICT (kode) DO UPDATE
        SET name = EXCLUDED.name, regency_id = EXCLUDED.regency_id
      `,
      [regencyId, formatName(row.name), row.code]
    );
    count++;
  }
  return count;
}

async function upsertVillages(client, villages, districtIdByKode) {
  let count = 0;
  for (const row of villages) {
    const districtId = districtIdByKode.get(row.district_code);
    if (!districtId) continue;
    await client.query(
      `
      INSERT INTO villages (district_id, name, kode)
      VALUES ($1, $2, $3)
      ON CONFLICT (kode) DO UPDATE
        SET name = EXCLUDED.name, district_id = EXCLUDED.district_id
      `,
      [districtId, formatName(row.name), row.code]
    );
    count++;
  }
  return count;
}

async function loadRegencyIdMap(client) {
  const result = await client.query(
    `SELECT id, kode FROM regencies WHERE kode = ANY($1::text[])`,
    [[...BANDUNG_REGENCY_CODES]]
  );
  return new Map(result.rows.map((r) => [r.kode, r.id]));
}

async function loadDistrictIdMap(client, regencyIds) {
  const result = await client.query(
    `SELECT id, kode FROM districts WHERE regency_id = ANY($1::int[]) AND kode IS NOT NULL`,
    [regencyIds]
  );
  return new Map(result.rows.map((r) => [r.kode, r.id]));
}

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5434),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "screenhouse_app",
  });

  const client = await pool.connect();

  try {
    const { getProvinces, getRegencies, getDistricts, getVillages } = await import("idn-area-data");

    const [provinces, allRegencies, allDistricts, allVillages] = await Promise.all([
      getProvinces(),
      getRegencies(),
      getDistricts(),
      getVillages(),
    ]);

    const jabar = provinces.find((p) => p.code === JABAR_CODE);
    if (!jabar) throw new Error("Provinsi Jawa Barat (32) tidak ditemukan di idn-area-data");

    const bandungRegencies = allRegencies.filter((r) => BANDUNG_REGENCY_CODES.has(r.code));
    const bandungRegencyCodes = new Set(bandungRegencies.map((r) => r.code));
    const bandungDistricts = allDistricts.filter((d) => bandungRegencyCodes.has(d.regency_code));
    const bandungDistrictCodes = new Set(bandungDistricts.map((d) => d.code));
    const bandungVillages = allVillages.filter((v) => bandungDistrictCodes.has(v.district_code));

    console.log("[bandung] Target kab/kota:", bandungRegencies.map((r) => r.name).join(", "));
    console.log(`[bandung] Kecamatan: ${bandungDistricts.length}, Desa/Kel: ${bandungVillages.length}`);

    await client.query("BEGIN");

    await upsertProvince(client, jabar);
    const provinceRow = await client.query(`SELECT id FROM provinces WHERE kode = $1`, [JABAR_CODE]);
    const provinceId = provinceRow.rows[0]?.id;
    if (!provinceId) throw new Error("Gagal upsert provinsi Jawa Barat");

    await upsertRegencies(client, bandungRegencies, provinceId);
    const regencyIdByKode = await loadRegencyIdMap(client);

    const districtCount = await upsertDistricts(client, bandungDistricts, regencyIdByKode);
    const regencyIds = [...regencyIdByKode.values()];
    let districtIdByKode = await loadDistrictIdMap(client, regencyIds);

    // Reload after insert so village upsert has all district IDs
    districtIdByKode = await loadDistrictIdMap(client, regencyIds);
    const villageCount = await upsertVillages(client, bandungVillages, districtIdByKode);

    const summary = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM regencies WHERE kode = ANY($1::text[])) AS regencies,
        (SELECT COUNT(*) FROM districts d
           JOIN regencies r ON r.id = d.regency_id
          WHERE r.kode = ANY($1::text[])) AS districts,
        (SELECT COUNT(*) FROM villages v
           JOIN districts d ON d.id = v.district_id
           JOIN regencies r ON r.id = d.regency_id
          WHERE r.kode = ANY($1::text[])) AS villages
    `, [[...BANDUNG_REGENCY_CODES]]);

    await client.query("COMMIT");

    console.log("[bandung] Import selesai:", summary.rows[0]);
    console.log(`[bandung] Baru di-upsert: ${districtCount} kecamatan, ${villageCount} desa/kelurahan`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[bandung] Gagal:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
