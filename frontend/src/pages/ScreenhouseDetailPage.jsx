import { useEffect, useMemo, useState } from "react";
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

import { API_URL } from "../config/api";
import socket from "../lib/socket";

const CHART_GUIDE = [
  {
    title: "Kartu kondisi terkini",
    body: "Baca ini dulu. Tiap parameter diberi label Ideal/Kurang/Berlebih. Titik pada bar menunjukkan posisi nilai sekarang terhadap zona hijau (rentang ideal). Saran tindakan muncul otomatis bila ada yang menyimpang.",
  },
  {
    title: "Garis nitrogen & kelembapan (24 jam)",
    body: "Sumbu kiri (hijau) = nitrogen. Sumbu kanan (biru) = kelembapan tanah (%). Area berwarna samar = zona ideal — selama garis berada di dalam area, kondisi aman.",
  },
  {
    title: "Batang NPK",
    body: "Kondisi terbaru. Warna batang = verdict: hijau ideal, oranye kurang, merah berlebih. Arahkan kursor untuk melihat rentang ideal.",
  },
  {
    title: "Garis phosphorus & potassium",
    body: "Tren rata-rata per jam. Dua area samar = zona ideal P (biru) dan K (kuning). Garis di dalam area = aman.",
  },
];

const CHART_LEGEND = {
  align: "left",
  verticalAlign: "bottom",
  wrapperStyle: { paddingLeft: 0, textAlign: "left" },
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs text-left">
      <div className="font-medium text-gray-700 mb-1">Jam {label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }} className="text-left">
          <span className="font-semibold">{p.value}</span>
          <span className="text-gray-500"> — {p.name}</span>
        </div>
      ))}
    </div>
  );
}

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
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : String(value);
}

