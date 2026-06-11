import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  Cpu,
  Droplets,
  MapPin,
  Menu,
  User,
  WifiOff,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Sidebar from "../layouts/Sidebar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import ParamHealthCards from "../components/ParamHealthCards";
import ActuatorControls from "../components/ActuatorControls";
import {
  evaluateParam,
  buildHealthList,
  buildWorstCaseHealth,
  STATUS_STYLE,
} from "../constants/paramHealth";
import { EMPTY_VALUE } from "../constants/sensorMetrics";

import { API_URL } from "../config/api";
import socket from "../lib/socket";
import {
  isNodeOnline,
  isScreenhouseMonitorOffline,
} from "../utils/nodeOnline";
import { getStatusMeta, timeAgo } from "../constants/screenhouseStatus";
import {
  SCREENHOUSE_CHART_GUIDE,
  CHART_LEGEND,
  ChartTooltip,
  ChartGuideToggle,
} from "../constants/chartGuide";

const PARAM_GROUPS = [
  {
    label: "Unsur hara tanah",
    params: [
      { key: "nitrogen", label: "Nitrogen", unit: "mg/kg" },
      { key: "phosphorus", label: "Phosphorus", unit: "mg/kg" },
      { key: "potassium", label: "Potassium", unit: "mg/kg" },
    ],
  },
  {
    label: "Kondisi tanah",
    params: [
      { key: "soil_temperature", label: "Suhu tanah", unit: "°C" },
      { key: "soil_moisture", label: "Kelembaban", unit: "%" },
      { key: "soil_ph", label: "pH Tanah", unit: "pH" },
    ],
  },
  {
    label: "Kondisi lingkungan",
    params: [
      { key: "air_temperature", label: "Suhu udara", unit: "°C" },
      { key: "air_humidity", label: "Kelembaban udara", unit: "%" },
      { key: "conductivity", label: "Konduktivitas", unit: "µS/cm" },
    ],
  },
];

function formatParamValue(value) {
  if (value === null || value === undefined) return EMPTY_VALUE;
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : String(value);
}

