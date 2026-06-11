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
    badgeClass: "bg-slate-100 text-slate-500",
  },
};

export const STATUS_ORDER = ["healthy", "warning", "critical", "offline"];

export function getStatusMeta(status) {
  return SCREENHOUSE_STATUS[status] ?? SCREENHOUSE_STATUS.offline;
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
