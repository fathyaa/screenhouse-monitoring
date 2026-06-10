import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Clock3, Search, X, Leaf, Radio, Bell, Activity, Plus } from "lucide-react";
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
import socket from "../lib/socket";
import {
  buildPetaniAlertUrl,
  isAttentionStatus,
  pickPrimaryAlert,
} from "../utils/petaniAlertNav";
import { screenhouseMatchesQuery } from "../utils/screenhouseSearch";
import PullToRefresh from "../components/PullToRefresh";

const CARD_STATUS_RANK = { critical: 4, warning: 3, offline: 2, pending: 1.5, healthy: 1 };

function normalizeDashboardStats(raw) {
  const activeNodes = Number(raw?.active_nodes) || 0;
  const onlineNodes =
    raw?.online_nodes != null
      ? Number(raw.online_nodes) || 0
      : raw?.active_sensors != null
      ? Number(raw.active_sensors) || 0
      : 0;
  const offlineNodes =
    raw?.offline_nodes != null
      ? Number(raw.offline_nodes) || 0
      : Math.max(activeNodes - onlineNodes, 0);

  return {
    screenhouse_count: Number(raw?.screenhouse_count) || 0,
    active_nodes: activeNodes,
    online_nodes: onlineNodes,
    offline_nodes: offlineNodes,
  };
}

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
  const [dashboardStats, setDashboardStats] = useState({
    screenhouse_count: 0,
    active_nodes: 0,
    online_nodes: 0,
    offline_nodes: 0,
  });

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  const { alerts, activeCount, unreadCount, unreadAlerts, resolvedCount, totalCount, refetchAlerts } =
    useAlerts();

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

  const goToFirstActiveAlert = useCallback(() => {
    const primary = pickPrimaryAlert(unreadAlerts.length ? unreadAlerts : activeAlerts);
    goToAlert({ alertId: primary?.id });
  }, [unreadAlerts, activeAlerts, goToAlert]);

  const alertsByScreenhouse = useMemo(() => {
    const map = {};
    activeAlerts.forEach((a) => {
      map[a.screenhouse_id] = [...(map[a.screenhouse_id] ?? []), a];
    });
    return map;
  }, [activeAlerts]);

  useEffect(() => {
    refetchAlerts();
  }, [refetchAlerts]);

  useEffect(() => {
    refetchAlerts();
  }, [refetchAlerts]);

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

  const loadDashboardStats = useCallback(() => {
    if (!token) return Promise.resolve();
    return fetch(`${API_URL}/screenhouses/my-stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.screenhouse_count != null) {
          setDashboardStats(normalizeDashboardStats(data));
        } else if (data?.message) {
          console.error("[my-stats]", data.message);
        }
      })
      .catch(console.error);
  }, [token]);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      loadScreenhouses(),
      loadLatestSensorData(),
      loadDashboardStats(),
      refetchAlerts(),
    ]);
  }, [loadScreenhouses, loadLatestSensorData, loadDashboardStats, refetchAlerts]);

  useEffect(() => {
    loadLatestSensorData();
    const intervalId = setInterval(loadLatestSensorData, 30000);
    return () => clearInterval(intervalId);
  }, [loadLatestSensorData]);

  useEffect(() => {
    const pollAlerts = setInterval(refetchAlerts, 30000);
    return () => clearInterval(pollAlerts);
  }, [refetchAlerts]);

  useEffect(() => {
    loadScreenhouses();
  }, [loadScreenhouses]);

  useEffect(() => {
    loadDashboardStats();
  }, [loadDashboardStats]);

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

  const hasLiveData = Object.values(latestSensorData).some(Boolean);
  const bannerStatus =
    unreadCount > 0
      ? unreadAlerts.some(isAlertCritical)
        ? "critical"
        : "warning"
      : hasLiveData
      ? "healthy"
      : "none";

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

  const { active_nodes: activeNodes, online_nodes: onlineNodes, offline_nodes: offlineNodes } =
    dashboardStats;

  const summaryCards = [
    {
      label: "Screenhouse",
      hint: "Lokasi pembibitan yang aktif dan dimonitor",
      value: dashboardStats.screenhouse_count || screenhouses.length,
      icon: Leaf,
      bg: "bg-bl-surface-muted",
      color: "text-bl-primary",
    },
    {
      label: "Tray terpasang",
      hint: "Jumlah titik pantau (tray/node sensor) terdaftar di semua screenhouse Anda",
      value: activeNodes,
      icon: Radio,
      bg: "bg-blue-50",
      color: "text-blue-700",
    },
    {
      label: "Tray online",
      hint:
        offlineNodes > 0
          ? `${offlineNodes} tray belum kirim data terbaru · cek koneksi WSN`
          : "Tray yang masih mengirim data sesuai jadwal WSN",
      value: activeNodes > 0 ? `${onlineNodes}/${activeNodes}` : onlineNodes,
      valColor: offlineNodes > 0 ? "text-amber-700" : "text-bl-primary",
      icon: Activity,
      bg: offlineNodes > 0 ? "bg-amber-50" : "bg-bl-surface-muted",
      color: offlineNodes > 0 ? "text-amber-700" : "text-bl-primary",
    },
    {
      label: "Belum dibaca",
      hint: `${totalCount} total peringatan · ${resolvedCount} sudah ditangani`,
      value: unreadCount,
      icon: Bell,
      bg: "bg-red-50",
      color: "text-red-600",
      valColor: "text-red-600",
    },
  ];

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
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left">
            <div className="text-left">
              <div className="text-base font-semibold text-gray-800">
                Selamat pagi, {user?.name}!
              </div>
              <div className="text-sm text-gray-400 mt-0.5 text-left">
                {unreadCount > 0
                  ? `Ada ${unreadCount} peringatan belum dibaca`
                  : activeCount > 0
                  ? `${activeCount} peringatan aktif (sudah dilihat)`
                  : resolvedCount > 0
                  ? `Tidak ada peringatan baru · ${resolvedCount} sudah ditangani`
                  : "Semua screenhouse dalam kondisi normal"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => unreadCount > 0 && goToFirstActiveAlert()}
              className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-left transition border ${
                unreadCount > 0
                  ? "bg-red-50 border-red-300 hover:bg-red-100/80 alert-attention-pulse"
                  : "border-bl-primary/45 bg-[#e3f2ea]"
              } ${unreadCount > 0 ? "cursor-pointer" : "cursor-default"}`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full animate-pulse shrink-0 ${
                  unreadCount > 0 ? "bg-red-500" : "bg-bl-accent"
                }`}
              />
              <div className="text-left">
                <div
                  className={`text-xs font-semibold ${
                    unreadCount > 0 ? "text-red-800" : "text-bl-dark"
                  }`}
                >
                  {unreadCount > 0
                    ? `${unreadCount} peringatan belum dibaca`
                    : "Semua peringatan sudah dilihat"}
                </div>
                <div
                  className={`text-xs mt-0.5 ${
                    unreadCount > 0 ? "text-red-600" : "text-bl-primary"
                  }`}
                >
                  {unreadCount > 0
                    ? "Klik untuk lihat peringatan"
                    : activeCount > 0
                    ? `${activeCount} masih aktif · ditangani otomatis`
                    : resolvedCount > 0
                    ? `${resolvedCount} peringatan sudah ditangani`
                    : "Monitoring berjalan normal"}
                </div>
              </div>
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {summaryCards.map((card) => {
              const isAlertCard = card.label === "Belum dibaca" && unreadCount > 0;
              const CardTag = isAlertCard ? "button" : "div";
              return (
                <CardTag
                  key={card.label}
                  type={isAlertCard ? "button" : undefined}
                  title={card.hint}
                  onClick={isAlertCard ? goToFirstActiveAlert : undefined}
                  className={`bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 text-left w-full ${
                    isAlertCard
                      ? "cursor-pointer hover:border-red-200 hover:bg-red-50/40 alert-attention-pulse"
                      : ""
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${card.bg}`}
                  >
                    <card.icon size={17} className={card.color} />
                  </div>
                  <div className="text-left">
                    <div className={`text-xl font-bold ${card.valColor ?? "text-gray-800"}`}>
                      {card.value}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{card.label}</div>
                  </div>
                </CardTag>
              );
            })}
          </div>

          {/* Status + tindakan (fokus petani) */}
          <div className="space-y-4 text-left">
            {/* Banner status besar */}
            {bannerStatus !== "none" && (
              <button
                type="button"
                onClick={
                  isAttentionStatus(bannerStatus) ? goToFirstActiveAlert : undefined
                }
                disabled={!isAttentionStatus(bannerStatus)}
                className={`w-full rounded-2xl px-5 py-4 flex items-center gap-4 text-left transition border ${
                  bannerStatus === "healthy"
                    ? "border-bl-primary/45 bg-[#e3f2ea]"
                    : bannerStatus === "warning"
                    ? "border-amber-300 bg-amber-50 hover:bg-amber-100/60 cursor-pointer alert-attention-pulse"
                    : "border-red-300 bg-red-50 hover:bg-red-100/60 cursor-pointer alert-attention-pulse"
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-2xl shrink-0 ${
                    bannerStatus === "healthy"
                      ? "bg-white/70 text-bl-primary"
                      : bannerStatus === "warning"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {bannerStatus === "healthy" ? "✓" : "!"}
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-base font-bold ${
                      bannerStatus === "healthy"
                        ? "text-bl-dark"
                        : bannerStatus === "warning"
                        ? "text-amber-950"
                        : "text-red-800"
                    }`}
                  >
                    {bannerStatus === "healthy"
                      ? "Semua screenhouse Anda sehat"
                      : `${unreadCount} peringatan belum dibaca`}
                  </div>
                  <div
                    className={`text-sm mt-0.5 ${
                      bannerStatus === "healthy"
                        ? "text-gray-600"
                        : bannerStatus === "warning"
                        ? "text-amber-800"
                        : "text-red-800"
                    }`}
                  >
                    {bannerStatus === "healthy"
                      ? "Tidak ada peringatan aktif. Semua dalam batas normal."
                      : "Klik untuk lihat peringatan yang bersangkutan"}
                  </div>
                </div>
              </button>
            )}

            {/* To-do: yang perlu dilakukan */}
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
          </div>

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
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock3 size={12} />
                          {sensor?.created_at
                            ? new Date(sensor.created_at).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Belum ada"}
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
        </PullToRefresh>
      </div>
    </div>
  );
}

export default PetaniDashboard;
