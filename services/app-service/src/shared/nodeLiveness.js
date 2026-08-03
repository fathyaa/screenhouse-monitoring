/**
 * Ambang "node dianggap tidak mengirim data" — salinan sengaja dari
 * `services/monitoring-service/src/shared/nodeLiveness.js` (pola yang sama
 * dipakai stressScore.js: modul dicerminkan per service, bukan diimpor lintas
 * service).
 *
 * NILAINYA HARUS SAMA di ketiga tempat — monitoring-service, app-service, dan
 * `frontend/src/utils/nodeOnline.js`. Kalau melenceng, hitungan "node online"
 * di laporan operator bisa beda dengan yang tampil di dashboard.
 */

// Lantai 30 menit; lihat catatan di versi monitoring-service.
const MIN_STALE_SECONDS = 1800;

/** Interval kirim × 3, tapi tidak pernah di bawah MIN_STALE_SECONDS. */
function staleThresholdMs(sendIntervalSeconds) {
  const intervalSec = Math.max(Number(sendIntervalSeconds) || 60, 60);
  return Math.max(intervalSec * 3, MIN_STALE_SECONDS) * 1000;
}

module.exports = { MIN_STALE_SECONDS, staleThresholdMs };
