import { getAdviceForAlert, isAlertCritical } from "../constants/paramHealth";

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
  return category === ALERT_CATEGORY.DEVICE ? "Masalah teknis device" : "Kondisi tanah";
}

/** Label tray singkat untuk ringkasan grouped (A1, T01, …). */
export function getTrayLabel(alert) {
  if (alert?.node_code) {
    const parts = String(alert.node_code).split("-");
    return parts[parts.length - 1] || alert.node_code;
  }
  if (alert?.sensor_node_name) {
    const name = String(alert.sensor_node_name);
    const code = name.match(/\b(T\d+|[A-Z]\d+)\b/i);
    if (code) return code[1];
    return name.replace(/^Tray\s+/i, "").trim() || name;
  }
  const msg = alert?.message ?? "";
  if (isDeviceOfflineAlert(alert)) {
    const before = msg.split(/tidak mengirim data sensor/i)[0]?.trim();
    if (before) return before.replace(/^Tray\s+/i, "").trim();
  }
  return "Tray";
}

export function getAlertGroupKey(alert) {
  if (isDeviceOfflineAlert(alert)) return "__device_offline__";
  return (alert?.message ?? "").trim().toLowerCase();
}

export function compareAlertsForDisplay(a, b) {
  const catA = getAlertCategory(a);
  const catB = getAlertCategory(b);
  if (catA !== catB) return catA === ALERT_CATEGORY.SOIL ? -1 : 1;

  const critA = isAlertCritical(a) ? 0 : 1;
  const critB = isAlertCritical(b) ? 0 : 1;
  if (critA !== critB) return critA - critB;

  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function sortAlertsForDisplay(alerts) {
  return [...alerts].sort(compareAlertsForDisplay);
}

function buildOfflineGroupSummary(alerts) {
  const count = alerts.length;
  const byScreenhouse = new Map();

  for (const alert of alerts) {
    const shName = alert.screenhouse_name ?? `Screenhouse ${alert.screenhouse_id}`;
    if (!byScreenhouse.has(shName)) byScreenhouse.set(shName, []);
    byScreenhouse.get(shName).push(getTrayLabel(alert));
  }

  const screenhouseParts = [...byScreenhouse.entries()].map(([name, trays]) => {
    const unique = [...new Set(trays)];
    return `${name} (${unique.join(", ")})`;
  });

  const countLabel = count === 1 ? "1 tray" : `${count} tray`;
  return `${countLabel} tidak mengirim data · ${screenhouseParts.join(", ")}`;
}

function buildSoilGroupSummary(alerts) {
  const message = alerts[0]?.message ?? "Peringatan";
  const screenhouses = [...new Set(alerts.map((a) => a.screenhouse_name).filter(Boolean))];

  if (screenhouses.length <= 1) {
    const sh = screenhouses[0];
    return sh ? `${message} · ${sh}` : message;
  }

  return `${message} · ${screenhouses.join(", ")} (${alerts.length} lokasi)`;
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
      items.push({
        kind: "group",
        id: `group-${group.key}`,
        category: group.category,
        alerts: group.alerts,
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
