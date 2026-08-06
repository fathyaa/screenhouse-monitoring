/**
 * Protokol bersih-bersih sebelum satu skenario dijalankan.
 *
 *   node scripts/reset-environment.js            # purge + restart service
 *   node scripts/reset-environment.js --keep-real  # jangan sentuh data perangkat asli
 *
 * Dua hal yang dikerjakan:
 *
 *   1. Kosongkan sensor_data / alerts / actuator_logs supaya ukuran tabel dan
 *      indeks sama di titik awal tiap skenario — kalau tidak, skenario terakhir
 *      selalu menulis ke tabel yang jauh lebih besar daripada skenario pertama
 *      dan perbandingan laju insert antar skenario jadi tidak adil.
 *
 *   2. Restart monitoring-service supaya cache lookup node, counter ingest, dan
 *      jejak memori proses kembali ke keadaan awal.
 *
 * CATATAN PENTING — data perangkat asli.
 * Screenhouse yang dipakai perangkat sungguhan (gh01 = screenhouse 700) berisi
 * data penelitian yang tidak bisa dibuat ulang. Secara default skrip ini
 * MENYISAKAN baris milik screenhouse tersebut dan hanya menghapus sisanya.
 * Pakai --purge-all hanya kalau memang ingin mengosongkan tabel sepenuhnya.
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";
import { fetchQueueDepth, purgeQueue } from "../collectors/rabbitmq-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env") });

// Screenhouse dengan perangkat keras sungguhan — datanya tidak boleh hilang
// hanya karena uji beban dijalankan. Bisa ditimpa lewat env kalau perangkatnya
// bertambah: PROTECTED_SCREENHOUSE_IDS=700,701
function protectedScreenhouseIds(env) {
  const raw = env.PROTECTED_SCREENHOUSE_IDS ?? "700";
  return raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter(Number.isFinite);
}

function dbConfig(env) {
  return {
    host: env.DB_HOST || "localhost",
    port: Number(env.DB_PORT || 5433),
    user: env.DB_USER || "postgres",
    password: env.DB_PASSWORD || "postgres",
    database: env.DB_NAME || "screenhouse_monitoring",
    max: 2,
  };
}

export async function purgeMeasurementTables({ env = process.env, purgeAll = false } = {}) {
  const pool = new pg.Pool(dbConfig(env));
  const protectedIds = protectedScreenhouseIds(env);

  try {
    if (purgeAll) {
      await pool.query("TRUNCATE sensor_data, alerts, actuator_logs RESTART IDENTITY");
      return { mode: "all", protectedIds: [], deleted: null };
    }

    // Urutan wajib: alerts menunjuk sensor_data lewat alerts_sensor_data_id_fkey,
    // jadi baris alert harus pergi lebih dulu atau DELETE sensor_data ditolak.
    const alerts = await pool.query(
      "DELETE FROM alerts WHERE screenhouse_id <> ALL($1::int[])",
      [protectedIds]
    );

    // sensor_data tidak punya kolom screenhouse_id, jadi lewat sensor_nodes.
    const sensorData = await pool.query(
      `
      DELETE FROM sensor_data
      WHERE sensor_node_id IN (
        SELECT id FROM sensor_nodes WHERE screenhouse_id <> ALL($1::int[])
      )
      `,
      [protectedIds]
    );
    const actuatorLogs = await pool.query(
      "DELETE FROM actuator_logs WHERE screenhouse_id <> ALL($1::int[])",
      [protectedIds]
    );

    // Ruang kosong bekas DELETE tidak dikembalikan ke sistem tanpa ini, dan
    // statistik planner yang basi bikin laju insert skenario berikutnya beda
    // tanpa sebab yang berhubungan dengan beban.
    await pool.query("VACUUM ANALYZE sensor_data");

    return {
      mode: "selective",
      protectedIds,
      deleted: {
        sensorData: sensorData.rowCount,
        alerts: alerts.rowCount,
        actuatorLogs: actuatorLogs.rowCount,
      },
    };
  } finally {
    await pool.end();
  }
}

/** @returns {Promise<string>} stdout perintah (dipakai untuk mendaftar container) */
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "pipe" });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) =>
      code === 0
        ? resolve(stdout)
        : reject(new Error(`${command} ${args.join(" ")} → ${code}: ${stderr.trim()}`))
    );
    child.on("error", reject);
  });
}

