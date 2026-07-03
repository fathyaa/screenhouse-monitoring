import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Clock3, Search, X, Radio, Plus } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import { useAlerts } from "../context/AlertContext";
import PetaniTopbar from "../layouts/PetaniTopbar";
import ActuatorControls from "../components/ActuatorControls";
import {
  getAutoHandledNotice,
} from "../constants/actuatorRules";
import {
  loadDismissedActuatorHints,
  persistDismissedActuatorHint,
} from "../utils/dismissedActuatorHints";
import { getAdviceForAlert, isAlertCritical } from "../constants/paramHealth";

import { API_URL } from "../config/api";
import { getSocket } from "../lib/socket";
import {
  buildPetaniAlertUrl,
  isAttentionStatus,
  pickPrimaryAlert,
} from "../utils/petaniAlertNav";
import { screenhouseMatchesQuery } from "../utils/screenhouseSearch";
import { formatLastSensorUpdate } from "../constants/screenhouseStatus";
import PullToRefresh from "../components/PullToRefresh";
import {
  ScreenhouseCardsSkeleton,
  Skeleton,
} from "../components/LoadingUI";

const CARD_STATUS_RANK = { critical: 4, warning: 3, offline: 2, pending: 1.5, healthy: 1 };

function getScreenhouseCardMeta(sensor, screenhouseAlerts = [], screenhouseStatus = "active") {
  if (screenhouseStatus === "pending") {
    return {
      status: "pending",
      rank: CARD_STATUS_RANK.pending,
      chip: { label: "Menunggu approval", cls: "bg-amber-50 text-amber-700" },
      primaryAlert: null,
    };
  }

  if (screenhouseAlerts.length > 0) {
    const critical = screenhouseAlerts.some(isAlertCritical);
    return {
      status: critical ? "critical" : "warning",
      rank: critical ? CARD_STATUS_RANK.critical : CARD_STATUS_RANK.warning,
      chip: { label: "Perlu perhatian", cls: critical ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700" },
      primaryAlert: pickPrimaryAlert(screenhouseAlerts),
    };
  }

  if (!sensor) {
    return {
      status: "offline",
      rank: CARD_STATUS_RANK.offline,
      chip: { label: "Tidak ada data", cls: "bg-slate-100 text-slate-500" },
      primaryAlert: null,
    };
  }

  return {
    status: "healthy",
    rank: CARD_STATUS_RANK.healthy,
    chip: { label: "Sehat", cls: "bg-bl-surface-muted text-bl-primary" },
    primaryAlert: null,
  };
}

function PetaniDashboard() {
  const [screenhouses, setScreenhouses] = useState([]);
  const [latestSensorData, setLatestSensorData] = useState({});
  const [dismissedActuatorHints, setDismissedActuatorHints] = useState(() =>
    loadDismissedActuatorHints()
  );
  const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
  const [searchQuery, setSearchQuery] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  const { alerts, unreadAlerts, refetchAlerts } = useAlerts();

  const goToAlert = useCallback(
    ({ alertId, screenhouseId } = {}) => {
      navigate(buildPetaniAlertUrl({ alertId, screenhouseId }));
    },
    [navigate]
  );

  const activeAlerts = useMemo(
    () => alerts.filter((a) => a.status === "active"),
    [alerts]
  );

  const alertsByScreenhouse = useMemo(() => {
    const map = {};
    activeAlerts.forEach((a) => {
      map[a.screenhouse_id] = [...(map[a.screenhouse_id] ?? []), a];
    });
    return map;
  }, [activeAlerts]);


  const loadLatestSensorData = useCallback(() => {
    if (!token) return Promise.resolve();
    return fetch(`${API_URL}/sensor-data/latest`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const mapped = {};
        data.forEach((item) => {
          if (item.screenhouse_id != null) {
            mapped[item.screenhouse_id] = item;
          }
        });
        setLatestSensorData(mapped);
      })
      .catch(console.error);
  }, [token]);

  const loadScreenhouses = useCallback(() => {
    if (!token) return Promise.resolve();
    return fetch(`${API_URL}/screenhouses/my-screenhouses`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setScreenhouses(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [token]);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      loadScreenhouses(),
      loadLatestSensorData(),
      refetchAlerts(),
    ]);
  }, [loadScreenhouses, loadLatestSensorData, refetchAlerts]);

  useEffect(() => {
    let active = true;
    refreshDashboard().finally(() => {
      if (active) setPageLoading(false);
    });
    return () => {
      active = false;
    };
  }, [refreshDashboard]);

  useEffect(() => {
    const intervalId = setInterval(loadLatestSensorData, 30000);
    return () => clearInterval(intervalId);
  }, [loadLatestSensorData]);

  useEffect(() => {
    const pollAlerts = setInterval(refetchAlerts, 30000);
    return () => clearInterval(pollAlerts);
  }, [refetchAlerts]);

  useEffect(() => {
    const handler = (update) => {
      if (!update?.screenhouse_id) return;
      setLatestSensorData((prev) => {
        const current = prev[update.screenhouse_id];
        return {
          ...prev,
          [update.screenhouse_id]: {
            ...(current ?? {}),
            ...update,
            screenhouse_id: update.screenhouse_id,
          },
        };
      });
      refetchAlerts();
    };
    const socket = getSocket();
    if (!socket) return;

    socket.on("sensor-update", handler);
    return () => socket.off("sensor-update", handler);
  }, [refetchAlerts]);

  useEffect(() => {
    const handler = (update) => {
      if (!update?.screenhouse_id) return;
      setLatestSensorData((prev) => {
        const current = prev[update.screenhouse_id];
        if (!current) return prev;
        return {
          ...prev,
          [update.screenhouse_id]: {
            ...current,
            fan_status: update.fan_status,
            irrigation_status: update.irrigation_status,
            lamp_status: update.lamp_status,
            created_at: update.created_at ?? current.created_at,
          },
        };
      });
    };
    const socket = getSocket();
    if (!socket) return;

    socket.on("actuator-update", handler);
    return () => socket.off("actuator-update", handler);
  }, []);

  const handleActuatorUpdated = useCallback((update) => {
    if (!update?.screenhouse_id) return;
    setLatestSensorData((prev) => {
      const current = prev[update.screenhouse_id];
      if (!current) return prev;
      return {
        ...prev,
        [update.screenhouse_id]: {
          ...current,
          fan_status: update.fan_status,
          irrigation_status: update.irrigation_status,
          lamp_status: update.lamp_status,
          created_at: update.created_at ?? current.created_at,
        },
      };
    });
  }, []);

  const dismissActuatorHint = useCallback((alertId) => {
    const next = persistDismissedActuatorHint(alertId);
    setDismissedActuatorHints(new Set(next));
  }, []);

  const todoItems = useMemo(
    () =>
      unreadAlerts.map((a) => ({
        id: a.id,
        screenhouseName: a.screenhouse_name,
        message: a.message,
        advice: getAdviceForAlert(a),
        critical: isAlertCritical(a),
      })),
    [unreadAlerts]
  );

  const sortedScreenhouses = useMemo(
    () =>
      [...screenhouses].sort((a, b) => {
        const rankA = getScreenhouseCardMeta(
          latestSensorData[a.id],
          alertsByScreenhouse[a.id],
          a.status
        ).rank;
        const rankB = getScreenhouseCardMeta(
          latestSensorData[b.id],
          alertsByScreenhouse[b.id],
          b.status
        ).rank;
        if (rankB !== rankA) return rankB - rankA;
        return a.name.localeCompare(b.name, "id");
      }),
    [screenhouses, latestSensorData, alertsByScreenhouse]
  );

  const filteredScreenhouses = useMemo(() => {
    if (!searchQuery.trim()) return sortedScreenhouses;
    return sortedScreenhouses.filter((sh) => screenhouseMatchesQuery(sh, searchQuery));
  }, [sortedScreenhouses, searchQuery]);

  return (
    <div className="app-shell fixed inset-0 flex bg-bl-surface overflow-hidden text-left">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        screenhouses={screenhouses}
        role={user?.role}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 text-left">
        <PetaniTopbar
          onToggleSidebar={toggleSidebar}
          title="Dashboard petani"
          subtitle={`Halo, ${user?.name}. Pantau screenhouse kamu.`}
        />

        <PullToRefresh onRefresh={refreshDashboard} className="p-4 sm:p-5 space-y-4 text-left">
          {pageLoading ? (
            <>
              <Skeleton className="h-24 rounded-2xl" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-36" />
                <ScreenhouseCardsSkeleton count={4} />
              </div>
            </>
          ) : (
            <>
          {todoItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm font-semibold text-gray-800">Peringatan aktif</div>
                <button
                  type="button"
                  onClick={() => navigate("/petani/peringatan")}
                  className="text-xs font-medium text-bl-primary hover:underline"
                >
                  Lihat semua
                </button>
              </div>
              <div className="space-y-1.5">
                {todoItems.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => goToAlert({ alertId: t.id })}
                    className={`w-full flex items-start gap-2 text-sm rounded-lg px-3 py-2 text-left transition border hover:opacity-90 ${
                      t.critical
                        ? "border-red-300 bg-red-50 text-red-950 hover:bg-red-100/70 alert-attention-pulse"
                        : "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100/70 alert-attention-pulse"
                    }`}
                  >
                    <span
                      className="mt-1 w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: t.critical ? "#dc2626" : "#d97706" }}
                    />
                    <span>
                      <span className="font-semibold">{t.screenhouseName}</span>: {t.message}
                      {t.advice && (
                        <span className="text-gray-500"> · {t.advice}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-left space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-800">Screenhouse saya</div>
                <div className="text-xs text-gray-400 mt-0.5 text-left">
                  Yang perlu perhatian ditampilkan paling atas
                  {searchQuery.trim() && (
                    <span className="text-gray-500">
                      {" "}
                      · {filteredScreenhouses.length} dari {sortedScreenhouses.length} ditampilkan
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/petani/ajukan-screenhouse")}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-bl-primary hover:bg-bl-primary-hover text-white text-xs font-medium transition"
              >
                <Plus size={14} />
                Ajukan
              </button>
            </div>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="text"
                role="searchbox"
                aria-label="Cari screenhouse"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama screenhouse..."
                className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-bl-primary/20 focus:border-bl-primary/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded"
                  aria-label="Hapus pencarian"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {filteredScreenhouses.length === 0 && searchQuery.trim() ? (
              <div className="text-center py-8 text-sm text-gray-400 bg-white rounded-2xl border border-gray-200">
                Tidak ada screenhouse yang cocok dengan &ldquo;{searchQuery.trim()}&rdquo;
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredScreenhouses.map((sh) => {
              const sensor = latestSensorData[sh.id];
              const shAlerts = alertsByScreenhouse[sh.id] ?? [];
              const cardMeta = getScreenhouseCardMeta(sensor, shAlerts, sh.status);
              const { chip: statusChip, status, primaryAlert } = cardMeta;
              const isPending = sh.status === "pending";
              const needsAttention = isAttentionStatus(status);
              const autoHandledNotice = primaryAlert
                ? getAutoHandledNotice(primaryAlert)
                : null;
              const showActuatorHint =
                autoHandledNotice &&
                primaryAlert &&
                !dismissedActuatorHints.has(String(primaryAlert.id));

              return (
                <div
                  key={sh.id}
                  className={`bg-white rounded-2xl border overflow-hidden text-left ${
                    status === "critical"
                      ? "border-red-200"
                      : status === "warning"
                      ? "border-amber-200"
                      : isPending
                      ? "border-amber-100"
                      : "border-gray-200"
                  }`}
                >
                  <div className="px-4 py-3.5 border-b border-gray-100 flex items-start justify-between text-left">
                    <div className="text-left min-w-0">
                      <button
                        type="button"
                        onClick={() => !isPending && navigate(`/petani/screenhouse/${sh.id}`)}
                        disabled={isPending}
                        className={`text-sm font-semibold text-left ${
                          isPending
                            ? "text-gray-500 cursor-default"
                            : "text-gray-800 hover:text-bl-primary hover:underline"
                        }`}
                      >
                        {sh.name}
                      </button>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <MapPin size={12} />
                          {sh.village}
                        </div>
                        <div
                          className="flex items-center gap-1 text-[11px] text-gray-400"
                          title={
                            sensor?.created_at
                              ? new Date(sensor.created_at).toLocaleString("id-ID", {
                                  timeZone: "Asia/Jakarta",
                                })
                              : undefined
                          }
                        >
                          <Clock3 size={12} className="shrink-0" />
                          <span>
                            {sensor?.created_at
                              ? formatLastSensorUpdate(sensor.created_at)
                              : "Belum ada data sensor"}
                          </span>
                        </div>
                        {(sh.node_count ?? 0) > 0 && (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Radio size={12} />
                            {sh.node_count} node
                          </div>
                        )}
                      </div>
                    </div>
                    {needsAttention ? (
                      <button
                        type="button"
                        onClick={() =>
                          goToAlert({
                            alertId: primaryAlert?.id,
                            screenhouseId: sh.id,
                          })
                        }
                        className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 transition hover:opacity-90 alert-attention-pulse ${statusChip.cls}`}
                      >
                        {statusChip.label}
                      </button>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusChip.cls}`}
                      >
                        {statusChip.label}
                      </span>
                    )}
                  </div>

                  <div className="px-4 pb-4">
                    {isPending ? (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        Pengajuan screenhouse menunggu persetujuan operator. Monitoring akan aktif setelah disetujui.
                      </p>
                    ) : (
                      <>
                    {showActuatorHint && (
                      <div className="mb-2 flex items-start gap-2 text-[10px] text-bl-primary bg-bl-surface-muted border border-bl-accent/20 rounded-lg px-2.5 py-1.5">
                        <span className="flex-1">{autoHandledNotice}</span>
                        <button
                          type="button"
                          onClick={() => dismissActuatorHint(primaryAlert.id)}
                          className="shrink-0 text-bl-primary hover:text-bl-dark p-0.5 rounded transition"
                          aria-label="Tutup pesan"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                    <ActuatorControls
                      compact
                      screenhouseId={sh.id}
                      sensorNodeId={sensor?.sensor_node_id}
                      fan_status={sensor?.fan_status}
                      irrigation_status={sensor?.irrigation_status}
                      lamp_status={sensor?.lamp_status}
                      disabled={!sensor}
                      onUpdated={handleActuatorUpdated}
                    />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
              </div>
            )}
          </div>
            </>
          )}
        </PullToRefresh>
      </div>
    </div>
  );
}

export default PetaniDashboard;
