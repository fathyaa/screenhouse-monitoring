import { getAdviceForAlert, isAlertCritical } from "../constants/paramHealth";
import { formatRackName } from "./rackNames";

export const ALERT_CATEGORY = {
  SOIL: "soil",
  DEVICE: "device",
};

export const OFFLINE_MESSAGE_SUFFIX = "tidak mengirim data sensor";

export function isDeviceOfflineAlert(alert) {
  return (alert?.message?.toLowerCase() ?? "").includes(OFFLINE_MESSAGE_SUFFIX);
}

export function getAlertCategory(alert) {
  return isDeviceOfflineAlert(alert) ? ALERT_CATEGORY.DEVICE : ALERT_CATEGORY.SOIL;
}

export function getAlertCategoryLabel(category) {
  return category === ALERT_CATEGORY.DEVICE ? "Masalah alat" : "Kondisi tanah";
}

/** Label rak bibit untuk ringkasan peringatan — pakai nama kustom, bukan kode. */
export function getTrayLabel(alert) {
  if (alert?.sensor_node_name) {
    return formatRackName(alert.sensor_node_name);
  }

  const msg = alert?.message ?? "";
  if (isDeviceOfflineAlert(alert)) {
    const before = msg.split(/tidak mengirim data sensor/i)[0]?.trim();
    if (before) return formatRackName(before);
  }

  return "Rak bibit";
}

export function getAlertGroupKey(alert) {
  if (isDeviceOfflineAlert(alert)) return "__device_offline__";
  return (alert?.message ?? "").trim().toLowerCase();
}

/**
 * Urutan daftar peringatan: waktu terbaru dulu. Dulu kategori (tanah > alat) +
 * kritis yang menang, tapi di layar hasilnya membingungkan — alert kemarin bisa
 * nangkring di atas alert beberapa jam lalu, dan grup tanggal ("Hari ini" /
 * "Kemarin") jadi tidak berurutan karena grup dibentuk mengikuti urutan list.
 * Kategori & kritis tinggal jadi tie-break untuk alert berwaktu sama.
 */
export function compareAlertsForDisplay(a, b) {
  const timeA = new Date(a.created_at).getTime();
  const timeB = new Date(b.created_at).getTime();
  const validA = Number.isNaN(timeA);
  const validB = Number.isNaN(timeB);
  // Alert tanpa waktu valid ditaruh paling bawah, bukan ikut mengacak urutan.
  if (validA !== validB) return validA ? 1 : -1;
  if (!validA && timeA !== timeB) return timeB - timeA;

  const catA = getAlertCategory(a);
  const catB = getAlertCategory(b);
  if (catA !== catB) return catA === ALERT_CATEGORY.SOIL ? -1 : 1;

  const critA = isAlertCritical(a) ? 0 : 1;
  const critB = isAlertCritical(b) ? 0 : 1;
  return critA - critB;
}

export function sortAlertsForDisplay(alerts) {
  return [...alerts].sort(compareAlertsForDisplay);
}

function shortenScreenhouseName(name) {
  return String(name ?? "")
    .replace(/^Screenhouse\s+/i, "")
    .trim() || name;
}

/** Gabungkan alert offline aktif per rak — simpan yang terbaru. */
export function dedupeOfflineAlerts(alerts) {
  const offlineBuckets = new Map();
  const other = [];

  for (const alert of alerts) {
    if (!isDeviceOfflineAlert(alert)) {
      other.push(alert);
      continue;
    }

    const key =
      alert.sensor_node_id != null
        ? `${alert.screenhouse_id}:${alert.sensor_node_id}`
        : `${alert.screenhouse_id}:${getTrayLabel(alert)}`;

    const prev = offlineBuckets.get(key);
    if (
      !prev ||
      new Date(alert.created_at).getTime() > new Date(prev.created_at).getTime()
    ) {
      offlineBuckets.set(key, alert);
    }
  }

  return [...other, ...offlineBuckets.values()];
}

/** Tampilkan pesan offline pakai nama rak terkini, bukan teks lama di database. */
export function getAlertDisplayMessage(alert) {
  if (isDeviceOfflineAlert(alert)) {
    const label = alert.sensor_node_name
      ? formatRackName(alert.sensor_node_name)
      : getTrayLabel(alert);
    return `${label} tidak mengirim data sensor terbaru`;
  }
  return alert.message ?? "";
}

function buildDeviceOfflineDisplay(alerts) {
  const uniqueAlerts = dedupeOfflineAlerts(alerts);
  const byScreenhouse = new Map();

  for (const alert of uniqueAlerts) {
    const fullName = alert.screenhouse_name ?? `Screenhouse ${alert.screenhouse_id}`;
    if (!byScreenhouse.has(fullName)) {
      byScreenhouse.set(fullName, { fullName, racks: [], alerts: [] });
    }
    const entry = byScreenhouse.get(fullName);
    entry.racks.push(getTrayLabel(alert));
    entry.alerts.push(alert);
  }

  const locations = [...byScreenhouse.values()].map((entry) => ({
    name: shortenScreenhouseName(entry.fullName),
    fullName: entry.fullName,
    racks: [...new Set(entry.racks)],
    primaryAlertId: entry.alerts[0]?.id,
  }));

  const count = uniqueAlerts.length;
  const headline =
    count === 1 ? "1 rak bibit tidak kirim data" : `${count} rak bibit tidak kirim data`;
  const subline =
    locations.length === 1
      ? `di ${locations[0].name}`
      : `di ${locations.length} screenhouse`;

  return { headline, subline, locations };
}

