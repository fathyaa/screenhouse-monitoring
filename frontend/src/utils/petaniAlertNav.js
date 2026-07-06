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
