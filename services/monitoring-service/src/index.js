require("dotenv").config();

/**
 * Satu artefak, banyak peran.
 *
 * Setiap role di bawah adalah proses terpisah yang bisa dijalankan, di-restart,
 * dan ditambah replica-nya sendiri — persis seperti service terpisah. Yang
 * dibagi hanyalah repositori dan image, bukan proses. Pilihan ini disengaja:
 * seluruh role memakai resolusi node, aturan aktuator, dan skema database yang
 * sama, dan menyalinnya ke tujuh repositori hanya akan menciptakan tujuh salinan
 * yang perlahan menyimpang.
 *
 * Pilih dengan variabel lingkungan ROLE. Lihat docker/docker-compose.yaml.
 */
const ROLES = {
  collector: "./roles/collector",
  processing: "./roles/processing",
  persistence: "./roles/persistence",
  alert: "./roles/alert",
  realtime: "./roles/realtime",
  scheduler: "./roles/scheduler",
  api: "./roles/api",
};

const role = process.env.ROLE || "api";
const modulePath = ROLES[role];

if (!modulePath) {
  console.error(
    `ROLE "${role}" tidak dikenal. Pilihan: ${Object.keys(ROLES).join(", ")}`
  );
  process.exit(1);
}

console.log(`=== monitoring-service | ROLE=${role} | pid ${process.pid} ===`);

require(modulePath)
  .start()
  .catch((err) => {
    console.error(`[${role}] gagal start:`, err);
    process.exit(1);
  });

// Tanpa handler ini, satu promise yang ditolak tanpa catch akan menjatuhkan
// proses diam-diam di Node 18+. Untuk role consumer itu berarti berhenti
// mengonsumsi antrean tanpa jejak di log.
process.on("unhandledRejection", (err) => {
  console.error(`[${role}] unhandled rejection:`, err);
});