async function waitForBackend(baseUrl, maxSec = 90) {
  const start = Date.now();
  while ((Date.now() - start) / 1000 < maxSec) {
    try {
      const res = await fetch(`${baseUrl}/stats/ingest`);
      if (res.ok) return Math.round((Date.now() - start) / 1000);
    } catch {
      // service belum menerima koneksi — normal selama beberapa detik pertama
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`monitoring-service tidak siap dalam ${maxSec}s`);
}

// Service yang memegang state ingest dan karenanya harus dimulai ulang supaya
// tiap run punya titik nol yang sama. Mencakup nama arsitektur lama maupun baru;
// yang tidak ada di mesin ini dilewati.
const PIPELINE_SERVICES = new Set([
  "monitoring-service",
  "collector",
  "processing",
  "persistence",
  "alert",
  "scheduler",
  "realtime",
  "monitoring-api",
]);

/** Container pipeline yang benar-benar berjalan, dicari lewat label compose. */
async function findPipelineContainers(env) {
  const project = env.LOADTEST_COMPOSE_PROJECT || "docker";
  const out = await run("docker", [
    "ps",
    "--filter",
    `label=com.docker.compose.project=${project}`,
    "--format",
    "{{.Names}}\t{{.Label \"com.docker.compose.service\"}}",
  ]);

  return String(out ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, service] = line.split("\t");
      return { name, service };
    })
    .filter(({ service }) => PIPELINE_SERVICES.has(service));
}

/**
 * Mulai ulang SELURUH proses pipeline, bukan satu container.
 *
 * Di arsitektur baru counter tersebar di tujuh proses; me-restart satu saja
 * menyisakan counter lama di enam sisanya, dan delivery rate run berikutnya
 * akan melebihi 100%. Restart dilakukan sekaligus supaya tidak ada proses yang
 * sempat memproses sisa antrean run sebelumnya setelah yang lain sudah bersih.
 */
export async function restartMonitoringService({ env = process.env } = {}) {
  const baseUrl = env.MONITORING_URL || "http://localhost:3001";
  const containers = await findPipelineContainers(env);

  if (!containers.length) {
    // Fallback: arsitektur lama dijalankan di luar compose, atau label hilang.
    const single = env.MONITORING_CONTAINER || "screenhouse-monitoring-service";
    await run("docker", ["restart", single]);
    const readySec = await waitForBackend(baseUrl);
    return { container: single, containers: [single], readySec };
  }

  const names = containers.map((c) => c.name);
  await run("docker", ["restart", ...names]);
  const readySec = await waitForBackend(baseUrl);
  return { container: names.join(", "), containers: names, readySec };
}

/**
 * Urutan ketiga langkah ini tidak boleh ditukar.
 *
 * Skenario yang berakhir dengan antrian belum kosong (mis. beban di atas
 * kapasitas consumer) meninggalkan backlog di RabbitMQ. Kalau tabel dibersihkan
 * duluan, consumer yang masih menghabiskan backlog itu menyisipkan baris — dan
 * alert baru yang menunjuk sensor_data yang sedang dihapus membuat DELETE gagal
 * dengan alerts_sensor_data_id_fkey. Jadi: buang backlog dulu, matikan
 * penulisnya, baru bersihkan tabel.
 */
export async function resetEnvironment({ env = process.env, purgeAll = false } = {}) {
  const queue = await purgeLeftoverQueue({ env });
  const restart = await restartMonitoringService({ env });

  // Pengosongan KEDUA, setelah restart. Pesan yang belum di-ack saat consumer
  // mati otomatis kembali jadi ready — jadi pengosongan sebelum restart saja
  // tidak cukup: begitu proses hidup lagi ia menemukan pekerjaan yang sama dan
  // mulai menulis alert baru tepat ketika tabel sedang dibersihkan.
  const queueAfterRestart = await purgeLeftoverQueue({ env });

  const purge = await purgeMeasurementTables({ env, purgeAll });
  return { queue, queueAfterRestart, restart, purge };
}

async function purgeLeftoverQueue({ env }) {
  if (String(env.USE_RABBITMQ ?? "").toLowerCase() === "false") return { purged: 0, skipped: true };

  try {
    const depth = await fetchQueueDepth(env);
    if (!depth) return { purged: 0, skipped: false };
    const purged = await purgeQueue(env);
    return { purged, skipped: false };
  } catch {
    // Mode direct atau Management API tidak tersedia — bukan alasan menggagalkan reset.
    return { purged: 0, skipped: true };
  }
}

async function main() {
  const purgeAll = process.argv.includes("--purge-all");
  const result = await resetEnvironment({ purgeAll });

  if (result.queue.purged) console.log(`Queue: ${result.queue.purged} pesan sisa dibuang`);
  if (result.purge.mode === "all") {
    console.log("Purge: seluruh sensor_data/alerts/actuator_logs dikosongkan");
  } else {
    const { sensorData, alerts, actuatorLogs } = result.purge.deleted;
    console.log(
      `Purge: ${sensorData} sensor_data, ${alerts} alerts, ${actuatorLogs} actuator_logs dihapus ` +
        `(screenhouse ${result.purge.protectedIds.join(", ")} disisakan)`
    );
  }
  console.log(`Restart: ${result.restart.container} siap dalam ${result.restart.readySec}s`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
