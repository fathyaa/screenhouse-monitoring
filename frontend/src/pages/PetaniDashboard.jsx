import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Clock3, Search } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import { useAlerts } from "../context/AlertContext";
import PetaniTopbar from "../layouts/PetaniTopbar";
import ActuatorControls from "../components/ActuatorControls";
import { getActuatorHintForAlert } from "../constants/actuatorRules";
import { PRIMARY_SENSOR_FIELDS } from "../constants/sensorMetrics";
import {
  evaluateParam,
  getAdviceForAlert,
  isAlertCritical,
  STATUS_STYLE,
} from "../constants/paramHealth";
import { Leaf, Radio, Bell, Droplets, Activity, Thermometer, Gauge, ChevronDown } from "lucide-react";

import { API_URL } from "../config/api";
import socket from "../lib/socket";
import {
  buildPetaniAlertUrl,
  findAlertForScreenhouse,
  isAttentionStatus,
  pickPrimaryAlert,
} from "../utils/petaniAlertNav";

const CARD_STATUS_RANK = { critical: 4, warning: 3, offline: 2, healthy: 1 };

function getScreenhouseCardMeta(sensor, screenhouseAlerts = []) {
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
    chip: { label: "Sehat", cls: "bg-green-50 text-green-700" },
    primaryAlert: null,
  };
}

