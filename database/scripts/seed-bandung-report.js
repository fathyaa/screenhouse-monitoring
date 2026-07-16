/**
 * Seed "Laporan Wilayah terlihat jadi" — merelokasi 30 screenhouse EXISTING
 * (id 4–33, milik user yang sudah ada) ke 10 kecamatan Kota Bandung, memberi
 * varietas, siklus semai (aktif + selesai bergrade), pembacaan sensor, dan alert
 * yang bervariasi — supaya halaman Laporan Wilayah (worklist, prioritas per
 * kecamatan, analitik varietas, diagnostik) berisi & ber-insight.
 *
 * Idempoten: menghapus data seed lama untuk screenhouse-screenhouse ini dulu.
 *
 *   cd database/scripts && node seed-bandung-report.js
 */
import pg from "pg";

const appPool = new pg.Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_APP_PORT || 5434),
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

const SH_IDS = Array.from({ length: 30 }, (_, i) => i + 4); // 4..33
const PROVINCE_ID = 1; // Jawa Barat
const REGENCY_ID = 7; // Kota Bandung

// 10 kecamatan Kota Bandung + satu desa masing-masing.
const DISTRICTS = [
  { district_id: 50, kecamatan: "Sukasari", village_id: 449 },
  { district_id: 51, kecamatan: "Coblong", village_id: 453 },
  { district_id: 52, kecamatan: "Babakan Ciparay", village_id: 459 },
  { district_id: 53, kecamatan: "Bojongloa Kaler", village_id: 465 },
  { district_id: 54, kecamatan: "Andir", village_id: 470 },
  { district_id: 55, kecamatan: "Cicendo", village_id: 476 },
  { district_id: 56, kecamatan: "Sukajadi", village_id: 482 },
  { district_id: 57, kecamatan: "Cidadap", village_id: 487 },
  { district_id: 58, kecamatan: "Bandung Wetan", village_id: 490 },
  { district_id: 59, kecamatan: "Astanaanyar", village_id: 493 },
];

// Varietas (id, nama, durasi target). Profil kualitas historis dipakai untuk
// membuat perbandingan varietas bermakna (IR64 unggul, Mekongga rewel).
const VARIETAS = [
  { id: 3, nama: "Inpari 32", durasi: 23, quality: "baik" },
  { id: 1, nama: "Ciherang", durasi: 25, quality: "sedang" },
  { id: 2, nama: "IR64", durasi: 22, quality: "unggul" },
  { id: 4, nama: "Mekongga", durasi: 26, quality: "rewel" },
  { id: 5, nama: "Situ Bagendit", durasi: 28, quality: "sedang" },
];

// Ambang standar (dipakai untuk snapshot + acuan sehat/tidak).
const TH = {
  min_nitrogen: 20, max_nitrogen: 45, min_phosphorus: 10, max_phosphorus: 30,
  min_potassium: 15, max_potassium: 50, min_soil_moisture: 50, max_soil_moisture: 80,
  min_soil_temperature: 22, max_soil_temperature: 32, min_soil_ph: 5.5, max_soil_ph: 7.0,
  min_conductivity: 200, max_conductivity: 800, min_air_temperature: 22, max_air_temperature: 35,
  min_air_humidity: 55, max_air_humidity: 85, min_light_intensity: 8000, max_light_intensity: 40000,
};

// Profil kesehatan tiap screenhouse (30) — campuran realistis.
// h = sehat, w = peringatan (1 param di luar), c = kritis (2+), o = offline.
const HEALTH = [
  "h","h","w","h","c","h","h","o","h","w",
  "h","h","c","h","w","h","o","h","h","c",
  "h","w","h","h","o","h","w","h","c","h",
];

// Umur siklus (hari sejak semai) tiap screenhouse — agar readiness bervariasi
// (baru, tengah, hampir siap, terlambat).
const CYCLE_AGE = [
  3, 20, 12, 25, 8, 5, 18, 14, 22, 10,
  2, 16, 9, 27, 6, 19, 11, 24, 7, 13,
  4, 21, 15, 1, 17, 23, 12, 26, 9, 20,
];

