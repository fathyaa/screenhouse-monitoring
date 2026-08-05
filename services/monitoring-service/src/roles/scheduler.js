const pool = require("../config/db");
const { connectRabbitMq } = require("../config/rabbitmq");
const {
  checkOfflineNodes,
  consolidateAllOfflineDuplicates,
} = require("../modules/alerting/alertEngine");
const { startHealthServer } = require("../shared/healthServer");

/**
 * SCHEDULER OFFLINE — deteksi node yang berhenti mengirim data.
 *
 * Ini BUKAN listener. Ia tidak menunggu peristiwa; ia bangun tiap beberapa menit
 * dan memindai database. Dipisah jadi role sendiri justru supaya sifatnya itu
 * tidak tersembunyi di dalam listener alert seperti sebelumnya.
 *
 * WAJIB TEPAT SATU INSTANCE. Dua penjadwal berarti dua pemindaian bersamaan atas
 * tabel yang sama, dan node yang sama akan dilaporkan offline dua kali. Kalau
 * suatu saat butuh lebih dari satu demi ketersediaan, jalan yang benar adalah
 * advisory lock PostgreSQL (`pg_try_advisory_lock`) di awal tiap siklus — bukan
 * menambah replica dan berharap.
 */
async function start() {
  // Butuh koneksi bus karena resolve/create alert menerbitkan peristiwa.
  await connectRabbitMq();

  const intervalMs =
    Math.max(Number(process.env.OFFLINE_CHECK_INTERVAL_SEC) || 300, 60) * 1000;

  consolidateAllOfflineDuplicates(pool)
    .then((resolvedCount) => {
      if (resolvedCount > 0) {
        console.log(`[scheduler] membersihkan ${resolvedCount} alert offline ganda saat start`);
      }
    })
    .catch((err) => console.error("[scheduler] pembersihan awal gagal:", err.message));

  const run = () => {
    checkOfflineNodes().catch((err) => console.error("[scheduler] offline-check:", err.message));
  };

  // Jeda awal memberi waktu collector & persistence menyusul, supaya node yang
  // sebenarnya hidup tidak sempat dilaporkan offline saat sistem baru naik.
  setTimeout(run, 15_000);
  setInterval(run, intervalMs);

  startHealthServer("scheduler", process.env.HEALTH_PORT || 3014);
  console.log(`[scheduler] siap — pemeriksaan node offline tiap ${intervalMs / 1000}s`);
}

module.exports = { start };