function PetaniDashboard() {
  const [screenhouses, setScreenhouses] = useState([]);
  const [latestSensorData, setLatestSensorData] = useState({});
  const [chartThreshold, setChartThreshold] = useState(null);
  const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
  const [searchQuery, setSearchQuery] = useState("");
  const [dashboardStats, setDashboardStats] = useState({
    screenhouse_count: 0,
    active_nodes: 0,
    active_sensors: 0,
  });

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  const { alerts, activeCount, resolvedCount, totalCount, refetchAlerts } = useAlerts();
  const headers = { Authorization: `Bearer ${token}` };

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
    const primary = pickPrimaryAlert(activeAlerts);
    goToAlert({ alertId: primary?.id });
  }, [activeAlerts, goToAlert]);

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
    fetch(`${API_URL}/screenhouses/my-screenhouses`, { headers })
      .then((res) => res.json())
      .then((data) => setScreenhouses(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/screenhouses/my-stats`, { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data?.screenhouse_count != null) {
          setDashboardStats(data);
        } else if (data?.message) {
          console.error("[my-stats]", data.message);
        }
      })
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    fetch(`${API_URL}/sensor-data/latest`, { headers })
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
  }, []);

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

  useEffect(() => {
    if (!screenhouses.length || !token) {
      setChartThreshold(null);
      return;
    }

    fetch(`${API_URL}/sensor-data/screenhouse/${screenhouses[0].id}/dashboard`, { headers })
      .then((r) => r.json())
      .then((data) => setChartThreshold(data?.threshold ?? null))
      .catch(console.error);
  }, [screenhouses, token]);

  const todoItems = useMemo(
    () =>
      activeAlerts.map((a) => ({
        id: a.id,
        screenhouseName: a.screenhouse_name,
        message: a.message,
        advice: getAdviceForAlert(a),
        critical: isAlertCritical(a),
      })),
    [activeAlerts]
  );

  const hasLiveData =
    chartThreshold && Object.values(latestSensorData).some(Boolean);
  const bannerStatus =
    activeCount > 0
      ? activeAlerts.some(isAlertCritical)
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
          alertsByScreenhouse[a.id]
        ).rank;
        const rankB = getScreenhouseCardMeta(
          latestSensorData[b.id],
          alertsByScreenhouse[b.id]
        ).rank;
        if (rankB !== rankA) return rankB - rankA;
        return a.name.localeCompare(b.name, "id");
      }),
    [screenhouses, latestSensorData, alertsByScreenhouse]
  );

  const filteredScreenhouses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedScreenhouses;
    return sortedScreenhouses.filter((sh) =>
      [sh.name, sh.village, sh.district, sh.regency, sh.province, sh.address_detail].some(
        (field) => field?.toLowerCase().includes(q)
      )
    );
  }, [sortedScreenhouses, searchQuery]);

  const summaryCards = [
    {
      label: "Screenhouse",
      value: dashboardStats.screenhouse_count || screenhouses.length,
      icon: Leaf,
      bg: "bg-green-50",
      color: "text-green-700",
    },
    {
      label: "Titik pantau aktif",
      hint: "Node sensor yang diaktifkan di screenhouse Anda",
      value: dashboardStats.active_nodes,
      icon: Radio,
      bg: "bg-blue-50",
      color: "text-blue-700",
    },
    {
      label: "Sensor aktif",
      hint: "Titik pantau yang mengirim data dalam 24 jam terakhir",
      value: dashboardStats.active_sensors,
      icon: Activity,
      bg: "bg-emerald-50",
      color: "text-emerald-700",
    },
    {
      label: "Peringatan aktif",
      hint: `${totalCount} total · ${resolvedCount} sudah ditangani`,
      value: activeCount,
      icon: Bell,
      bg: "bg-red-50",
      color: "text-red-600",
      valColor: "text-red-600",
    },
  ];

  const sensorIcons = {
    nitrogen: Leaf,
    phosphorus: Activity,
    potassium: Activity,
    soil_moisture: Droplets,
    soil_temperature: Thermometer,
    soil_ph: Gauge,
    air_temperature: Thermometer,
    air_humidity: Droplets,
  };

  const sensorKeys = PRIMARY_SENSOR_FIELDS.map((f) => ({
    ...f,
    icon: sensorIcons[f.key] ?? Activity,
  }));

  return (
    <div className="app-shell fixed inset-0 flex bg-slate-100 overflow-hidden text-left">
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
          subtitle={`Halo, ${user?.name} — pantau screenhouse kamu`}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-left">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left">
            <div className="text-left">
              <div className="text-base font-semibold text-gray-800">
                Selamat pagi, {user?.name} 👋
              </div>
              <div className="text-sm text-gray-400 mt-0.5 text-left">
                {activeCount > 0
                  ? `Ada ${activeCount} peringatan aktif yang perlu ditangani`
                  : resolvedCount > 0
                  ? `Tidak ada peringatan aktif · ${resolvedCount} sudah ditangani`
                  : "Semua screenhouse dalam kondisi normal"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => activeCount > 0 && goToFirstActiveAlert()}
              className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-left transition ${
                activeCount > 0 ? "bg-red-50 hover:bg-red-100/80 alert-attention-pulse" : "bg-green-50"
              } ${activeCount > 0 ? "cursor-pointer" : "cursor-default"}`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full animate-pulse shrink-0 ${
                  activeCount > 0 ? "bg-red-500" : "bg-green-500"
                }`}
              />
              <div className="text-left">
                <div
                  className={`text-xs font-semibold ${
                    activeCount > 0 ? "text-red-800" : "text-green-800"
                  }`}
                >
                  {activeCount > 0
                    ? `${activeCount} peringatan aktif`
                    : "Semua device online"}
                </div>
                <div
                  className={`text-xs mt-0.5 ${
                    activeCount > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {activeCount > 0
                    ? "Klik untuk lihat peringatan"
                    : resolvedCount > 0
                    ? `${resolvedCount} peringatan sudah ditangani`
                    : "Monitoring berjalan normal"}
                </div>
              </div>
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {summaryCards.map((card) => {
              const isAlertCard = card.label === "Peringatan aktif" && activeCount > 0;
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
                className={`w-full rounded-2xl px-5 py-4 flex items-center gap-4 text-left transition ${
                  bannerStatus === "healthy"
                    ? "bg-green-50 border border-green-100"
                    : bannerStatus === "warning"
                    ? "bg-amber-50 border border-amber-100 hover:bg-amber-100/60 cursor-pointer alert-attention-pulse"
                    : "bg-red-50 border border-red-100 hover:bg-red-100/60 cursor-pointer alert-attention-pulse"
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-2xl shrink-0 ${
                    bannerStatus === "healthy"
                      ? "bg-green-100 text-green-700"
                      : bannerStatus === "warning"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {bannerStatus === "healthy" ? "✓" : "!"}
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-base font-bold ${
                      bannerStatus === "healthy"
                        ? "text-green-800"
                        : bannerStatus === "warning"
                        ? "text-amber-800"
                        : "text-red-800"
                    }`}
                  >
                    {bannerStatus === "healthy"
                      ? "Semua screenhouse Anda sehat"
                      : `${activeCount} peringatan aktif`}
                  </div>
                  <div className="text-sm text-gray-600 mt-0.5">
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
                    className="text-xs font-medium text-[#1e4d2b] hover:underline"
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
                      className={`w-full flex items-start gap-2 text-sm text-gray-700 rounded-lg px-3 py-2 text-left transition hover:opacity-90 ${
                        t.critical
                          ? "bg-red-50 hover:bg-red-100/70 alert-attention-pulse"
                          : "bg-amber-50 hover:bg-amber-100/70 alert-attention-pulse"
                      }`}
                    >
                      <span
                        className="mt-1 w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: t.critical ? "#dc2626" : "#d97706" }}
                      />
                      <span>
                        <span className="font-semibold">{t.screenhouseName}</span> — {t.message}
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
            <div>
              <div className="text-sm font-semibold text-gray-800">Screenhouse saya</div>
              <div className="text-xs text-gray-400 mt-0.5 text-left">
                Yang perlu perhatian ditampilkan paling atas
              </div>
            </div>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau lokasi screenhouse..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e4d2b]/20 focus:border-[#1e4d2b]/40"
              />
            </div>
          </div>

          {filteredScreenhouses.length === 0 && searchQuery.trim() && (
            <div className="text-center py-8 text-sm text-gray-400">
              Tidak ada screenhouse yang cocok dengan &ldquo;{searchQuery.trim()}&rdquo;
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredScreenhouses.map((sh) => {
              const sensor = latestSensorData[sh.id];
              const shAlerts = alertsByScreenhouse[sh.id] ?? [];
              const cardMeta = getScreenhouseCardMeta(sensor, shAlerts);
              const { chip: statusChip, status, primaryAlert } = cardMeta;
              const needsAttention = isAttentionStatus(status);

              return (
                <div
                  key={sh.id}
                  className={`bg-white rounded-2xl border overflow-hidden text-left ${
                    status === "critical"
                      ? "border-red-200"
                      : status === "warning"
                      ? "border-amber-200"
                      : "border-gray-200"
                  }`}
                >
                  <div className="px-4 py-3.5 border-b border-gray-100 flex items-start justify-between text-left">
                    <div className="text-left">
                      <div className="text-sm font-semibold text-gray-800">{sh.name}</div>
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
                            : "—"}
                        </div>
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

                  <div className="px-4 pb-3">
                    {primaryAlert && getActuatorHintForAlert(primaryAlert) && (
                      <div className="mb-2 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                        {getActuatorHintForAlert(primaryAlert)}
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
                  </div>

                  <details className="group border-t border-gray-100">
                    <summary className="flex items-center justify-between gap-2 px-4 py-2 cursor-pointer list-none text-xs font-medium text-gray-500 hover:bg-gray-50">
                      <span>Lihat data sensor</span>
                      <ChevronDown
                        size={14}
                        className="text-gray-400 transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <div className="p-3 pt-1 grid grid-cols-2 gap-2">
                    {sensorKeys.map(({ label, icon: Icon, key, unit }) => {
                      const ev = sensor ? evaluateParam(key, sensor[key], chartThreshold) : null;
                      const style = ev ? STATUS_STYLE[ev.status] : STATUS_STYLE.unknown;
                      const outOfRange = ev && (ev.status === "low" || ev.status === "high");
                      const alertForParam = findAlertForScreenhouse(activeAlerts, sh.id, key);
                      const isAlertCell = Boolean(alertForParam);
                      const cellClass = isAlertCell
                        ? "cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-red-300/60 alert-attention-pulse"
                        : "";
                      const CellTag = isAlertCell ? "button" : "div";
                      return (
                        <CellTag
                          key={label}
                          type={isAlertCell ? "button" : undefined}
                          onClick={
                            isAlertCell
                              ? () =>
                                  goToAlert({
                                    alertId: alertForParam.id,
                                    screenhouseId: sh.id,
                                  })
                              : undefined
                          }
                          className={`bg-gray-50 rounded-xl p-3 flex items-center justify-between text-left w-full ${cellClass}`}
                        >
                          <div className="text-left min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] uppercase tracking-wide text-gray-400 truncate">
                                {label}
                              </span>
                              {outOfRange && (
                                <span
                                  className={`px-1 py-0 rounded-full text-[9px] font-semibold ${
                                    isAlertCell ? style.badge : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {style.label}
                                </span>
                              )}
                            </div>
                            <div
                              className="text-base font-semibold mt-1"
                              style={{
                                color: isAlertCell ? style.color : "#1f2937",
                              }}
                            >
                              {sensor?.[key] != null
                                ? `${sensor[key]}${unit ? ` ${unit}` : ""}`
                                : "—"}
                            </div>
                          </div>
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: isAlertCell
                                ? `${style.color}1a`
                                : "#f3f4f6",
                            }}
                          >
                            <Icon
                              size={15}
                              style={{ color: isAlertCell ? style.color : "#9ca3af" }}
                            />
                          </div>
                        </CellTag>
                      );
                    })}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PetaniDashboard;
