import { useEffect, useMemo, useState } from "react";
import { MapPin, Clock3 } from "lucide-react";
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
import { useAlerts } from "../context/AlertContext";
import PetaniTopbar from "../layouts/PetaniTopbar";
import { PRIMARY_SENSOR_FIELDS } from "../constants/sensorMetrics";
import {
  CHART_LEGEND,
  ChartTooltip,
  PETANI_CHART_GUIDE,
  aggregateHourlyTrend,
  buildNpkFromLatest,
} from "../constants/chartGuide";
import { Leaf, Radio, Bell, Droplets, Activity, Thermometer, Gauge } from "lucide-react";

import { API_URL } from "../config/api";

function PetaniDashboard() {
  const [screenhouses, setScreenhouses] = useState([]);
  const [latestSensorData, setLatestSensorData] = useState({});
  const [chartDashboards, setChartDashboards] = useState([]);
  const [chartHistories, setChartHistories] = useState([]);
  const [chartThreshold, setChartThreshold] = useState(null);
  const [chartInsight, setChartInsight] = useState("");
  const [chartsLoading, setChartsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dashboardStats, setDashboardStats] = useState({
    screenhouse_count: 0,
    active_nodes: 0,
    active_sensors: 0,
    active_alerts: 0,
  });

  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  const { activeCount } = useAlerts();
  const headers = { Authorization: `Bearer ${token}` };

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
    if (!screenhouses.length || !token) {
      setChartDashboards([]);
      setChartHistories([]);
      setChartThreshold(null);
      setChartInsight("");
      return;
    }

    setChartsLoading(true);

    Promise.all(
      screenhouses.map((sh) =>
        Promise.all([
          fetch(`${API_URL}/sensor-data/screenhouse/${sh.id}/dashboard`, { headers }).then(
            (r) => r.json()
          ),
          fetch(`${API_URL}/sensor-data/screenhouse/${sh.id}/history?hours=24`, {
            headers,
          }).then((r) => r.json()),
        ]).then(([dashboard, history]) => ({
          screenhouseId: sh.id,
          screenhouseName: sh.name,
          dashboard,
          history: Array.isArray(history) ? history : [],
        }))
      )
    )
      .then((results) => {
        setChartDashboards(results.map((r) => r.dashboard));
        setChartHistories(results.map((r) => r.history));

        const firstThreshold = results.find((r) => r.dashboard?.threshold)?.dashboard
          ?.threshold;
        setChartThreshold(firstThreshold ?? null);

        const insights = results
          .map((r) => r.dashboard?.insight)
          .filter((t) => t && !t.includes("Belum ada"));
        const unique = [...new Set(insights)];
        if (unique.length === 0) {
          setChartInsight("Kondisi screenhouse dalam batas normal.");
        } else if (unique.length === 1) {
          setChartInsight(unique[0]);
        } else {
          setChartInsight(
            `${unique.length} screenhouse perlu perhatian: ${unique.slice(0, 2).join(" · ")}`
          );
        }
      })
      .catch(console.error)
      .finally(() => setChartsLoading(false));
  }, [screenhouses, token]);

  const trendChartData = useMemo(
    () => aggregateHourlyTrend(chartDashboards, chartHistories),
    [chartDashboards, chartHistories]
  );

  const npkCompareData = useMemo(
    () => buildNpkFromLatest(latestSensorData, chartThreshold),
    [latestSensorData, chartThreshold]
  );

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
      label: "Alert aktif",
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
    <div className="fixed inset-0 flex bg-slate-100 overflow-hidden text-left">
      <Sidebar isOpen={sidebarOpen} screenhouses={screenhouses} role={user?.role} user={user} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 text-left">
        <PetaniTopbar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          title="Dashboard petani"
          subtitle={`Halo, ${user?.name} — pantau screenhouse kamu`}
          activeAlerts={activeCount}
        />

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-left">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left">
            <div className="text-left">
              <div className="text-base font-semibold text-gray-800">
                Selamat pagi, {user?.name} 👋
              </div>
              <div className="text-sm text-gray-400 mt-0.5 text-left">
                {activeCount > 0
                  ? `Ada ${activeCount} alert aktif yang perlu ditangani`
                  : "Semua screenhouse dalam kondisi normal"}
              </div>
            </div>
            <div
              className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-left ${
                activeCount > 0 ? "bg-red-50" : "bg-green-50"
              }`}
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
                  {activeCount > 0 ? `${activeCount} alert aktif` : "Semua device online"}
                </div>
                <div
                  className={`text-xs mt-0.5 ${
                    activeCount > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {activeCount > 0 ? "Periksa tab Notifikasi" : "Monitoring berjalan normal"}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                title={card.hint}
                className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 text-left"
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
              </div>
            ))}
          </div>

          {/* Insight grafik */}
          <div className="space-y-4 text-left">
            <div className="text-left">
              <div className="text-sm font-semibold text-gray-800">Insight kondisi tanah</div>
              <div className="text-xs text-gray-400 mt-0.5 text-left">
                Ringkasan 24 jam terakhir dari semua screenhouse kamu
              </div>
            </div>

            {chartInsight && !chartsLoading && (
              <div className="bg-emerald-700 text-white rounded-2xl px-4 py-3 text-left">
                <div className="text-[10px] uppercase tracking-widest text-emerald-200 font-medium">
                  Insight singkat
                </div>
                <p className="text-sm font-medium mt-1 text-left">{chartInsight}</p>
              </div>
            )}

            <details className="bg-blue-50/80 border border-blue-100 rounded-2xl px-4 py-3 group text-left">
              <summary className="text-sm font-medium text-blue-900 cursor-pointer list-none flex items-center justify-between gap-2 text-left">
                <span className="text-left">Cara membaca grafik insight</span>
                <span className="text-xs text-blue-600 group-open:hidden shrink-0">
                  Klik untuk buka
                </span>
              </summary>
              <ul className="mt-3 space-y-2.5 text-xs text-blue-900/90 leading-relaxed text-left list-none pl-0">
                {PETANI_CHART_GUIDE.map((item) => (
                  <li key={item.title} className="text-left">
                    <span className="font-semibold">{item.title}:</span> {item.body}
                  </li>
                ))}
                <li className="text-blue-700/80 text-left">
                  Arahkan kursor ke garis atau batang untuk melihat angka pasti pada jam tertentu.
                </li>
              </ul>
            </details>

            {chartsLoading ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl border border-gray-200 h-72 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
                    <div className="text-sm font-semibold text-gray-800 mb-1 text-left">
                      Tren nitrogen & kelembapan tanah (24 jam)
                    </div>
                    <div className="text-xs text-gray-400 mb-4 text-left">
                      Rata-rata semua screenhouse · kiri: N · kanan: kelembapan (%)
                    </div>
                    {trendChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={trendChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                          <YAxis
                            yAxisId="n"
                            tick={{ fontSize: 10 }}
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
                          {chartThreshold?.min_nitrogen != null && (
                            <ReferenceLine
                              yAxisId="n"
                              y={chartThreshold.min_nitrogen}
                              stroke="#f59e0b"
                              strokeDasharray="4 4"
                            />
                          )}
                          {chartThreshold?.min_soil_moisture != null && (
                            <ReferenceLine
                              yAxisId="m"
                              y={chartThreshold.min_soil_moisture}
                              stroke="#0ea5e9"
                              strokeDasharray="4 4"
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
                          />
                          <Line
                            yAxisId="m"
                            type="monotone"
                            dataKey="soil_moisture"
                            name="Kelembapan tanah (%)"
                            stroke="#2563eb"
                            strokeWidth={2}
                            dot={{ r: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[260px] flex items-start justify-start p-4 text-sm text-gray-400 text-left">
                        Belum cukup data historis untuk grafik tren
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
                    <div className="text-sm font-semibold text-gray-800 mb-1 text-left">
                      Rata-rata NPK screenhouse kamu
                    </div>
                    <div className="text-xs text-gray-400 mb-4 text-left">
                      Pembacaan terbaru per screenhouse — bandingkan keseimbangan N, P, K
                    </div>
                    {npkCompareData.length > 0 && npkCompareData.some((d) => d.value > 0) ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={npkCompareData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="name" />
                          <YAxis
                            tick={{ fontSize: 10 }}
                            label={{
                              value: "mg/kg",
                              angle: -90,
                              position: "insideLeft",
                              fontSize: 10,
                            }}
                          />
                          <Tooltip />
                          <Bar dataKey="value" name="Rata-rata" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[260px] flex items-start justify-start p-4 text-sm text-gray-400 text-left">
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
                    Rata-rata semua node — pantau kebutuhan pupuk P dan K
                  </div>
                  {trendChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={trendChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          label={{
                            value: "mg/kg",
                            angle: -90,
                            position: "insideLeft",
                            fontSize: 10,
                          }}
                        />
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
                    <div className="h-[220px] flex items-start justify-start p-4 text-sm text-gray-400 text-left">
                      Belum ada data historis
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="text-left">
            <div className="text-sm font-semibold text-gray-800">Screenhouse saya</div>
            <div className="text-xs text-gray-400 mt-0.5 mb-3 text-left">
              Monitoring realtime seluruh screenhouse
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {screenhouses.map((sh) => {
              const sensor = latestSensorData[sh.id];
              return (
                <div
                  key={sh.id}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden text-left"
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
                    <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium shrink-0">
                      Online
                    </span>
                  </div>

                  <div className="p-3 grid grid-cols-2 gap-2">
                    {sensorKeys.map(({ label, icon: Icon, key, unit }) => (
                      <div
                        key={label}
                        className="bg-gray-50 rounded-xl p-3 flex items-center justify-between text-left"
                      >
                        <div className="text-left">
                          <div className="text-[10px] uppercase tracking-wide text-gray-400">
                            {label}
                          </div>
                          <div className="text-base font-semibold text-gray-800 mt-1">
                            {sensor?.[key] != null
                              ? `${sensor[key]}${unit ? ` ${unit}` : ""}`
                              : "—"}
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                          <Icon size={15} className="text-green-700" />
                        </div>
                      </div>
                    ))}
                  </div>
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
