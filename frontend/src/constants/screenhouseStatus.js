// Status kesehatan screenhouse untuk pewarnaan marker peta + badge.
// Disuplai oleh endpoint /sensor-data/map-summary (monitoring-service).
export const SCREENHOUSE_STATUS = {
  healthy: {
    key: "healthy",
    label: "Sehat",
    color: "#40916c",
    dotClass: "bg-bl-accent",
    badgeClass: "bg-bl-surface-muted text-bl-primary",
  },
  warning: {
    key: "warning",
    label: "Peringatan",
    color: "#f59e0b",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-50 text-amber-700",
  },
  critical: {
    key: "critical",
    label: "Kritis",
    color: "#dc2626",
    dotClass: "bg-red-500",
    badgeClass: "bg-red-50 text-red-700",
  },
  offline: {
    key: "offline",
    label: "Offline",
    color: "#94a3b8",
    dotClass: "bg-slate-400",
    badgeClass: "bg-slate-100 text-slate-600",
  },
};

export const STATUS_ORDER = ["healthy", "warning", "critical", "offline"];

export function getStatusMeta(status) {
  return SCREENHOUSE_STATUS[status] ?? SCREENHOUSE_STATUS.offline;
}

/** Selaras map-summary: 1 masalah → peringatan, 2+ → kritis. */
export function deriveScreenhouseStatus({
  abnormalCount = 0,
  activeAlertCount = 0,
} = {}) {
  if (activeAlertCount >= 2 || abnormalCount >= 2) return "critical";
  if (activeAlertCount >= 1 || abnormalCount >= 1) return "warning";
  return "healthy";
}

// "Update 2 menit lalu" / "Offline 3 jam" style relative time, in Bahasa Indonesia.
export function timeAgo(dateStr) {
  if (!dateStr) return "belum ada data";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(diffMs)) return "belum ada data";

  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return "baru saja";

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;

  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} jam lalu`;

  const day = Math.floor(hour / 24);
  return `${day} hari lalu`;
}

/** Versi relatif untuk label "Terakhir diperbarui 2 menit yang lalu". */
export function timeAgoLong(dateStr) {
  const base = timeAgo(dateStr);
  if (base === "baru saja" || base === "belum ada data") return base;
  return base.replace(/(\d+) (menit|jam|hari) lalu/, "$1 $2 yang lalu");
}

/** Label mikro last-updated sensor — jam WIB + relatif untuk bukti monitoring realtime. */
export function formatLastSensorUpdate(dateStr) {
  if (!dateStr) return "Belum ada data sensor";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Belum ada data sensor";

  const clock = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  const relative = timeAgoLong(dateStr);

  return `Terakhir diperbarui ${relative} · ${clock} WIB`;
}

/** Waktu snapshot untuk label "terakhir diperbarui 16 Jun, 22.15" */
export function formatSnapshotTime(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