function NodeCard({ node, threshold }) {
  const d = node.latest_data;
  const online = isNodeOnline(node);
  const lastSeen = node.last_seen ?? d?.created_at;

  const nodeHealth = online ? buildHealthList(d, threshold) : [];
  const flaggedCount = nodeHealth.filter(
    (h) => h.status === "low" || h.status === "high"
  ).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden text-left">
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-2">
        <div className="text-left min-w-0">
          <div className="text-sm font-semibold text-gray-800">
            {node.node_name}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {node.node_code} · {node.location || "Tidak ada lokasi"}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {online ? (
            <span className="px-2 py-0.5 rounded-full bg-bl-surface-muted text-bl-primary text-xs font-medium">
              Online
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-medium">
              Offline
            </span>
          )}
          {online &&
            (flaggedCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-medium">
                {flaggedCount} perlu perhatian
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-bl-surface-muted text-bl-primary text-[10px] font-medium">
                Semua pas
              </span>
            ))}
        </div>
      </div>

      {!online ? (
        <div className="flex flex-col items-start px-4 py-10 text-gray-400 text-left">
          <WifiOff size={28} className="mb-2 text-gray-300" />
          <div className="text-sm">Node tidak merespons</div>
          {lastSeen && (
            <div className="text-xs mt-1 text-gray-300">
              Terakhir terlihat {timeAgo(lastSeen)}
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 space-y-3 text-left">
          <details className="group rounded-xl border border-gray-100 overflow-hidden">
            <summary className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer list-none text-xs font-medium text-gray-600 hover:bg-gray-50">
              <span className="flex items-center gap-2">
                Data sensor mentah
                {flaggedCount > 0 && (
                  <span className="px-1.5 py-0 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold">
                    {flaggedCount}
                  </span>
                )}
              </span>
              <ChevronDown
                size={14}
                className="text-gray-400 transition-transform group-open:rotate-180"
              />
            </summary>

            <div className="px-3 pb-3 pt-1 space-y-3">
              {PARAM_GROUPS.map((group) => (
                <div key={group.label} className="text-left">
                  <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
                    {group.label}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {group.params.map(({ key, label, unit }) => {
                      const ev = evaluateParam(key, d[key], threshold);
                      const flagged = ev.status === "low" || ev.status === "high";
                      const style = STATUS_STYLE[ev.status];
                      return (
                        <div key={key} className="bg-gray-50 rounded-xl p-2.5 text-left">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] uppercase tracking-wide text-gray-400 truncate">
                              {label}
                            </span>
                            {flagged && (
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: style.color }}
                              />
                            )}
                          </div>
                          <div
                            className="text-sm font-semibold mt-1 leading-tight"
                            style={{ color: flagged ? style.color : "#1f2937" }}
                          >
                            {formatParamValue(d[key])}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {flagged ? style.label : unit}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
                  Cahaya
                </div>
                <div className="bg-gray-50 rounded-xl p-2.5 text-left">
                  <div className="text-[10px] uppercase tracking-wide text-gray-400">
                    Intensitas cahaya
                  </div>
                  <div className="text-sm font-semibold text-gray-800 mt-1">
                    {d.light_intensity != null ? Number(d.light_intensity).toFixed(0) : EMPTY_VALUE}
                  </div>
                  <div className="text-[10px] text-gray-400">lux</div>
                </div>
              </div>
            </div>
          </details>
        </div>
      )}

      <div className="px-4 py-2 border-t border-gray-100 flex justify-start text-left">
        <div className="flex items-center gap-1 text-xs text-gray-400 text-left">
          <Clock size={11} />
          {d?.created_at
            ? `Update ${new Date(d.created_at).toLocaleTimeString("id-ID")}`
            : "Tidak ada data"}
        </div>
      </div>
    </div>
  );
}

function ScreenhouseDetailPage({ basePath = "/operator" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isPetani = basePath === "/petani";
  const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
  const [showDetail, setShowDetail] = useState(false);
  const [screenhouse, setScreenhouse] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screenhouses, setScreenhouses] = useState([]);
  const [onlineTick, setOnlineTick] = useState(0);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const listUrl =
      user.role === "petani"
        ? `${API_URL}/screenhouses/my-screenhouses`
        : `${API_URL}/screenhouses`;

    fetch(listUrl, { headers })
      .then((res) => res.json())
      .then((data) => setScreenhouses(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [user.role]);

  const loadScreenhouseData = useCallback(() => {
    if (!id || !token) return Promise.resolve();

    return Promise.all([
      fetch(`${API_URL}/screenhouses/${id}`, { headers }).then((r) => r.json()),
      fetch(`${API_URL}/sensor-data/screenhouse/${id}/sensor-nodes`, { headers }).then(
        (r) => r.json()
      ),
      fetch(`${API_URL}/sensor-data/screenhouse/${id}/dashboard`, { headers }).then(
        (r) => r.json()
      ),
      fetch(`${API_URL}/sensor-data/screenhouse/${id}/history?hours=24`, {
        headers,
      }).then((r) => r.json()),
    ])
      .then(([sh, nodesData, dash, hist]) => {
        if (sh.message && !sh.id) {
          setScreenhouse(null);
        } else {
          setScreenhouse(sh);
        }
        setNodes(Array.isArray(nodesData) ? nodesData : []);
        setDashboard(dash);
        setHistory(Array.isArray(hist) ? hist : []);
      })
      .catch(console.error);
  }, [id, token]);

  useEffect(() => {
    if (!id || !token) return;

    setLoading(true);
    loadScreenhouseData().finally(() => setLoading(false));
  }, [id, token, loadScreenhouseData]);

  useEffect(() => {
    if (!id || !token) return;
    const intervalId = setInterval(() => {
      loadScreenhouseData();
    }, 30000);
    return () => clearInterval(intervalId);
  }, [id, token, loadScreenhouseData]);

  useEffect(() => {
    const tickId = setInterval(() => setOnlineTick((n) => n + 1), 60000);
    return () => clearInterval(tickId);
  }, []);

  const patchSinkActuators = (update) => {
    if (!update?.screenhouse_id) return;
    setDashboard((prev) => {
      if (!prev?.sinkNode) return prev;
      return {
        ...prev,
        sinkNode: {
          ...prev.sinkNode,
          fan_status: update.fan_status,
          irrigation_status: update.irrigation_status,
          lamp_status: update.lamp_status,
          updated_at: update.created_at ?? prev.sinkNode.updated_at,
        },
      };
    });
  };

  useEffect(() => {
    const handler = (update) => {
      if (String(update.screenhouse_id) !== String(id)) return;
      patchSinkActuators(update);
      setNodes((prev) =>
        prev.map((node) => {
          if (node.node_code !== update.node_code) return node;
          return {
            ...node,
            last_seen: update.created_at ?? node.last_seen,
            latest_data: {
              nitrogen: update.nitrogen,
              phosphorus: update.phosphorus,
              potassium: update.potassium,
              soil_temperature: update.soil_temperature,
              soil_moisture: update.soil_moisture,
              soil_ph: update.soil_ph,
              conductivity: update.conductivity,
              air_temperature: update.air_temperature,
              air_humidity: update.air_humidity,
              light_intensity: update.light_intensity,
              created_at: update.created_at,
            },
          };
        })
      );
      setDashboard((prev) => {
        if (!prev) return prev;
        const latest = prev.latest ?? {};
        const isNewer =
          !latest.created_at ||
          !update.created_at ||
          new Date(update.created_at) >= new Date(latest.created_at);
        return {
          ...prev,
          latest: isNewer
            ? {
                ...latest,
                nitrogen: update.nitrogen,
                phosphorus: update.phosphorus,
                potassium: update.potassium,
                soil_temperature: update.soil_temperature,
                soil_moisture: update.soil_moisture,
                soil_ph: update.soil_ph,
                conductivity: update.conductivity,
                air_temperature: update.air_temperature,
                air_humidity: update.air_humidity,
                light_intensity: update.light_intensity,
                created_at: update.created_at,
              }
            : latest,
        };
      });
    };
    socket.on("actuator-update", handler);
    socket.on("sensor-update", handler);
    return () => {
      socket.off("actuator-update", handler);
      socket.off("sensor-update", handler);
    };
  }, [id]);

  const trendChartData = useMemo(() => {
    if (dashboard?.hourlyTrend?.length) {
      return dashboard.hourlyTrend.map((row) => ({
        label: new Date(row.bucket).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        nitrogen: row.avg_nitrogen,
        soil_moisture: row.avg_soil_moisture,
        phosphorus: row.avg_phosphorus,
        potassium: row.avg_potassium,
      }));
    }

    const buckets = {};
    history.forEach((row) => {
      const key = new Date(row.created_at).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      if (!buckets[key]) {
        buckets[key] = {
          label: key,
          nitrogen: [],
          soil_moisture: [],
          phosphorus: [],
          potassium: [],
        };
      }
      buckets[key].nitrogen.push(row.nitrogen);
      buckets[key].soil_moisture.push(row.soil_moisture);
      buckets[key].phosphorus.push(row.phosphorus);
      buckets[key].potassium.push(row.potassium);
    });

    return Object.values(buckets).map((b) => ({
      label: b.label,
      nitrogen: Math.round(
        b.nitrogen.reduce((a, c) => a + c, 0) / b.nitrogen.length
      ),
      soil_moisture:
        Math.round(
          (b.soil_moisture.reduce((a, c) => a + Number(c), 0) /
            b.soil_moisture.length) *
            10
        ) / 10,
      phosphorus: Math.round(
        b.phosphorus.reduce((a, c) => a + c, 0) / b.phosphorus.length
      ),
      potassium: Math.round(
        b.potassium.reduce((a, c) => a + c, 0) / b.potassium.length
      ),
    }));
  }, [dashboard, history]);

  const npkCompareData = useMemo(() => {
    const latest = dashboard?.latest;
    const threshold = dashboard?.threshold;
    if (!latest) return [];

    const barColor = (value, min, max) => {
      if (value == null || min == null || max == null) return "#94a3b8";
      if (Number(value) < Number(min)) return "#d97706";
      if (Number(value) > Number(max)) return "#dc2626";
      return "#16a34a";
    };

    return [
      { name: "N", key: "nitrogen", value: latest.nitrogen ?? 0, min: threshold?.min_nitrogen, max: threshold?.max_nitrogen },
      { name: "P", key: "phosphorus", value: latest.phosphorus ?? 0, min: threshold?.min_phosphorus, max: threshold?.max_phosphorus },
      { name: "K", key: "potassium", value: latest.potassium ?? 0, min: threshold?.min_potassium, max: threshold?.max_potassium },
    ].map((d) => ({ ...d, fill: barColor(d.value, d.min, d.max) }));
  }, [dashboard]);

  const threshold = dashboard?.threshold;

  const onlineNodes = useMemo(
    () => nodes.filter((n) => isNodeOnline(n)),
    [nodes, onlineTick]
  );
  const onlineCount = onlineNodes.length;
  const screenhouseOffline = useMemo(
    () => isScreenhouseMonitorOffline(nodes),
    [nodes, onlineTick]
  );

  const latestLastSeen = useMemo(() => {
    const timestamps = nodes
      .map((n) => n.last_seen ?? n.latest_data?.created_at)
      .filter(Boolean)
      .map((d) => new Date(d).getTime())
      .filter((t) => !Number.isNaN(t));
    return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
  }, [nodes]);

  // Roll-up kondisi terburuk antar node yang online (1 node → langsung node itu).
  const rollupHealth = useMemo(
    () => buildWorstCaseHealth(onlineNodes, threshold),
    [onlineNodes, threshold]
  );

  const flaggedRollup = rollupHealth.filter(
    (h) => h.status === "low" || h.status === "high"
  );
  const rollupStatus = rollupHealth.length === 0
    ? "none"
    : flaggedRollup.some((h) => h.status === "high")
    ? "critical"
    : flaggedRollup.length > 0
    ? "warning"
    : "healthy";

  const monitorStatus = screenhouseOffline ? "offline" : rollupStatus;
  const monitorMeta = getStatusMeta(
    monitorStatus === "none" ? "offline" : monitorStatus
  );
  const activeNodeCount = nodes.filter((n) => n.is_active).length;

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-bl-surface text-left">
        <div className="text-sm text-gray-500 px-5">Memuat dashboard screenhouse...</div>
      </div>
    );
  }

  if (!screenhouse) {
    return (
      <div className="fixed inset-0 flex flex-col items-start justify-center bg-bl-surface gap-3 px-5 text-left">
        <p className="text-gray-600">Screenhouse tidak ditemukan</p>
        <button
          onClick={() => navigate(basePath)}
          className="text-sm text-bl-primary font-medium hover:underline text-left"
        >
          Kembali ke dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell fixed inset-0 flex bg-bl-surface overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        screenhouses={screenhouses}
        role={user.role}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 text-left">
        <header className="app-topbar h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between z-10 text-left">
          <div className="flex items-center gap-3 min-w-0 text-left">
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition shrink-0"
              aria-label="Toggle sidebar"
            >
              <Menu size={20} className="text-gray-500" />
            </button>
            <button
              onClick={() => navigate(basePath)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition shrink-0"
              aria-label="Kembali"
            >
              <ArrowLeft size={20} className="text-gray-500" />
            </button>
            <div className="min-w-0 text-left">
              <div className="text-sm font-semibold text-gray-800 truncate">
                {screenhouse.name}
              </div>
              <div className="text-xs text-gray-400 truncate">
                Detail sensor realtime
              </div>
            </div>
          </div>
          <span
            className={`text-xs font-medium px-3 py-1.5 rounded-full shrink-0 ${monitorMeta.badgeClass}`}
          >
            {monitorMeta.label}
          </span>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-left">
          {/* Info bar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 text-left">
            <div className="text-left min-w-0">
              <div className="text-base sm:text-lg font-semibold text-gray-800">
                {screenhouse.name}
              </div>
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                {screenhouse.owner_name && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User size={16} />
                    {screenhouse.owner_name}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin size={16} />
                  {[screenhouse.village, screenhouse.district]
                    .filter(Boolean)
                    .join(", ")}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Cpu size={16} />
                  {nodes.length} tray sensor
                </div>
              </div>
              {dashboard?.insight && (
                <p className="text-sm text-bl-primary mt-2 font-semibold text-left leading-relaxed">
                  {dashboard.insight}
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap justify-start">
              <span className="px-3 py-1.5 rounded-full bg-bl-surface-muted text-bl-primary text-sm font-semibold">
                {screenhouse.status === "active" ? "Aktif" : screenhouse.status}
              </span>
              <span
                className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                  monitorStatus === "offline"
                    ? "bg-slate-100 text-slate-600"
                    : onlineCount < activeNodeCount
                    ? "bg-amber-50 text-amber-800"
                    : "bg-blue-50 text-blue-800"
                }`}
              >
                {onlineCount}/{nodes.length} tray online
              </span>
              <span
                className={`px-3 py-1.5 rounded-full text-sm font-semibold ${monitorMeta.badgeClass}`}
              >
                {monitorMeta.label}
              </span>
            </div>
          </div>

          {/* Banner offline — seluruh screenhouse tidak ada node online */}
          {screenhouseOffline && (
            <div className="rounded-2xl px-5 py-5 flex items-center gap-4 bg-bl-surface-muted border border-bl-accent/20">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-slate-200">
                <WifiOff size={24} className="text-slate-500" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold text-slate-700">Offline</div>
                <div className="text-base text-slate-600 mt-1 leading-relaxed">
                  {latestLastSeen
                    ? `Perangkat tidak mengirim data terbaru · terakhir ${timeAgo(latestLastSeen)}`
                    : "Belum ada data sensor dari perangkat."}
                </div>
              </div>
            </div>
          )}

          {/* Banner status besar — fokus petani */}
          {isPetani && !screenhouseOffline && rollupStatus !== "none" && (
            <div
              className={`rounded-2xl px-5 py-5 flex items-center gap-4 border ${
                rollupStatus === "healthy"
                  ? "border-bl-primary/45 bg-[#e3f2ea]"
                  : rollupStatus === "warning"
                  ? "border-amber-300 bg-amber-50"
                  : "border-red-300 bg-red-50"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0 ${
                  rollupStatus === "healthy"
                    ? "bg-white/70 text-bl-primary"
                    : rollupStatus === "warning"
                    ? "bg-amber-100"
                    : "bg-red-100"
                }`}
              >
                {rollupStatus === "healthy" ? "✓" : "!"}
              </div>
              <div className="min-w-0">
                <div
                  className={`text-lg font-bold ${
                    rollupStatus === "healthy"
                      ? "text-bl-dark"
                      : rollupStatus === "warning"
                      ? "text-amber-950"
                      : "text-red-950"
                  }`}
                >
                  {rollupStatus === "healthy"
                    ? "Screenhouse Anda sehat"
                    : `${flaggedRollup.length} hal perlu perhatian`}
                </div>
                <div
                  className={`text-base mt-1 leading-relaxed ${
                    rollupStatus === "healthy"
                      ? "text-gray-600"
                      : rollupStatus === "warning"
                      ? "text-amber-800"
                      : "text-red-800"
                  }`}
                >
                  {rollupStatus === "healthy"
                    ? "Semua ukuran tanah masih pas. Tidak perlu tindakan."
                    : flaggedRollup[0]?.advice
                    ? `Mulai dari: ${flaggedRollup[0].advice}`
                    : "Lihat saran tindakan di bawah."}
                </div>
              </div>
            </div>
          )}

          {/* Petani: tren & data detail disembunyikan, fokus ke status + tindakan */}
          {isPetani && (
            <button
              type="button"
              onClick={() => setShowDetail((v) => !v)}
              className="w-full flex items-center justify-between gap-2 bg-white rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <span>
                {showDetail
                  ? "Sembunyikan tren & data detail"
                  : "Lihat tren & data detail (opsional)"}
              </span>
              <ChevronDown
                size={16}
                className={`text-gray-400 transition-transform ${showDetail ? "rotate-180" : ""}`}
              />
            </button>
          )}

          {(!isPetani || showDetail) && (
            <>
          {/* Grafik */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
              <div className="text-sm font-semibold text-gray-800 mb-1 text-left">
                Tren nitrogen & kelembapan tanah (24 jam)
              </div>
              <div className="text-xs text-gray-400 mb-4 text-left">
                Rata-rata per jam · kiri: nitrogen · kanan: kelembapan tanah
              </div>
              {trendChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis
                      yAxisId="n"
                      tick={{ fontSize: 10 }}
                      domain={["auto", "auto"]}
                      label={{ value: "N", angle: -90, position: "insideLeft", fontSize: 10 }}
                    />
                    <YAxis
                      yAxisId="m"
                      orientation="right"
                      tick={{ fontSize: 10 }}
                      domain={[40, 90]}
                      label={{ value: "%", angle: 90, position: "insideRight", fontSize: 10 }}
                    />
                    {threshold?.min_nitrogen != null && threshold?.max_nitrogen != null && (
                      <ReferenceArea
                        yAxisId="n"
                        y1={threshold.min_nitrogen}
                        y2={threshold.max_nitrogen}
                        fill="#16a34a"
                        fillOpacity={0.07}
                        label={{ value: "Batas aman N", fontSize: 9, fill: "#15803d", position: "insideTopLeft" }}
                      />
                    )}
                    {threshold?.min_soil_moisture != null && threshold?.max_soil_moisture != null && (
                      <ReferenceArea
                        yAxisId="m"
                        y1={threshold.min_soil_moisture}
                        y2={threshold.max_soil_moisture}
                        fill="#2563eb"
                        fillOpacity={0.06}
                      />
                    )}
                    <Tooltip content={<ChartTooltip />} />
                    <Legend {...CHART_LEGEND} />
                    <Line
                      yAxisId="n"
                      type="monotone"
                      dataKey="nitrogen"
                      name="Nitrogen (mg/kg)"
                      stroke="#16a34a"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      yAxisId="m"
                      type="monotone"
                      dataKey="soil_moisture"
                      name="Kelembapan tanah (%)"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-start justify-start p-4 text-sm text-gray-400 text-left">
                  Belum ada data historis. Jalankan seed_sensor_history.sql
                </div>
              )}
              <ChartGuideToggle
                body={SCREENHOUSE_CHART_GUIDE[1].body}
                extra="Arahkan kursor ke garis untuk melihat angka pada jam tertentu."
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
              <div className="text-sm font-semibold text-gray-800 mb-1 text-left">
                Komposisi NPK terbaru
              </div>
              <div className="text-xs text-gray-400 mb-4 text-left">
                Nilai terbaru · hijau = pas, oranye = kurang, merah = berlebih
              </div>
              {npkCompareData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={npkCompareData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" />
                    <YAxis tick={{ fontSize: 10 }} label={{ value: "mg/kg", angle: -90, position: "insideLeft", fontSize: 10 }} />
                    <Tooltip
                      formatter={(value, name, props) => [
                        `${value} mg/kg`,
                        props.payload.min != null
                          ? `batas aman ${props.payload.min}–${props.payload.max}`
                          : "",
                      ]}
                    />
                    <Bar dataKey="value" name="Nilai" radius={[6, 6, 0, 0]}>
                      {npkCompareData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-start justify-start p-4 text-sm text-gray-400 text-left">
                  Belum ada pembacaan NPK
                </div>
              )}
              <ChartGuideToggle
                body={SCREENHOUSE_CHART_GUIDE[2].body}
                extra="Arahkan kursor ke batang untuk melihat nilai pasti."
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
            <div className="text-sm font-semibold text-gray-800 mb-1 text-left">
              Tren phosphorus & potassium (24 jam)
            </div>
            <div className="text-xs text-gray-400 mb-4 text-left">
              Perubahan fosfor dan kalium per jam. Cek kebutuhan pupuk.
            </div>
            {trendChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} label={{ value: "mg/kg", angle: -90, position: "insideLeft", fontSize: 10 }} />
                  {threshold?.min_phosphorus != null && threshold?.max_phosphorus != null && (
                    <ReferenceArea
                      y1={threshold.min_phosphorus}
                      y2={threshold.max_phosphorus}
                      fill="#2563eb"
                      fillOpacity={0.05}
                    />
                  )}
                  {threshold?.min_potassium != null && threshold?.max_potassium != null && (
                    <ReferenceArea
                      y1={threshold.min_potassium}
                      y2={threshold.max_potassium}
                      fill="#ca8a04"
                      fillOpacity={0.05}
                    />
                  )}
                  <Tooltip content={<ChartTooltip />} />
                  <Legend {...CHART_LEGEND} />
                  <Line
                    type="monotone"
                    dataKey="phosphorus"
                    name="Phosphorus"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="potassium"
                    name="Potassium"
                    stroke="#ca8a04"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-start justify-start p-4 text-sm text-gray-400 text-left">
                Belum ada data historis
              </div>
            )}
            <ChartGuideToggle
              body={SCREENHOUSE_CHART_GUIDE[3].body}
              extra="Arahkan kursor ke garis untuk melihat angka pada jam tertentu."
            />
          </div>
            </>
          )}

          {/* Ringkasan kondisi screenhouse — kondisi terburuk antar node + saran tindakan */}
          {rollupHealth.length > 0 && (
            <ParamHealthCards
              list={rollupHealth}
              threshold={threshold}
              title="Ringkasan kondisi screenhouse"
              subtitle={
                onlineCount > 1
                  ? "Ambil kondisi paling buruk dari semua tray · detail per tray ada di bawah"
                  : "Hijau = pas · oranye = kurang · merah = berlebih"
              }
            />
          )}

          {/* Grid sensor nodes */}
          {dashboard?.sinkNode && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
              <div className="text-sm font-semibold text-gray-800 mb-1">
                Kontrol aktuator
              </div>
              <div className="text-xs text-gray-400 mb-3">
                Sink node · {dashboard.sinkNode.node_code} · {dashboard.sinkNode.relay_channels} channel relay
              </div>
              <ActuatorControls
                screenhouseId={Number(id)}
                fan_status={dashboard.sinkNode.fan_status}
                irrigation_status={dashboard.sinkNode.irrigation_status}
                lamp_status={dashboard.sinkNode.lamp_status}
                disabled={!dashboard.sinkNode.is_active}
                readOnly={!isPetani}
                onUpdated={patchSinkActuators}
              />
            </div>
          )}

          <div className="text-sm font-semibold text-gray-700 text-left">Tray sensor</div>

          {nodes.length === 0 ? (
            <div className="text-sm text-gray-400 text-left py-8 px-4 bg-white rounded-2xl border border-gray-200">
              Belum ada tray sensor terdaftar
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {nodes.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  threshold={threshold}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScreenhouseDetailPage;
