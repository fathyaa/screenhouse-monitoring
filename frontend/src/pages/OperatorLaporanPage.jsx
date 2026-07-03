import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Sidebar from "../layouts/Sidebar";
import OperatorTopbar from "../layouts/OperatorTopbar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import { API_URL } from "../config/api";
import { SCREENHOUSE_STATUS, STATUS_ORDER } from "../constants/screenhouseStatus";
import { exportOperatorReportPdf } from "../utils/exportReportPdf";
import { ChartGridSkeleton, KpiGridSkeleton } from "../components/LoadingUI";

const PERIOD_OPTIONS = [
  { value: 1, label: "24 jam" },
  { value: 7, label: "7 hari" },
  { value: 30, label: "30 hari" },
];

const GROUP_OPTIONS = [
  { value: "regency", label: "Kabupaten/Kota" },
  { value: "district", label: "Kecamatan" },
  { value: "village", label: "Kelurahan/Desa" },
];

const STATUS_BAR_COLORS = {
  healthy: SCREENHOUSE_STATUS.healthy.color,
  warning: SCREENHOUSE_STATUS.warning.color,
  critical: SCREENHOUSE_STATUS.critical.color,
  offline: SCREENHOUSE_STATUS.offline.color,
};

function KpiCard({ label, value, hint, tone = "slate" }) {
  const tones = {
    slate: "border-gray-200 bg-white text-gray-900",
    green: "border-bl-primary/45 bg-[#e3f2ea] text-bl-dark",
    amber: "border-amber-300 bg-amber-50 text-amber-950",
    red: "border-red-300 bg-red-50 text-red-950",
  };
  const labelTones = {
    slate: "text-gray-600",
    green: "text-bl-primary",
    amber: "text-amber-800",
    red: "text-red-800",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] ?? tones.slate}`}>
      <div className={`text-[11px] uppercase tracking-wide font-semibold ${labelTones[tone] ?? labelTones.slate}`}>
        {label}
      </div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-gray-600 mt-1">{hint}</div>}
    </div>
  );
}

function OperatorLaporanPage() {
  const user = JSON.parse(localStorage.getItem("user") ?? "null");
  const token = localStorage.getItem("token");
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();

  const [screenhouses, setScreenhouses] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const [days, setDays] = useState(7);
  const [groupBy, setGroupBy] = useState("district");
  const [provinceId, setProvinceId] = useState("");
  const [regencyId, setRegencyId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [villageId, setVillageId] = useState("");

  const [provinces, setProvinces] = useState([]);
  const [regencies, setRegencies] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/screenhouses`, { headers })
      .then((r) => r.json())
      .then((data) => setScreenhouses(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [headers]);

  useEffect(() => {
    fetch(`${API_URL}/wilayah/provinces`, { headers })
      .then((r) => r.json())
      .then((data) => setProvinces(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [headers]);

  useEffect(() => {
    if (!provinceId) {
      setRegencies([]);
      return;
    }
    fetch(`${API_URL}/wilayah/regencies?province_id=${provinceId}`, { headers })
      .then((r) => r.json())
      .then((data) => setRegencies(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [provinceId, headers]);

  useEffect(() => {
    if (!regencyId) {
      setDistricts([]);
      return;
    }
    fetch(`${API_URL}/wilayah/districts?regency_id=${regencyId}`, { headers })
      .then((r) => r.json())
      .then((data) => setDistricts(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [regencyId, headers]);

  useEffect(() => {
    if (!districtId) {
      setVillages([]);
      return;
    }
    fetch(`${API_URL}/wilayah/villages?district_id=${districtId}`, { headers })
      .then((r) => r.json())
      .then((data) => setVillages(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [districtId, headers]);

  const loadReport = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      days: String(days),
      group_by: groupBy,
    });
    if (provinceId) params.set("province_id", provinceId);
    if (regencyId) params.set("regency_id", regencyId);
    if (districtId) params.set("district_id", districtId);
    if (villageId) params.set("village_id", villageId);

    fetch(`${API_URL}/screenhouses/operator-reports?${params}`, { headers })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          console.error("[operator-reports]", data?.message ?? r.status);
          setReport(null);
          return;
        }
        if (data?.regions) setReport(data);
        else setReport(null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days, groupBy, provinceId, regencyId, districtId, villageId, headers]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const statusChartData = useMemo(
    () =>
      (report?.regions ?? []).map((row) => ({
        name: row.region_name,
        Sehat: row.healthy,
        Peringatan: row.warning,
        Kritis: row.critical,
        Offline: row.offline,
      })),
    [report]
  );

  const alertTrendData = useMemo(
    () =>
      (report?.alert_trend ?? []).map((row) => ({
        label: new Date(row.date).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
        }),
        count: row.count,
      })),
    [report]
  );

  const sensorTrendData = useMemo(
    () =>
      (report?.regions ?? [])
        .filter((r) => r.sensor_avg?.soil_moisture != null || r.sensor_avg?.soil_temperature != null)
        .slice(0, 8)
        .map((row) => ({
          name: row.region_name.length > 14 ? `${row.region_name.slice(0, 12)}…` : row.region_name,
          kelembapan: row.sensor_avg?.soil_moisture,
          suhu: row.sensor_avg?.soil_temperature,
        })),
    [report]
  );

  const paramChartData = useMemo(
    () => (report?.top_alert_params ?? []).map((p) => ({ name: p.label, count: p.count })),
    [report]
  );

  const groupLabel = GROUP_OPTIONS.find((g) => g.value === groupBy)?.label ?? "Wilayah";

  const handleExport = () => {
    if (!report) return;
    exportOperatorReportPdf(report);
  };

  return (
    <div className="app-shell fixed inset-0 flex bg-bl-surface overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        screenhouses={screenhouses}
        role={user?.role}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <OperatorTopbar
          onToggleSidebar={toggleSidebar}
          title="Laporan wilayah"
          subtitle="Insight screenhouse per periode · filter & export"
          onExport={handleExport}
          exportDisabled={loading || !report?.regions?.length}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <div className="text-sm font-semibold text-gray-800">Filter laporan</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="block text-left">
                <span className="text-xs text-gray-500 mb-1 block">Periode</span>
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100"
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-left">
                <span className="text-xs text-gray-500 mb-1 block">Kelompokkan per</span>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100"
                >
                  {GROUP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-left">
                <span className="text-xs text-gray-500 mb-1 block">Provinsi</span>
                <select
                  value={provinceId}
                  onChange={(e) => {
                    setProvinceId(e.target.value);
                    setRegencyId("");
                    setDistrictId("");
                    setVillageId("");
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100"
                >
                  <option value="">Semua provinsi</option>
                  {provinces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-left">
                <span className="text-xs text-gray-500 mb-1 block">Kabupaten/Kota</span>
                <select
                  value={regencyId}
                  onChange={(e) => {
                    setRegencyId(e.target.value);
                    setDistrictId("");
                    setVillageId("");
                  }}
                  disabled={!provinceId}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100 disabled:bg-gray-50"
                >
                  <option value="">Semua kab/kota</option>
                  {regencies.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-left">
                <span className="text-xs text-gray-500 mb-1 block">Kecamatan</span>
                <select
                  value={districtId}
                  onChange={(e) => {
                    setDistrictId(e.target.value);
                    setVillageId("");
                  }}
                  disabled={!regencyId}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100 disabled:bg-gray-50"
                >
                  <option value="">Semua kecamatan</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-left">
                <span className="text-xs text-gray-500 mb-1 block">Kelurahan/Desa</span>
                <select
                  value={villageId}
                  onChange={(e) => setVillageId(e.target.value)}
                  disabled={!districtId}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100 disabled:bg-gray-50"
                >
                  <option value="">Semua kelurahan/desa</option>
                  {villages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {loading ? (
            <>
              <KpiGridSkeleton />
              <ChartGridSkeleton />
              <ChartGridSkeleton />
            </>
          ) : report ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                  label="Total screenhouse"
                  value={report.kpis.total_screenhouses}
                  hint={`${groupLabel} terfilter`}
                />
                <KpiCard
                  label="Uptime 24 jam"
                  value={`${report.kpis.uptime_pct}%`}
                  hint="Mengirim data dalam 24 jam"
                  tone="green"
                />
                <KpiCard
                  label="Alert aktif"
                  value={report.kpis.active_alerts}
                  hint={`${report.kpis.alert_count_period} alert di periode`}
                  tone={report.kpis.active_alerts > 0 ? "red" : "slate"}
                />
                <KpiCard
                  label="Offline"
                  value={report.kpis.offline_count}
                  hint={
                    report.period_comparison?.alerts_delta != null
                      ? `Alert vs periode lalu: ${report.period_comparison.alerts_delta >= 0 ? "+" : ""}${report.period_comparison.alerts_delta}`
                      : undefined
                  }
                  tone={report.kpis.offline_count > 0 ? "amber" : "slate"}
                />
              </div>

              {(report.growth?.new_screenhouses > 0 ||
                report.growth?.farmers_approved > 0) && (
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-800 mb-2">Pertumbuhan periode</div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span>
                      Screenhouse baru:{" "}
                      <strong className="text-gray-800">{report.growth.new_screenhouses}</strong>
                    </span>
                    <span>
                      Petani disetujui:{" "}
                      <strong className="text-gray-800">{report.growth.farmers_approved}</strong>
                    </span>
                    {report.growth.farmers_pending > 0 && (
                      <span>
                        Menunggu approval:{" "}
                        <strong className="text-amber-700">{report.growth.farmers_pending}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-800 mb-1">
                    Status screenhouse per {groupLabel.toLowerCase()}
                  </div>
                  <div className="text-xs text-gray-400 mb-3">
                    Distribusi sehat, peringatan, kritis, dan offline
                  </div>
                  {statusChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={statusChartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={88}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip />
                        <Legend />
                        {STATUS_ORDER.map((key) => (
                          <Bar
                            key={key}
                            dataKey={SCREENHOUSE_STATUS[key].label}
                            stackId="status"
                            fill={STATUS_BAR_COLORS[key]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center text-sm text-gray-400">
                      Tidak ada data untuk filter ini
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-800 mb-1">Tren alert harian</div>
                  <div className="text-xs text-gray-400 mb-3">
                    Jumlah alert terpicu dalam {report.period_days} hari terakhir
                  </div>
                  {alertTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={alertTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="count"
                          name="Alert"
                          stroke="#dc2626"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center text-sm text-gray-400">
                      Belum ada alert dalam periode ini
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-800 mb-1">
                    Rata-rata kelembapan & suhu tanah
                  </div>
                  <div className="text-xs text-gray-400 mb-3">
                    Per {groupLabel.toLowerCase()} · maks. 8 wilayah teratas
                  </div>
                  {sensorTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={sensorTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="kelembapan" name="Kelembapan (%)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="suhu" name="Suhu tanah (°C)" fill="#d97706" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[260px] flex items-center text-sm text-gray-400">
                      Belum ada data sensor historis
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-800 mb-1">
                    Parameter alert terbanyak
                  </div>
                  <div className="text-xs text-gray-400 mb-3">
                    Ranking parameter yang paling sering melanggar threshold
                  </div>
                  {paramChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={paramChartData} layout="vertical" margin={{ left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="Jumlah alert" radius={[0, 4, 4, 0]}>
                          {paramChartData.map((_, i) => (
                            <Cell key={i} fill={i === 0 ? "#dc2626" : "#f59e0b"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[260px] flex items-center text-sm text-gray-400">
                      Belum ada alert dalam periode ini
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Detail per {groupLabel.toLowerCase()}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Klik Unduh PDF di navbar untuk export laporan lengkap
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="bg-slate-50 text-xs uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3 font-medium">{groupLabel}</th>
                        <th className="px-4 py-3 font-medium text-center">Total</th>
                        <th className="px-4 py-3 font-medium text-center">Sehat</th>
                        <th className="px-4 py-3 font-medium text-center">Peringatan</th>
                        <th className="px-4 py-3 font-medium text-center">Kritis</th>
                        <th className="px-4 py-3 font-medium text-center">Offline</th>
                        <th className="px-4 py-3 font-medium text-center">Uptime</th>
                        <th className="px-4 py-3 font-medium text-center">Alert</th>
                        <th className="px-4 py-3 font-medium text-right">Kelembapan</th>
                        <th className="px-4 py-3 font-medium text-right">Suhu tanah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.regions.map((row) => (
                        <tr key={row.region_id} className="border-t border-gray-100 hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-medium text-gray-800">{row.region_name}</td>
                          <td className="px-4 py-3 text-center tabular-nums">{row.total}</td>
                          <td className="px-4 py-3 text-center tabular-nums text-bl-primary">{row.healthy}</td>
                          <td className="px-4 py-3 text-center tabular-nums text-amber-700">{row.warning}</td>
                          <td className="px-4 py-3 text-center tabular-nums text-red-700">{row.critical}</td>
                          <td className="px-4 py-3 text-center tabular-nums text-slate-500">{row.offline}</td>
                          <td className="px-4 py-3 text-center tabular-nums">{row.uptime_pct}%</td>
                          <td className="px-4 py-3 text-center tabular-nums">{row.active_alerts}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                            {row.sensor_avg?.soil_moisture != null
                              ? `${row.sensor_avg.soil_moisture}%`
                              : "Tidak ada"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                            {row.sensor_avg?.soil_temperature != null
                              ? `${row.sensor_avg.soil_temperature}°C`
                              : "Tidak ada"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
              Gagal memuat laporan. Periksa koneksi ke server.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OperatorLaporanPage;
