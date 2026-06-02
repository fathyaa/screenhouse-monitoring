/**
 * Import wilayah Indonesia lengkap dari idn-area-data ke PostgreSQL.
 *
 * Prasyarat: schema.sql + seed.sql sudah dijalankan
 *
 * Jalankan:
 *   cd database/scripts && npm run import
 *
 * Opsional hapus baris lama tanpa kode:
 *   npm run import:prune
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(ROOT, "services/screenhouse-service/.env") });

const { Pool } = pg;
const BATCH_SIZE = 1000;
const PRUNE_LEGACY = process.argv.includes("--prune-legacy");

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

async function upsertProvinces(client, provinces) {
  console.log(`[wilayah] Provinsi: ${provinces.length} baris`);
  for (const row of provinces) {
    await client.query(
      `
      INSERT INTO provinces (name, kode)
      VALUES ($1, $2)
      ON CONFLICT (kode) DO UPDATE SET name = EXCLUDED.name
      `,
      [formatName(row.name), row.code]
    );
  }
}

async function upsertRegencies(client, regencies, provinceIdByKode) {
  console.log(`[wilayah] Kab/Kota: ${regencies.length} baris`);
  let skipped = 0;
  for (let i = 0; i < regencies.length; i += BATCH_SIZE) {
    const chunk = regencies.slice(i, i + BATCH_SIZE);
    for (const row of chunk) {
      const provinceId = provinceIdByKode.get(row.province_code);
      if (!provinceId) {
        skipped++;
        continue;
      }
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
    process.stdout.write(`  regencies ${Math.min(i + BATCH_SIZE, regencies.length)}/${regencies.length}\r`);
  }
  console.log(`\n  regencies selesai (skip ${skipped})`);
}

async function upsertDistricts(client, districts, regencyIdByKode) {
  console.log(`[wilayah] Kecamatan: ${districts.length} baris`);
  let skipped = 0;
  for (let i = 0; i < districts.length; i += BATCH_SIZE) {
    const chunk = districts.slice(i, i + BATCH_SIZE);
    for (const row of chunk) {
      const regencyId = regencyIdByKode.get(row.regency_code);
      if (!regencyId) {
        skipped++;
        continue;
      }
      await client.query(
        `
        INSERT INTO districts (regency_id, name, kode)
        VALUES ($1, $2, $3)
        ON CONFLICT (kode) DO UPDATE
          SET name = EXCLUDED.name, regency_id = EXCLUDED.regency_id
        `,
        [regencyId, formatName(row.name), row.code]
      );
    }
    process.stdout.write(`  districts ${Math.min(i + BATCH_SIZE, districts.length)}/${districts.length}\r`);
  }
  console.log(`\n  districts selesai (skip ${skipped})`);
}

async function upsertVillages(client, villages, districtIdByKode) {
  console.log(`[wilayah] Desa/Kelurahan: ${villages.length} baris`);
  let skipped = 0;
  for (let i = 0; i < villages.length; i += BATCH_SIZE) {
    const chunk = villages.slice(i, i + BATCH_SIZE);
    for (const row of chunk) {
      const districtId = districtIdByKode.get(row.district_code);
      if (!districtId) {
        skipped++;
        continue;
      }
      await client.query(
        `
        INSERT INTO villages (district_id, name, kode)
        VALUES ($1, $2, $3)
        ON CONFLICT (kode) DO UPDATE
          SET name = EXCLUDED.name, district_id = EXCLUDED.district_id
        `,
        [districtId, formatName(row.name), row.code]
      );
    }
    if ((i + BATCH_SIZE) % 5000 === 0 || i + BATCH_SIZE >= villages.length) {
      process.stdout.write(`  villages ${Math.min(i + BATCH_SIZE, villages.length)}/${villages.length}\r`);
    }
  }
  console.log(`\n  villages selesai (skip ${skipped})`);
}

async function loadIdMaps(client) {
  const provinces = await client.query(`SELECT id, kode FROM provinces WHERE kode IS NOT NULL`);
  const regencies = await client.query(`SELECT id, kode FROM regencies WHERE kode IS NOT NULL`);
  const districts = await client.query(`SELECT id, kode FROM districts WHERE kode IS NOT NULL`);

  return {
    provinceIdByKode: new Map(provinces.rows.map((r) => [r.kode, r.id])),
    regencyIdByKode: new Map(regencies.rows.map((r) => [r.kode, r.id])),
    districtIdByKode: new Map(districts.rows.map((r) => [r.kode, r.id])),
  };
}

/** Remap screenhouse demo/seed ke ID baru berdasarkan kode Kemendagri. */
async function remapSeedScreenhouses(client) {
  const targets = [
    {
      screenhouseName: "Screenhouse Sukabumi 01",
      provinceKode: "32",
      regencyKode: "32.02",
      districtName: "Cisaat",
      villageName: "Babakan",
    },
    {
      screenhouseName: "Screenhouse Sukabumi 02",
      provinceKode: "32",
      regencyKode: "32.02",
      districtName: "Cisaat",
      villageName: "Sukamanah",
    },
    {
      screenhouseName: "Screenhouse Kadudampit 01",
      provinceKode: "32",
      regencyKode: "32.02",
      districtName: "Kadudampit",
      villageName: "Gedepangrango",
    },
  ];

  for (const t of targets) {
    const result = await client.query(
      `
      UPDATE screenhouses sh
      SET
        province_id = p.id,
        regency_id = r.id,
        district_id = d.id,
        village_id = v.id
      FROM provinces p
      JOIN regencies r ON r.kode = $2 AND r.province_id = p.id
      JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower($3)
      JOIN villages v ON v.district_id = d.id AND lower(v.name) = lower($4)
      WHERE p.kode = $1
        AND sh.name = $5
      RETURNING sh.id
      `,
      [t.provinceKode, t.regencyKode, t.districtName, t.villageName, t.screenhouseName]
    );
    if (result.rowCount > 0) {
      console.log(`[remap] ${t.screenhouseName} → wilayah id diperbarui`);
    }
  }
}