function buildSoilGroupDisplay(alerts) {
  const message = alerts[0]?.message ?? "Peringatan tanah";
  const byScreenhouse = new Map();

  for (const alert of alerts) {
    const fullName = alert.screenhouse_name ?? `Screenhouse ${alert.screenhouse_id}`;
    if (!byScreenhouse.has(fullName)) {
      byScreenhouse.set(fullName, { fullName, alerts: [] });
    }
    byScreenhouse.get(fullName).alerts.push(alert);
  }

  const locations = [...byScreenhouse.values()].map((entry) => ({
    name: shortenScreenhouseName(entry.fullName),
    fullName: entry.fullName,
    primaryAlertId: entry.alerts[0]?.id,
  }));

  return {
    headline: message,
    subline:
      locations.length === 1
        ? locations[0].name
        : `${locations.length} screenhouse terdampak`,
    locations,
  };
}

function buildOfflineGroupSummary(alerts) {
  const { headline, subline } = buildDeviceOfflineDisplay(alerts);
  return `${headline} ${subline}`;
}

function buildSoilGroupSummary(alerts) {
  const { headline, subline } = buildSoilGroupDisplay(alerts);
  return alerts.length <= 1 ? headline : `${headline}, ${subline}`;
}

function buildGroupSummary(group) {
  if (group.category === ALERT_CATEGORY.DEVICE) {
    return buildOfflineGroupSummary(group.alerts);
  }
  return buildSoilGroupSummary(group.alerts);
}

/**
 * Gabungkan alert sejenis untuk dashboard petani.
 * Offline/device → satu baris; pesan threshold identik antar screenhouse → satu baris.
 */
export function groupAlertsForDashboard(alerts) {
  const groups = new Map();

  for (const alert of alerts) {
    const key = getAlertGroupKey(alert);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        category: getAlertCategory(alert),
        alerts: [],
      });
    }
    groups.get(key).alerts.push(alert);
  }

  const items = [];

  for (const group of groups.values()) {
    const shouldGroup =
      group.category === ALERT_CATEGORY.DEVICE || group.alerts.length > 1;

    if (shouldGroup) {
      const display =
        group.category === ALERT_CATEGORY.DEVICE
          ? buildDeviceOfflineDisplay(group.alerts)
          : buildSoilGroupDisplay(group.alerts);

      items.push({
        kind: "group",
        id: `group-${group.key}`,
        category: group.category,
        alerts: group.alerts,
        display,
        primaryAlertId: group.alerts[0]?.id ?? null,
        summary: buildGroupSummary(group),
        critical: group.alerts.some(isAlertCritical),
        advice: getAdviceForAlert(group.alerts[0]),
      });
    } else {
      const alert = group.alerts[0];
      items.push({
        kind: "single",
        id: String(alert.id),
        category: group.category,
        alert,
        critical: isAlertCritical(alert),
        advice: getAdviceForAlert(alert),
      });
    }
  }

  items.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category === ALERT_CATEGORY.SOIL ? -1 : 1;
    }
    if (a.critical !== b.critical) return a.critical ? -1 : 1;
    return 0;
  });

  return items;
}

export function getAlertListItemClasses(alert, { blink = false } = {}) {
  const category = getAlertCategory(alert);
  const isActive = alert.status === "active";
  const critical = isActive && isAlertCritical(alert);
  const blinkCls = blink ? " alert-highlight-blink" : "";

  if (!isActive) {
    return `bg-white rounded-2xl border border-gray-200 p-4 flex gap-3 items-start scroll-mt-24 border-l-[3px] border-l-bl-accent${blinkCls}`;
  }

  if (category === ALERT_CATEGORY.DEVICE) {
    return `bg-slate-50 rounded-2xl border border-slate-300 p-4 flex gap-3 items-start scroll-mt-24 border-l-[3px] border-l-slate-500${blinkCls}`;
  }

  if (critical) {
    return `bg-red-50/40 rounded-2xl border-2 border-red-200 p-4 flex gap-3 items-start scroll-mt-24 border-l-[5px] border-l-red-600 shadow-sm${blinkCls}`;
  }

  return `bg-amber-50/30 rounded-2xl border-2 border-amber-200 p-4 flex gap-3 items-start scroll-mt-24 border-l-[5px] border-l-amber-500 shadow-sm${blinkCls}`;
}

export function getCategoryBadgeClasses(category) {
  if (category === ALERT_CATEGORY.DEVICE) {
    return "px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold";
  }
  return "px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-semibold";
}

export function getAlertIconClasses(alert) {
  const category = getAlertCategory(alert);
  const isActive = alert.status === "active";

  if (!isActive) {
    return "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-bl-surface-muted";
  }
  if (category === ALERT_CATEGORY.DEVICE) {
    return "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-slate-200 border border-slate-300";
  }
  if (isAlertCritical(alert)) {
    return "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-red-100";
  }
  return "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-amber-50";
}
