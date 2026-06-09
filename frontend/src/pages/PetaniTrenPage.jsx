import { useEffect, useMemo, useState } from "react";
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
import PetaniTopbar from "../layouts/PetaniTopbar";
import ParamHealthCards from "../components/ParamHealthCards";
import {
  CHART_LEGEND,
  ChartTooltip,
  ChartGuideToggle,
  PETANI_TREN_CHART_GUIDES,
  aggregateHourlyTrend,
  buildNpkFromLatest,
} from "../constants/chartGuide";
import { API_URL } from "../config/api";

function PetaniTrenPage() {
  const [screenhouses, setScreenhouses] = useState([]);
  const [latestSensorData, setLatestSensorData] = useState({});
  const [chartDashboards, setChartDashboards] = useState([]);
  const [chartHistories, setChartHistories] = useState([]);
  const [chartThreshold, setChartThreshold] = useState(null);
  const [loading, setLoading] = useState(false);
  const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();

  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API_URL}/screenhouses/my-screenhouses`, { headers })
      .then((res) => res.json())
      .then((data) => setScreenhouses(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/sensor-data/latest`, { headers })
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const mapped = {};
        data.forEach((item) => {
          if (item.screenhouse_id != null) mapped[item.screenhouse_id] = item;
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
      return;
    }

    setLoading(true);
    Promise.all(
      screenhouses.map((sh) =>
        Promise.all([
          fetch(`${API_URL}/sensor-data/screenhouse/${sh.id}/dashboard`, { headers }).then(
            (r) => r.json()
          ),
          fetch(`${API_URL}/sensor-data/screenhouse/${sh.id}/history?hours=24`, { headers }).then(
            (r) => r.json()
          ),
        ]).then(([dashboard, history]) => ({
          dashboard,
          history: Array.isArray(history) ? history : [],
        }))
      )
    )
      .then((results) => {
        setChartDashboards(results.map((r) => r.dashboard));
        setChartHistories(results.map((r) => r.history));
        const firstThreshold = results.find((r) => r.dashboard?.threshold)?.dashboard?.threshold;
        setChartThreshold(firstThreshold ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [screenhouses, token]);

  const trendChartData = useMemo(
    () => aggregateHourlyTrend(chartDashboards, chartHistories),
    [chartDashboards, chartHistories]
  );

  const npkCompareData = useMemo(
    () => buildNpkFromLatest(latestSensorData, chartThreshold),
    [latestSensorData, chartThreshold]
  );

  const aggregateLatest = useMemo(() => {
    const rows = Object.values(latestSensorData).filter(Boolean);
    if (!rows.length) return null;
    const keys = [
      "nitrogen", "phosphorus", "potassium", "soil_moisture",
      "soil_temperature", "soil_ph", "air_temperature", "air_humidity",
    ];
    const out = {};
    keys.forEach((k) => {
      const vals = rows.map((r) => r[k]).filter((v) => v != null).map(Number);
      out[k] = vals.length ? vals.reduce((a, c) => a + c, 0) / vals.length : null;
    });
    return out;
  }, [latestSensorData]);

  const npkColored = useMemo(() => {
    const maxCol = { N: "max_nitrogen", P: "max_phosphorus", K: "max_potassium" };
    return npkCompareData.map((d) => {
      const max = chartThreshold?.[maxCol[d.name]];
      let fill = "#94a3b8";
      if (d.value != null && d.min != null && max != null) {
        fill =
          Number(d.value) < Number(d.min)
            ? "#d97706"
            : Number(d.value) > Number(max)
            ? "#dc2626"
            : "#16a34a";
      }
      return { ...d, max, fill };
    });
  }, [npkCompareData, chartThreshold]);

  return (
    <div className="app-shell fixed inset-0 flex bg-slate-100 overflow-hidden text-left">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} screenhouses={screenhouses} role={user?.role} user={user} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 text-left">
        <PetaniTopbar
          onToggleSidebar={toggleSidebar}
          title="Tren tanah"
          subtitle="Grafik 24 jam terakhir dari semua screenhouse Anda"
        />

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-left">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
            <div className="text-sm font-semibold text-gray-800">Ringkasan tren</div>
            <div className="text-xs text-gray-400 mt-0.5">
              Data digabung dari seluruh screenhouse milik Anda (rata-rata per jam).
              Untuk status & tindakan harian, buka Dashboard.
            </div>
          </div>

          {!loading && aggregateLatest && (
            <ParamHealthCards
              latest={aggregateLatest}
              threshold={chartThreshold}
              title="Kondisi rata-rata saat ini"
              subtitle="Snapshot terbaru — bukan tren historis"
            />
          )}

          {loading ? (
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
                  <div className="text-sm font-semibold text-gray-800 mb-1">
                    Tren nitrogen & kelembapan tanah (24 jam)
                  </div>
                  <div className="text-xs text-gray-400 mb-2">
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
                        {chartThreshold?.min_nitrogen != null && chartThreshold?.max_nitrogen != null && (
                          <ReferenceArea
                            yAxisId="n"
                            y1={chartThreshold.min_nitrogen}
                            y2={chartThreshold.max_nitrogen}
                            fill="#16a34a"
                            fillOpacity={0.07}
                          />
                        )}
                        {chartThreshold?.min_soil_moisture != null && chartThreshold?.max_soil_moisture != null && (
                          <ReferenceArea
                            yAxisId="m"
                            y1={chartThreshold.min_soil_moisture}
                            y2={chartThreshold.max_soil_moisture}
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
                    <div className="h-[260px] flex items-start p-4 text-sm text-gray-400">
                      Belum cukup data historis untuk grafik tren
                    </div>
                  )}
                  <ChartGuideToggle
                    body={PETANI_TREN_CHART_GUIDES.nMoisture.body}
                    extra="Arahkan kursor ke garis untuk melihat angka pada jam tertentu."
                  />
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
                  <div className="text-sm font-semibold text-gray-800 mb-1">
                    Rata-rata NPK screenhouse Anda
                  </div>
                  <div className="text-xs text-gray-400 mb-2">
                    Rata-rata terbaru · warna batang: hijau ideal, oranye kurang, merah berlebih
                  </div>
                  {npkColored.length > 0 && npkColored.some((d) => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={npkColored}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          label={{ value: "mg/kg", angle: -90, position: "insideLeft", fontSize: 10 }}
                        />
                        <Tooltip
                          formatter={(value, _name, props) => [
                            `${value} mg/kg`,
                            props.payload.min != null
                              ? `ideal ${props.payload.min}–${props.payload.max}`
                              : "",
                          ]}
                        />
                        <Bar dataKey="value" name="Rata-rata" radius={[6, 6, 0, 0]}>
                          {npkColored.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[260px] flex items-start p-4 text-sm text-gray-400">
                      Belum ada pembacaan NPK
                    </div>
                  )}
                  <ChartGuideToggle
                    body={PETANI_TREN_CHART_GUIDES.npk.body}
                    extra="Arahkan kursor ke batang untuk melihat nilai pasti."
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
                <div className="text-sm font-semibold text-gray-800 mb-1">
                  Tren phosphorus & potassium (24 jam)
                </div>
                <div className="text-xs text-gray-400 mb-2">
                  Rata-rata semua node — pantau kebutuhan pupuk P dan K
                </div>
                {trendChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        label={{ value: "mg/kg", angle: -90, position: "insideLeft", fontSize: 10 }}
                      />
                      {chartThreshold?.min_phosphorus != null && chartThreshold?.max_phosphorus != null && (
                        <ReferenceArea
                          y1={chartThreshold.min_phosphorus}
                          y2={chartThreshold.max_phosphorus}
                          fill="#2563eb"
                          fillOpacity={0.05}
                        />
                      )}
                      {chartThreshold?.min_potassium != null && chartThreshold?.max_potassium != null && (
                        <ReferenceArea
                          y1={chartThreshold.min_potassium}
                          y2={chartThreshold.max_potassium}
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
                  <div className="h-[220px] flex items-start p-4 text-sm text-gray-400">
                    Belum ada data historis
                  </div>
                )}
                <ChartGuideToggle
                  body={PETANI_TREN_CHART_GUIDES.pk.body}
                  extra="Arahkan kursor ke garis untuk melihat angka pada jam tertentu."
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PetaniTrenPage;
