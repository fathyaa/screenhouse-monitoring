const MONITORING_SERVICE_URL =
  process.env.MONITORING_SERVICE_URL || "http://localhost:3001";

const REQUEST_TIMEOUT_MS = Number(process.env.MONITORING_REQUEST_TIMEOUT_MS) || 8000;

// Fetches JSON from monitoring-service. Returns `fallback` (instead of throwing)
// when monitoring is unreachable, so app dashboards degrade gracefully.
async function monitoringGet(path, fallback = null, authorization = null) {
  try {
    const headers = {};
    if (authorization) headers.Authorization = authorization;

    const response = await fetch(`${MONITORING_SERVICE_URL}${path}`, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`monitoring ${path} -> HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error("[monitoring-client]", err.message);
    return fallback;
  }
}

async function monitoringPost(path, body, fallback = null, authorization = null) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (authorization) headers.Authorization = authorization;

    const response = await fetch(`${MONITORING_SERVICE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.message || `monitoring ${path} -> HTTP ${response.status}`);
      err.status = response.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err) {
    if (err.status) throw err;
    console.error("[monitoring-client]", err.message);
    return fallback;
  }
}

async function monitoringPatch(path, body, authorization, fallback = null) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (authorization) headers.Authorization = authorization;

    const response = await fetch(`${MONITORING_SERVICE_URL}${path}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.message || `monitoring ${path} -> HTTP ${response.status}`);
      err.status = response.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err) {
    if (err.status) throw err;
    console.error("[monitoring-client]", err.message);
    return fallback;
  }
}

module.exports = { monitoringGet, monitoringPost, monitoringPatch, MONITORING_SERVICE_URL };