const rnd = (min, max, dec = 0) => {
  const v = min + Math.random() * (max - min);
  return dec === 0 ? Math.round(v) : Math.round(v * 10 ** dec) / 10 ** dec;
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const ymd = (d) => d.toISOString().slice(0, 10);

/** Pembacaan sensor sesuai target kesehatan. */
function reading(health) {
  const base = {
    nitrogen: rnd(28, 40), phosphorus: rnd(15, 26), potassium: rnd(24, 44),
    soil_moisture: rnd(58, 74, 1), soil_temperature: rnd(24, 30, 1),
    soil_ph: rnd(6.0, 6.7, 2), conductivity: rnd(350, 650),
    air_temperature: rnd(26, 32, 1), air_humidity: rnd(62, 80, 1),
    light_intensity: rnd(14000, 28000),
  };
  if (health === "w") {
    // satu parameter menyimpang
    base.soil_moisture = rnd(38, 47, 1); // kelembapan tanah rendah
  } else if (health === "c") {
    base.soil_moisture = rnd(30, 42, 1); // kering
    base.air_temperature = rnd(36, 40, 1); // panas
  }
  return base;
}

async function main() {
  console.log(`Seeding Laporan Wilayah — 30 screenhouse → Kota Bandung…`);

  // Peta node id per screenhouse (monitoring).
  const nodeRes = await monPool.query(
    `SELECT id, screenhouse_id FROM sensor_nodes WHERE screenhouse_id = ANY($1::int[]) ORDER BY screenhouse_id, id`,
    [SH_IDS]
  );
  const nodesBySh = {};
  for (const r of nodeRes.rows) (nodesBySh[r.screenhouse_id] ??= []).push(r.id);

  // Bersihkan data seed lama (idempoten).
  await appPool.query(`DELETE FROM semai_cycles WHERE screenhouse_id = ANY($1::int[])`, [SH_IDS]);
  await monPool.query(`DELETE FROM alerts WHERE screenhouse_id = ANY($1::int[])`, [SH_IDS]);
  await monPool.query(
    `DELETE FROM sensor_data WHERE sensor_node_id IN (
       SELECT id FROM sensor_nodes WHERE screenhouse_id = ANY($1::int[])
     ) AND created_at >= NOW() - INTERVAL '10 days'`,
    [SH_IDS]
  );

  let completedTotal = 0;
  let alertTotal = 0;

  for (let i = 0; i < SH_IDS.length; i++) {
    const shId = SH_IDS[i];
    const dist = DISTRICTS[i % DISTRICTS.length];
    const varietas = VARIETAS[i % 4];
    const health = HEALTH[i];
    const age = CYCLE_AGE[i];
    const semaiDate = daysAgo(age);
    const nn = String(Math.floor(i / DISTRICTS.length) + 1).padStart(2, "0");

    // 1) Relokasi + varietas + tanggal semai (app DB).
    await appPool.query(
      `UPDATE screenhouses
       SET province_id=$2, regency_id=$3, district_id=$4, village_id=$5,
           varietas_id=$6, seed_variety=$7,
           tanggal_semai=$8, seedling_start_date=$8,
           name=$9, status='active'
       WHERE id=$1`,
      [shId, PROVINCE_ID, REGENCY_ID, dist.district_id, dist.village_id,
       varietas.id, varietas.nama, ymd(semaiDate),
       `Screenhouse ${dist.kecamatan} ${nn}`]
    );

    // 2) Siklus aktif berjalan.
    const estimasi = daysAgo(age - varietas.durasi);
    await appPool.query(
      `INSERT INTO semai_cycles
         (screenhouse_id, varietas_id, varietas_nama, tanggal_mulai, estimasi_siap, durasi_target_hari, status, analytics)
       VALUES ($1,$2,$3,$4::date,$5::date,$6,'active',$7::jsonb)`,
      [shId, varietas.id, varietas.nama, ymd(semaiDate), ymd(estimasi), varietas.durasi,
       JSON.stringify({ computed_at: new Date().toISOString() })]
    );

    // 3) Siklus SELESAI historis (1–2 per screenhouse) → throughput + grade + varietas.
    const nCompleted = 1 + (i % 2);
    for (let c = 0; c < nCompleted; c++) {
      // sebar tanggal selesai: ~sepertiga di 7 hari, sisanya 8–90 hari lalu.
      const endAgo = c === 0 && i % 3 === 0 ? rnd(1, 7) : rnd(8, 90);
      const hv = pick(VARIETAS); // varietas historis boleh berbeda
      // grade menurut kualitas varietas
      const gradeRoll = Math.random();
      let grade, latePenalty, uptime;
      const q = hv.quality;
      if (q === "unggul") { grade = gradeRoll < 0.75 ? "A" : "B"; }
      else if (q === "baik") { grade = gradeRoll < 0.55 ? "A" : gradeRoll < 0.85 ? "B" : "C"; }
      else if (q === "sedang") { grade = gradeRoll < 0.35 ? "A" : gradeRoll < 0.75 ? "B" : "C"; }
      else { grade = gradeRoll < 0.2 ? "A" : gradeRoll < 0.55 ? "B" : "C"; } // rewel
      latePenalty = grade === "A" ? rnd(-1, 1) : grade === "B" ? rnd(1, 4) : rnd(4, 9);
      uptime = grade === "A" ? rnd(95, 100) : grade === "B" ? rnd(88, 96) : rnd(72, 88);
      const actualDur = hv.durasi + latePenalty;
      const endDate = daysAgo(endAgo);
      const startDate = daysAgo(endAgo + actualDur);
      const stress = grade === "A" ? rnd(6, 18) : grade === "B" ? rnd(18, 34) : rnd(34, 55);
      await appPool.query(
        `INSERT INTO semai_cycles
           (screenhouse_id, varietas_id, varietas_nama, tanggal_mulai, tanggal_selesai, estimasi_siap, durasi_target_hari, status, grade, analytics)
         VALUES ($1,$2,$3,$4::date,$5::date,$6::date,$7,'completed',$8,$9::jsonb)`,
        [shId, hv.id, hv.nama, ymd(startDate), ymd(endDate),
         ymd(daysAgo(endAgo + actualDur - hv.durasi)), hv.durasi, grade,
         JSON.stringify({ grade, uptime, stress, durasi: actualDur, computed_at: endDate.toISOString() })]
      );
      completedTotal++;
    }

    // 4) Threshold snapshot (monitoring) — pastikan ada.
    const cols = Object.keys(TH);
    await monPool.query(
      `INSERT INTO threshold_snapshots (screenhouse_id, ${cols.join(",")})
       VALUES ($1, ${cols.map((_, k) => `$${k + 2}`).join(",")})
       ON CONFLICT (screenhouse_id) DO UPDATE SET ${cols.map((c) => `${c}=EXCLUDED.${c}`).join(",")}`,
      [shId, ...cols.map((c) => TH[c])]
    );

    // 5) Pembacaan sensor (monitoring). Offline → tidak ada data baru (>24 jam).
    const nodes = nodesBySh[shId] ?? [];
    if (health !== "o") {
      for (const nodeId of nodes) {
        // Sebar minimal 1 pembacaan tiap hari selama 7 hari terakhir (agar model
        // estimasi tidak menganggap "banyak hari offline" → tidak salah "terlambat"),
        // plus 1 pembacaan sangat baru (< 10 menit) supaya perangkat "online".
        const offsets = [rnd(2, 9)]; // terbaru
        for (let d = 0; d < 7; d++) offsets.push(d * 1440 + rnd(300, 1000)); // ~1 per hari
        for (const minutesAgo of offsets) {
          const rv = reading(health);
          await monPool.query(
            `INSERT INTO sensor_data
               (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW() - ($12 || ' minutes')::interval)`,
            [nodeId, rv.nitrogen, rv.phosphorus, rv.potassium, rv.soil_temperature, rv.soil_moisture,
             rv.soil_ph, rv.conductivity, rv.air_temperature, rv.air_humidity, rv.light_intensity, String(minutesAgo)]
          );
        }
      }
    } else {
      // offline: satu pembacaan lama saja (2–4 hari lalu) supaya "pernah ada data".
      for (const nodeId of nodes) {
        const rv = reading("h");
        await monPool.query(
          `INSERT INTO sensor_data
             (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW() - ($12 || ' minutes')::interval)`,
          [nodeId, rv.nitrogen, rv.phosphorus, rv.potassium, rv.soil_temperature, rv.soil_moisture,
           rv.soil_ph, rv.conductivity, rv.air_temperature, rv.air_humidity, rv.light_intensity, String(rnd(2 * 24 * 60, 4 * 24 * 60))]
        );
      }
    }

    // 6) Alert aktif sesuai kondisi.
    const node0 = nodes[0] ?? null;
    const mkAlert = async (msg, minsAgo) => {
      await monPool.query(
        `INSERT INTO alerts (screenhouse_id, sensor_node_id, message, status, created_at)
         VALUES ($1,$2,$3,'active', NOW() - ($4 || ' minutes')::interval)`,
        [shId, node0, msg, String(minsAgo)]
      );
      alertTotal++;
    };
    if (health === "w") {
      await mkAlert("Kelembapan tanah di bawah batas minimum", rnd(30, 600));
    } else if (health === "c") {
      await mkAlert("Kelembapan tanah di bawah batas minimum", rnd(30, 400));
      await mkAlert("Suhu udara melebihi batas maksimum", rnd(20, 300));
    } else if (health === "o") {
      await mkAlert("Alat pengukur tidak mengirim data sensor terbaru", rnd(24 * 60, 3 * 24 * 60));
    }
  }

  // Selaraskan nama registry monitoring (kosmetik, tidak wajib untuk report).
  for (let i = 0; i < SH_IDS.length; i++) {
    const dist = DISTRICTS[i % DISTRICTS.length];
    const nn = String(Math.floor(i / DISTRICTS.length) + 1).padStart(2, "0");
    await monPool.query(
      `UPDATE screenhouse_registry SET screenhouse_name=$2, status='active', updated_at=NOW() WHERE screenhouse_id=$1`,
      [SH_IDS[i], `Screenhouse ${dist.kecamatan} ${nn}`]
    );
  }

  console.log(`Selesai. 30 screenhouse @ 10 kecamatan Bandung · ${completedTotal} siklus selesai · ${alertTotal} alert aktif.`);
  console.log(`Sehat/Peringatan/Kritis/Offline: ${HEALTH.filter(h=>h==="h").length}/${HEALTH.filter(h=>h==="w").length}/${HEALTH.filter(h=>h==="c").length}/${HEALTH.filter(h=>h==="o").length}`);
  await appPool.end();
  await monPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