function NodeCard({ node, threshold, screenhouseId, onActuatorUpdated, canControlActuators }) {
  const d = node.latest_data;
  const online = node.is_active && d;

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
            {node.node_code} · {node.location || "—"}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {online ? (
            <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
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
              <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-medium">
                Semua ideal
              </span>
            ))}
        </div>
      </div>

      {!online ? (
        <div className="flex flex-col items-start px-4 py-10 text-gray-400 text-left">
          <WifiOff size={28} className="mb-2 text-gray-300" />
          <div className="text-sm">Node tidak merespons</div>
          {node.last_seen && (
            <div className="text-xs mt-1 text-gray-300">
              Terakhir terlihat{" "}
              {new Date(node.last_seen).toLocaleString("id-ID")}
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 space-y-3 text-left">
          <ActuatorControls
            screenhouseId={screenhouseId}
            sensorNodeId={node.id}
            fan_status={d.fan_status}
            irrigation_status={d.irrigation_status}
            lamp_status={d.lamp_status}
            disabled={!online}
            readOnly={!canControlActuators}
            onUpdated={onActuatorUpdated}
          />

          {/* Data mentah sensor — disembunyikan, bisa di-expand */}
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
                    {d.light_intensity != null ? Number(d.light_intensity).toFixed(0) : "—"}
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

  useEffect(() => {
    if (!id || !token) return;

    setLoading(true);

    Promise.all([
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
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, token]);

  const patchNodeActuators = (update) => {
    if (!update?.sensor_node_id) return;
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== update.sensor_node_id || !node.latest_data) return node;
        return {
          ...node,
          latest_data: {
            ...node.latest_data,
            fan_status: update.fan_status,
            irrigation_status: update.irrigation_status,
            lamp_status: update.lamp_status,
            created_at: update.created_at ?? node.latest_data.created_at,
          },
        };
      })
    );
  };

  useEffect(() => {
    const handler = (update) => {
      if (String(update.screenhouse_id) !== String(id)) return;
      patchNodeActuators(update);
    };
    socket.on("actuator-update", handler);
    return () => socket.off("actuator-update", handler);
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

    // Warnai batang sesuai verdict: hijau ideal, oranye kurang, merah berlebih.
    const verdictFill = (value, min, max) => {
      if (value == null || min == null || max == null) return "#94a3b8";
      if (Number(value) < Number(min)) return "#d97706";
      if (Number(value) > Number(max)) return "#dc2626";
      return "#16a34a";
    };

    return [
      { name: "N", key: "nitrogen", value: latest.nitrogen ?? 0, min: threshold?.min_nitrogen, max: threshold?.max_nitrogen },
      { name: "P", key: "phosphorus", value: latest.phosphorus ?? 0, min: threshold?.min_phosphorus, max: threshold?.max_phosphorus },
      { name: "K", key: "potassium", value: latest.potassium ?? 0, min: threshold?.min_potassium, max: threshold?.max_potassium },
    ].map((d) => ({ ...d, fill: verdictFill(d.value, d.min, d.max) }));
  }, [dashboard]);

  const threshold = dashboard?.threshold;
  const onlineCount = nodes.filter((n) => n.is_active && n.latest_data).length;

  // Roll-up kondisi terburuk antar node yang online (1 node → langsung node itu).
  const rollupHealth = useMemo(
    () =>
      buildWorstCaseHealth(
        nodes.filter((n) => n.is_active && n.latest_data),
        threshold
      ),
    [nodes, threshold]
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

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-100 text-left">
        <div className="text-sm text-gray-500 px-5">Memuat dashboard screenhouse...</div>
      </div>
    );
  }

  if (!screenhouse) {
    return (
      <div className="fixed inset-0 flex flex-col items-start justify-center bg-slate-100 gap-3 px-5 text-left">
        <p className="text-gray-600">Screenhouse tidak ditemukan</p>
        <button
          onClick={() => navigate(basePath)}
          className="text-sm text-emerald-700 font-medium hover:underline text-left"
        >
          Kembali ke dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell fixed inset-0 flex bg-slate-100 overflow-hidden">
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
          <span className="text-xs font-medium bg-green-50 text-green-700 px-3 py-1.5 rounded-full shrink-0">
            {screenhouse.status === "active" ? "Aktif" : screenhouse.status}
          </span>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-left">
          {/* Info bar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 text-left">
            <div className="text-left min-w-0">
              <div className="text-sm font-semibold text-gray-800">
                {screenhouse.name}
              </div>
              <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                {screenhouse.owner_name && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <User size={12} />
                    {screenhouse.owner_name}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <MapPin size={12} />
                  {[screenhouse.village, screenhouse.district]
                    .filter(Boolean)
                    .join(", ")}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Cpu size={12} />
                  {nodes.length} sensor node
                </div>
              </div>
              {dashboard?.insight && (
                <p className="text-xs text-emerald-700 mt-2 font-medium text-left">
                  {dashboard.insight}
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap justify-start">
              <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                {screenhouse.status === "active" ? "Aktif" : screenhouse.status}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                {onlineCount}/{nodes.length} node online
              </span>
            </div>
          </div>

          {/* Banner status besar — fokus petani */}
          {isPetani && rollupStatus !== "none" && (
            <div
              className={`rounded-2xl px-5 py-4 flex items-center gap-4 ${
                rollupStatus === "healthy"
                  ? "bg-green-50 border border-green-100"
                  : rollupStatus === "warning"
                  ? "bg-amber-50 border border-amber-100"
                  : "bg-red-50 border border-red-100"
              }`}
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center text-2xl shrink-0 ${
                  rollupStatus === "healthy"
                    ? "bg-green-100"
                    : rollupStatus === "warning"
                    ? "bg-amber-100"
                    : "bg-red-100"
                }`}
              >
                {rollupStatus === "healthy" ? "✓" : "!"}
              </div>
              <div className="min-w-0">
                <div
                  className={`text-base font-bold ${
                    rollupStatus === "healthy"
                      ? "text-green-800"
                      : rollupStatus === "warning"
                      ? "text-amber-800"
                      : "text-red-800"
                  }`}
                >
                  {rollupStatus === "healthy"
                    ? "Screenhouse Anda sehat"
                    : `${flaggedRollup.length} hal perlu perhatian`}
                </div>
                <div className="text-sm text-gray-600 mt-0.5">
                  {rollupStatus === "healthy"
                    ? "Semua parameter dalam batas ideal. Tidak ada tindakan yang diperlukan."
                    : flaggedRollup[0]?.advice
                    ? `Mulai dari: ${flaggedRollup[0].advice}`
                    : "Lihat saran tindakan di bawah."}
                </div>
              </div>
            </div>
          )}

          {/* Ringkasan kondisi screenhouse — kondisi terburuk antar node + saran tindakan */}
          {rollupHealth.length > 0 && (
            <ParamHealthCards
              list={rollupHealth}
              threshold={threshold}
              title="Ringkasan kondisi screenhouse"
              subtitle={
                nodes.filter((n) => n.is_active && n.latest_data).length > 1
                  ? "Kondisi terburuk antar node · detail per node ada di bawah"
                  : "Hijau = ideal · oranye = kurang · merah = berlebih"
              }
            />
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
          {/* Panduan baca grafik */}
          <details className="bg-blue-50/80 border border-blue-100 rounded-2xl px-4 py-3 group text-left">
            <summary className="text-sm font-medium text-blue-900 cursor-pointer list-none flex items-center justify-between gap-2 text-left">
              <span className="text-left">Cara membaca grafik di halaman ini</span>
              <span className="text-xs text-blue-600 group-open:hidden shrink-0">Klik untuk buka</span>
            </summary>
            <ul className="mt-3 space-y-2.5 text-xs text-blue-900/90 leading-relaxed text-left list-none pl-0">
              {CHART_GUIDE.map((item) => (
                <li key={item.title} className="text-left">
                  <span className="font-semibold">{item.title}:</span> {item.body}
                </li>
              ))}
              <li className="text-blue-700/80">
                Sumbu X = waktu (rata-rata per jam dari semua node). Arahkan kursor ke garis untuk nilai pasti.
              </li>
            </ul>
          </details>

          {/* Grafik */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
              <div className="text-sm font-semibold text-gray-800 mb-1 text-left">
                Tren nitrogen & kelembapan tanah (24 jam)
              </div>
              <div className="text-xs text-gray-400 mb-4 text-left">
                Rata-rata per jam · kiri: N (mg/kg) · kanan: kelembapan (%)
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
                        label={{ value: "Zona ideal N", fontSize: 9, fill: "#15803d", position: "insideTopLeft" }}
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
                  Belum ada data historis — jalankan seed_sensor_history.sql
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
              <div className="text-sm font-semibold text-gray-800 mb-1 text-left">
                Komposisi NPK terbaru
              </div>
              <div className="text-xs text-gray-400 mb-4 text-left">
                Pembacaan terakhir · warna batang: hijau ideal, oranye kurang, merah berlebih
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
                          ? `ideal ${props.payload.min}–${props.payload.max}`
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
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
            <div className="text-sm font-semibold text-gray-800 mb-1 text-left">
              Tren phosphorus & potassium (24 jam)
            </div>
            <div className="text-xs text-gray-400 mb-4 text-left">
              Kedua unsur ditampilkan sebagai garis — cek keseimbangan pupuk
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
          </div>
            </>
          )}

          {/* Grid sensor nodes */}
          <div className="text-sm font-semibold text-gray-700 text-left">Sensor nodes</div>

          {nodes.length === 0 ? (
            <div className="text-sm text-gray-400 text-left py-8 px-4 bg-white rounded-2xl border border-gray-200">
              Belum ada sensor node terdaftar
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {nodes.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  threshold={threshold}
                  screenhouseId={Number(id)}
                  onActuatorUpdated={patchNodeActuators}
                  canControlActuators={isPetani}
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