async function pruneLegacyWilayah(client) {
  console.log("[wilayah] Menghapus baris lama tanpa kode (hati-hati jika ada FK orphan)...");

  await client.query(`
    DELETE FROM villages v
    WHERE v.kode IS NULL
      AND NOT EXISTS (SELECT 1 FROM screenhouses sh WHERE sh.village_id = v.id)
  `);
  await client.query(`
    DELETE FROM districts d
    WHERE d.kode IS NULL
      AND NOT EXISTS (SELECT 1 FROM villages v WHERE v.district_id = d.id)
      AND NOT EXISTS (SELECT 1 FROM screenhouses sh WHERE sh.district_id = d.id)
  `);
  await client.query(`
    DELETE FROM regencies r
    WHERE r.kode IS NULL
      AND NOT EXISTS (SELECT 1 FROM districts d WHERE d.regency_id = r.id)
      AND NOT EXISTS (SELECT 1 FROM screenhouses sh WHERE sh.regency_id = r.id)
  `);
  await client.query(`
    DELETE FROM provinces p
    WHERE p.kode IS NULL
      AND NOT EXISTS (SELECT 1 FROM regencies r WHERE r.province_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM screenhouses sh WHERE sh.province_id = p.id)
  `);
}

async function resetSequences(client) {
  await client.query(`SELECT setval('provinces_id_seq', (SELECT COALESCE(MAX(id), 1) FROM provinces))`);
  await client.query(`SELECT setval('regencies_id_seq', (SELECT COALESCE(MAX(id), 1) FROM regencies))`);
  await client.query(`SELECT setval('districts_id_seq', (SELECT COALESCE(MAX(id), 1) FROM districts))`);
  await client.query(`SELECT setval('villages_id_seq', (SELECT COALESCE(MAX(id), 1) FROM villages))`);
}

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5433),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "screenhouse_monitoring",
  });

  const client = await pool.connect();

  try {
    const { getProvinces, getRegencies, getDistricts, getVillages } = await import("idn-area-data");

    console.log("[wilayah] Memuat data dari idn-area-data...");
    const [provinces, regencies, districts, villages] = await Promise.all([
      getProvinces(),
      getRegencies(),
      getDistricts(),
      getVillages(),
    ]);

    await client.query("BEGIN");

    await upsertProvinces(client, provinces);
    let maps = await loadIdMaps(client);

    await upsertRegencies(client, regencies, maps.provinceIdByKode);
    maps = await loadIdMaps(client);

    await upsertDistricts(client, districts, maps.regencyIdByKode);
    maps = await loadIdMaps(client);

    await upsertVillages(client, villages, maps.districtIdByKode);

    await remapSeedScreenhouses(client);

    if (PRUNE_LEGACY) {
      await pruneLegacyWilayah(client);
    }

    await resetSequences(client);

    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM provinces) AS provinces,
        (SELECT COUNT(*) FROM regencies) AS regencies,
        (SELECT COUNT(*) FROM districts) AS districts,
        (SELECT COUNT(*) FROM villages) AS villages
    `);

    await client.query("COMMIT");

    console.log("[wilayah] Import selesai:", counts.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[wilayah] Gagal:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
