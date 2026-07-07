import { isAlertCritical } from "../constants/paramHealth";
import { ALERT_PARAM_MAP } from "../constants/sensorMetrics";
import { getAlertCategory, ALERT_CATEGORY } from "./alertDisplay";

export function buildPetaniAlertUrl({ alertId, screenhouseId } = {}) {
  const params = new URLSearchParams();
  if (alertId != null) params.set("highlight", String(alertId));
  else if (screenhouseId != null) params.set("screenhouse", String(screenhouseId));
  const qs = params.toString();
  return `/petani/peringatan${qs ? `?${qs}` : ""}`;
}

export function pickPrimaryAlert(alerts = []) {
  if (!alerts.length) return null;
  const soilAlerts = alerts.filter((a) => getAlertCategory(a) === ALERT_CATEGORY.SOIL);
  const pool = soilAlerts.length ? soilAlerts : alerts;
  return pool.find(isAlertCritical) ?? pool[0];
}

export function findAlertForScreenhouse(alerts, screenhouseId, paramKey = null) {
  const active = alerts.filter(
    (a) => String(a.screenhouse_id) === String(screenhouseId) && a.status === "active"
  );
  if (!paramKey) return pickPrimaryAlert(active);

  const row = ALERT_PARAM_MAP.find((r) => r.param === paramKey);
  if (!row) return pickPrimaryAlert(active);

  return (
    active.find((a) => a.message?.toLowerCase().includes(row.match)) ??
    pickPrimaryAlert(active)
  );
}

export function isAttentionStatus(status) {
  return status === "critical" || status === "warning";
}

function findScrollParent(el) {
  let parent = el.parentElement;
  while (parent) {
    const { overflowY } = window.getComputedStyle(parent);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      parent.scrollHeight > parent.clientHeight
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

function scrollAlertIntoView(el) {
  const scrollParent = findScrollParent(el);
  if (!scrollParent) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const elRect = el.getBoundingClientRect();
  const parentRect = scrollParent.getBoundingClientRect();
  const targetTop =
    elRect.top -
    parentRect.top +
    scrollParent.scrollTop -
    scrollParent.clientHeight / 2 +
    elRect.height / 2;

  scrollParent.scrollTo({
    top: Math.max(0, targetTop),
    behavior: "smooth",
  });
}

/** Scroll ke kartu peringatan + callback setelah elemen ditemukan (retry untuk navigasi dari dashboard). */
export function focusAlertHighlight(
  targetId,
  { onFound, onGiveUp, maxAttempts = 30, intervalMs = 120 } = {}
) {
  const id = targetId != null ? String(targetId) : "";
  if (!id) {
    onGiveUp?.();
    return () => {};
  }

  let attempts = 0;
  let cancelled = false;

  const tryScroll = () => {
    if (cancelled) return;

    const el = document.getElementById(`alert-${id}`);
    if (el) {
      scrollAlertIntoView(el);
      onFound?.(id);
      return;
    }

    attempts += 1;
    if (attempts < maxAttempts) {
      window.setTimeout(tryScroll, intervalMs);
    } else {
      onGiveUp?.();
    }
  };

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(tryScroll);
  });

  return () => {
    cancelled = true;
  };
}
