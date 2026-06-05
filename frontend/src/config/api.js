/** App service — REST API (termasuk proxy ke monitoring) */
export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

/** Monitoring service — WebSocket (Socket.IO) */
export const MONITORING_URL =
  import.meta.env.VITE_MONITORING_URL || "http://localhost:3001";
