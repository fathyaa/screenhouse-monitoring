const STORAGE_KEY = "petani_seen_auto_alerts";

export function loadSeenAutoAlerts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

export function markAutoAlertsSeen(alertIds) {
  const next = loadSeenAutoAlerts();
  alertIds.forEach((id) => next.add(String(id)));
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  return next;
}
