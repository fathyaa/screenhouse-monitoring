import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Cpu,
  Droplets,
  Lightbulb,
  MapPin,
  Menu,
  User,
  Wind,
  WifiOff,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Sidebar from "../layouts/Sidebar";

import { API_URL } from "../config/api";

const CHART_GUIDE = [
  {
    title: "Garis nitrogen & kelembapan (24 jam)",
    body: "Sumbu kiri (hijau) = nitrogen (mg/kg). Sumbu kanan (biru) = kelembapan tanah (%). Garis putus-putus = batas minimum dari threshold. Jika biru turun di bawah garis kuning → tanah mulai kering; hijau turun → pertimbangkan pupuk N.",
  },
  {
    title: "Batang NPK",
    body: "Snapshot kondisi terbaru dari seluruh node (bukan tren waktu). Bandingkan tinggi batang N, P, K — idealnya seimbang, tidak ada yang jauh lebih rendah.",
  },
  {
    title: "Garis phosphorus & potassium",
    body: "Tren rata-rata per jam. Naik-turun halus = normal. P dan K saling independen (dua garis), bukan ditumpuk.",
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

function StatusBadge({ value, label, icon: Icon }) {
  const isOn = value === true || value === 1 || value === "on";
  return (
    <div className="bg-gray-50 rounded-xl p-2.5 flex items-start justify-between text-left">
      <div className="text-left">
        <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">
          {label}
        </div>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            isOn ? "bg-green-50 text-green-800" : "bg-gray-100 text-gray-500"
          }`}
        >
          {isOn ? "Nyala" : "Mati"}
        </span>
      </div>
      <Icon size={18} className="text-gray-300" />
    </div>
  );
}

function NodeCard({ node }) {
  const d = node.latest_data;
  const online = node.is_active && d;

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
        {online ? (
          <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
            Online
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-medium">
            Offline
          </span>
        )}
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
          {PARAM_GROUPS.map((group) => (
            <div key={group.label} className="text-left">
              <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
                {group.label}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {group.params.map(({ key, label, unit }) => (
                  <div key={key} className="bg-gray-50 rounded-xl p-2.5 text-left">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">
                      {label}
                    </div>
                    <div className="text-sm font-semibold text-gray-800 mt-1 leading-tight">
                      {formatParamValue(d[key])}
                    </div>
                    <div className="text-[10px] text-gray-400">{unit}</div>
                  </div>
                ))}
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

          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
              Status device
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <StatusBadge value={d.fan_status} label="Fan" icon={Wind} />
              <StatusBadge
                value={d.irrigation_status}
                label="Irigasi"
                icon={Droplets}
              />
              <StatusBadge value={d.lamp_status} label="Lampu" icon={Lightbulb} />
            </div>
          </div>
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

    return [
      {
        name: "N",
        value: latest.nitrogen ?? 0,
        fill: "#16a34a",
        min: threshold?.min_nitrogen,
      },
      {
        name: "P",
        value: latest.phosphorus ?? 0,
        fill: "#2563eb",
        min: threshold?.min_phosphorus,
      },
      {
        name: "K",
        value: latest.potassium ?? 0,
        fill: "#ca8a04",
        min: threshold?.min_potassium,
      },
    ];
  }, [dashboard]);

  const threshold = dashboard?.threshold;
  const onlineCount = nodes.filter((n) => n.is_active && n.latest_data).length;

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
    <div className="fixed inset-0 flex bg-slate-100 overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        screenhouses={screenhouses}
        role={user.role}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 text-left">
        <header className="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-5 z-10 text-left">
          <div className="flex items-center gap-3 min-w-0 text-left">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
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
                    <Tooltip content={<ChartTooltip />} />
                    <Legend {...CHART_LEGEND} />
                    {threshold?.min_nitrogen != null && (
                      <ReferenceLine
                        yAxisId="n"
                        y={threshold.min_nitrogen}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        label={{ value: "Min N", fontSize: 10, fill: "#b45309" }}
                      />
                    )}
                    {threshold?.min_soil_moisture != null && (
                      <ReferenceLine
                        yAxisId="m"
                        y={threshold.min_soil_moisture}
                        stroke="#0ea5e9"
                        strokeDasharray="4 4"
                        label={{ value: "Min air", fontSize: 10, fill: "#0369a1" }}
                      />
                    )}
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
                Pembacaan terakhir screenhouse · bandingkan tinggi batang
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
                        props.payload.min != null ? `(min: ${props.payload.min})` : "",
                      ]}
                    />
                    {npkCompareData.map(
                      (entry) =>
                        entry.min != null && (
                          <ReferenceLine
                            key={`min-${entry.name}`}
                            y={entry.min}
                            stroke="#f59e0b"
                            strokeDasharray="3 3"
                          />
                        )
                    )}
                    <Bar dataKey="value" name="Nilai" radius={[6, 6, 0, 0]} />
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

          {/* Grid sensor nodes */}
          <div className="text-sm font-semibold text-gray-700 text-left">Sensor nodes</div>

          {nodes.length === 0 ? (
            <div className="text-sm text-gray-400 text-left py-8 px-4 bg-white rounded-2xl border border-gray-200">
              Belum ada sensor node terdaftar
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {nodes.map((node) => (
                <NodeCard key={node.id} node={node} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScreenhouseDetailPage;
