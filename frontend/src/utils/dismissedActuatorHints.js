const STORAGE_KEY = "petani_dismissed_actuator_hints";

export function loadDismissedActuatorHints() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function persistDismissedActuatorHint(alertId) {
  const next = loadDismissedActuatorHints();
  next.add(String(alertId));
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  return next;
}
