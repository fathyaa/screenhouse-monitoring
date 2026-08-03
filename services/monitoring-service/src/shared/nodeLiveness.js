/**
 * Ambang "node dianggap tidak mengirim data" — satu sumber untuk seluruh
 * monitoring-service (alert worker, map summary, stress score).
 *
 * NILAINYA HARUS SAMA dengan `frontend/src/utils/nodeOnline.js`. Kalau beda,
 * UI dan backend bisa berselisih: kartu screenhouse bilang "tidak terhubung"
 * sementara worker belum membuat alert offline (atau sebaliknya).
 */

// Lantai 30 menit. Sebelumnya 15 menit, dinaikkan karena gh01 mengirim tidak
// serapat interval nominalnya (60 detik) — jeda belasan menit antar frame itu
// normal di lapangan, jadi ambang 15 menit terlalu sering menyalakan alert
// "tidak mengirim data" untuk perangkat yang sebenarnya sehat.
const MIN_STALE_SECONDS = 1800;

/** Interval kirim × 3, tapi tidak pernah di bawah MIN_STALE_SECONDS. */
function staleThresholdMs(sendIntervalSeconds) {
  const intervalSec = Math.max(Number(sendIntervalSeconds) || 60, 60);
  return Math.max(intervalSec * 3, MIN_STALE_SECONDS) * 1000;
}

module.exports = { MIN_STALE_SECONDS, staleThresholdMs };
