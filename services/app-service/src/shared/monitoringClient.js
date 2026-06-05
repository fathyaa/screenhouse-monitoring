const MONITORING_SERVICE_URL =
  process.env.MONITORING_SERVICE_URL || "http://localhost:3001";

// Fetches JSON from monitoring-service. Returns `fallback` (instead of throwing)
// when monitoring is unreachable, so app dashboards degrade gracefully.
async function monitoringGet(path, fallback = null) {
  try {
    const response = await fetch(`${MONITORING_SERVICE_URL}${path}`);
    if (!response.ok) {
      throw new Error(`monitoring ${path} -> HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error("[monitoring-client]", err.message);
    return fallback;
  }
}

module.exports = { monitoringGet, MONITORING_SERVICE_URL };
