/**
 * Lantai ambang "tidak mengirim data", dalam detik.
 *
 * WAJIB SAMA dengan MIN_STALE_SECONDS di
 * `services/monitoring-service/src/shared/nodeLiveness.js`. Kalau beda, kartu
 * screenhouse di UI bisa bilang "tidak terhubung" sementara backend belum
 * membuat alert offline — atau sebaliknya.
 */
export const MIN_STALE_SECONDS = 1800;

/** Sama dengan map-summary & alert worker: interval × 3, minimal 30 menit. */
export function staleThresholdMs(sendIntervalSeconds) {
  const intervalSec = Math.max(Number(sendIntervalSeconds) || 60, 60);
  return Math.max(intervalSec * 3, MIN_STALE_SECONDS) * 1000;
}

export function isNodeOnline(node, now = Date.now()) {
  if (!node?.is_active) return false;

  const lastSeen = node.last_seen ?? node.latest_data?.created_at;
  if (!lastSeen) return false;

  const ageMs = now - new Date(lastSeen).getTime();
  if (Number.isNaN(ageMs)) return false;

  return ageMs <= staleThresholdMs(node.send_interval_seconds);
}

/** Screenhouse offline bila tidak ada node aktif yang masih kirim data terbaru. */
export function isScreenhouseMonitorOffline(nodes, now = Date.now()) {
  const activeNodes = nodes.filter((n) => n.is_active);
  if (activeNodes.length === 0) return true;
  return activeNodes.every((n) => !isNodeOnline(n, now));
}

export function countOnlineNodes(nodes, now = Date.now()) {
  return nodes.filter((n) => isNodeOnline(n, now)).length;
}
