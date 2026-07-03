/** Pakai proxy Vite di dev — browser hanya bicara ke host:5174, tidak ke IP WiFi yang berubah. */
export function isDevProxy() {
  return import.meta.env.DEV && import.meta.env.VITE_DEV_PROXY !== "false";
}

/** App service — REST API (termasuk proxy ke monitoring) */
export const API_URL = isDevProxy()
  ? "/api"
  : import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Monitoring service — Socket.IO.
 * Dev + proxy: kosong (= same origin lewat Vite /socket.io).
 */
export const MONITORING_URL = isDevProxy()
  ? ""
  : import.meta.env.VITE_MONITORING_URL || "http://localhost:3001";
