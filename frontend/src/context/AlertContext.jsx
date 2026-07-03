/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getSocket, authenticateSocket } from "../lib/socket";
import toast from "react-hot-toast";
import { TriangleAlert } from "lucide-react";
import { ALERT_PARAM_MAP } from "../constants/sensorMetrics";
import { getAutoHandledNotice, isAutoHandledAlert } from "../constants/actuatorRules";
import { loadSeenAutoAlerts, markAutoAlertsSeen } from "../utils/seenAutoAlerts";
import { installAlertSoundUnlock, playAlertSound } from "../utils/alertSound";
import { API_URL } from "../config/api";
import { usePushNotifications } from "./PushNotificationContext";

const AlertContext = createContext(null);
const TOAST_ID = "alert-notif";

function getCurrentUserId() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.id != null ? Number(user.id) : null;
  } catch {
    return null;
  }
}

/** Hanya petani pemilik screenhouse yang boleh menerima notifikasi alert ini. */
function alertBelongsToCurrentUser(alert) {
  const role = localStorage.getItem("role");
  if (role !== "petani") return false;

  const uid = getCurrentUserId();
  if (uid == null) return false;

  const ownerId = alert.user_id ?? alert.owner_user_id;
  if (ownerId == null) return false;

  return Number(ownerId) === uid;
}

/** Alert yang belum dibaca — manual selalu unread sampai resolve; otomatis unread sampai halaman peringatan dibuka. */
export function isUnreadAlert(alert, seenAutoAlertIds) {
  if (alert.status !== "active") return false;
  if (isAutoHandledAlert(alert) && seenAutoAlertIds.has(String(alert.id))) return false;
  return true;
}

export function AlertProvider({ children }) {
  const { enabled: pushEnabled } = usePushNotifications();
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [resolvingAlertId, setResolvingAlertId] = useState(null);
  const [seenAutoAlertIds, setSeenAutoAlertIds] = useState(() => loadSeenAutoAlerts());
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;

  const activeCount = alerts.filter((a) => a.status === "active").length;
  const resolvedCount = alerts.filter((a) => a.status === "resolved").length;
  const totalCount = alerts.length;

  const unreadCount = useMemo(
    () => alerts.filter((a) => isUnreadAlert(a, seenAutoAlertIds)).length,
    [alerts, seenAutoAlertIds]
  );

  const unreadAlerts = useMemo(
    () => alerts.filter((a) => isUnreadAlert(a, seenAutoAlertIds)),
    [alerts, seenAutoAlertIds]
  );

  const loadAlerts = useCallback(() => {
    const role = localStorage.getItem("role");
    const authToken = localStorage.getItem("token");

    if (!authToken || role !== "petani") {
      setAlerts([]);
      setAlertsLoading(false);
      return;
    }

    const userId = getCurrentUserId();
    if (userId) authenticateSocket(userId);

    setAlertsLoading(true);

    fetch(`${API_URL}/alerts`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          console.error("[alerts] fetch gagal", res.status, data?.message ?? data);
          return;
        }
        if (!Array.isArray(data)) {
          console.error("[alerts] respons bukan array", data);
          return;
        }
        setAlerts(data);
      })
      .catch((err) => console.error("[alerts] fetch gagal", err))
      .finally(() => setAlertsLoading(false));
  }, []);

  useEffect(() => {
    loadAlerts();
    window.addEventListener("auth-changed", loadAlerts);
    return () => window.removeEventListener("auth-changed", loadAlerts);
  }, [loadAlerts]);

  useEffect(() => {
    if (localStorage.getItem("role") !== "petani") return;
    return installAlertSoundUnlock();
  }, []);

  useEffect(() => {
    if (localStorage.getItem("role") !== "petani" || !localStorage.getItem("token")) {
      return;
    }

    const socket = getSocket();
    if (!socket) return;

    const onConnect = () => {
      const userId = getCurrentUserId();
      if (userId) authenticateSocket(userId);
    };

    socket.on("connect", onConnect);
    if (socket.connected) onConnect();

    const handleAlert = (newAlert) => {
      if (!alertBelongsToCurrentUser(newAlert)) {
        return;
      }

      const isEnriched =
        newAlert.actual_nitrogen !== undefined ||
        newAlert.actual_soil_moisture !== undefined ||
        newAlert.actual_phosphorus !== undefined ||
        newAlert.actual_potassium !== undefined;

      if (isEnriched && newAlert.status === "active") {
        setAlerts((prev) => {
          const exists = prev.find((a) => a.id === newAlert.id);
          if (exists) return prev;
          return [newAlert, ...prev];
        });
      } else {
        loadAlerts();
      }

      if (!pushEnabled) return;

      playAlertSound();

      toast.dismiss(TOAST_ID);
      const autoNotice = getAutoHandledNotice(newAlert);
      toast.custom(
        (t) => (
          <div
            className={`bg-white border border-red-100 shadow-xl rounded-2xl px-4 py-3 w-[320px] transition-all duration-300 ${t.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <TriangleAlert size={18} className="text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800">Peringatan baru</div>
                <div className="text-xs text-gray-500 mt-1 truncate">{newAlert.message}</div>
                {autoNotice && (
                  <div className="text-xs text-bl-primary mt-1 font-medium">{autoNotice}</div>
                )}
                <div className="text-xs text-gray-400 mt-0.5">{newAlert.screenhouse_name}</div>
              </div>
              <button
                onClick={() => toast.dismiss(TOAST_ID)}
                className="text-gray-300 hover:text-gray-500 text-lg leading-none shrink-0"
              >
                ×
              </button>
            </div>
          </div>
        ),
        { id: TOAST_ID, duration: 5000, position: "bottom-right" }
      );
    };

    socket.on("alert-update", handleAlert);

    const handleAlertResolved = (resolved) => {
      if (!alertBelongsToCurrentUser(resolved)) return;
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === resolved.id ? { ...a, ...resolved, status: "resolved" } : a
        )
      );
    };

    socket.on("alert-resolved", handleAlertResolved);
    return () => {
      socket.off("connect", onConnect);
      socket.off("alert-update", handleAlert);
      socket.off("alert-resolved", handleAlertResolved);
    };
  }, [loadAlerts, pushEnabled]);

  const resolveAlert = async (alertId) => {
    setResolvingAlertId(alertId);
    try {
      await fetch(`${API_URL}/alerts/${alertId}/resolve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? { ...a, status: "resolved", resolved_at: new Date().toISOString() }
            : a
        )
      );
    } catch {
      toast.error("Gagal menandai peringatan sudah ditangani");
    } finally {
      setResolvingAlertId(null);
    }
  };

  /** Tandai alert otomatis sudah dilihat — badge berkurang, alert tetap aktif di daftar. */
  const markAutoHandledAlertsSeen = useCallback(() => {
    const ids = alertsRef.current
      .filter((a) => a.status === "active" && isAutoHandledAlert(a))
      .map((a) => String(a.id));
    if (ids.length === 0) return;

    setSeenAutoAlertIds((prev) => {
      const newIds = ids.filter((id) => !prev.has(id));
      if (newIds.length === 0) return prev;
      return markAutoAlertsSeen(newIds);
    });
  }, []);

  return (
    <AlertContext.Provider
      value={{
        alerts,
        activeCount,
        unreadCount,
        unreadAlerts,
        resolvedCount,
        totalCount,
        alertsLoading,
        resolvingAlertId,
        resolveAlert,
        markAutoHandledAlertsSeen,
        refetchAlerts: loadAlerts,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
}

const defaultAlertsContext = {
  alerts: [],
  activeCount: 0,
  unreadCount: 0,
  unreadAlerts: [],
  resolvedCount: 0,
  totalCount: 0,
  alertsLoading: false,
  resolvingAlertId: null,
  resolveAlert: async () => {},
  markAutoHandledAlertsSeen: () => {},
  refetchAlerts: async () => {},
};

export function useAlerts() {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    console.warn("[useAlerts] Dipanggil di luar AlertProvider — pakai nilai default");
    return defaultAlertsContext;
  }
  return ctx;
}

function parseAlertParam(message) {
  const lower = message.toLowerCase();
  const found = ALERT_PARAM_MAP.find((row) => lower.includes(row.match));
  return found ?? null;
}

function getAlertDetail(alert) {
  const row = parseAlertParam(alert.message);
  if (!row) return null;

  const isMax = alert.message.toLowerCase().includes("maksimum");
  const isMin = alert.message.toLowerCase().includes("minimum");
  const actual = alert[row.actual];
  const min = alert[row.min];
  const max = alert[row.max];
  const threshold = isMax ? max : min;

  return {
    param: row.param,
    label: row.match,
    unit: row.unit,
    actual,
    min,
    max,
    threshold,
    isMax,
    isMin,
  };
}

export { getAlertDetail };
