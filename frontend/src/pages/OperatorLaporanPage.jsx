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
import { exportOperatorReportCsv, exportProblematicScreenhousesCsv } from "../utils/exportReportCsv";
import { getStressScoreStyle, categoryKeyFromScore } from "../constants/stressScore";
import { ChartGridSkeleton, KpiGridSkeleton } from "../components/LoadingUI";
import FilterSelect from "../components/FilterSelect";
import {
  HorizontalCountLabels,
  LinePointLabels,
  StackedSegmentLabels,
  VerticalCountLabels,
} from "../components/charts/BarValueLabel";

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

const DEFAULT_FILTERS = {
  days: 7,
  groupBy: "district",
  provinceId: "",
  regencyId: "",
  districtId: "",
  villageId: "",
};

const VARIETAS_CHART_COLORS = ["#16a34a", "#2563eb", "#ca8a04", "#9333ea", "#0891b2", "#64748b", "#dc2626", "#7c3aed"];

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

  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [appliedWilayahNames, setAppliedWilayahNames] = useState({
    province: "",
    regency: "",
    district: "",
    village: "",
  });

  const [provinces, setProvinces] = useState([]);
  const [regencies, setRegencies] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);
  const [regionTableTab, setRegionTableTab] = useState("status");

  const { days, groupBy, provinceId, regencyId, districtId, villageId } = draftFilters;
  const applied = appliedFilters;

  const filtersDirty = useMemo(
    () => JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters),
    [draftFilters, appliedFilters]
  );

  const hasWilayahFilter = Boolean(
    applied.provinceId || applied.regencyId || applied.districtId || applied.villageId
  );

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

  const updateDraft = useCallback((patch) => {
    setDraftFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const loadReport = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      days: String(appliedFilters.days),
      group_by: appliedFilters.groupBy,
      include_stress_score: "true",
      include_estimasi: "true",
    });
    if (appliedFilters.provinceId) params.set("province_id", appliedFilters.provinceId);
    if (appliedFilters.regencyId) params.set("regency_id", appliedFilters.regencyId);
    if (appliedFilters.districtId) params.set("district_id", appliedFilters.districtId);
    if (appliedFilters.villageId) params.set("village_id", appliedFilters.villageId);

    fetch(`${API_URL}/laporan/wilayah?${params}`, { headers })
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
  }, [appliedFilters, headers]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleApplyFilters = () => {
    setAppliedWilayahNames({
      province: provinces.find((p) => String(p.id) === String(draftFilters.provinceId))?.name ?? "",
      regency: regencies.find((r) => String(r.id) === String(draftFilters.regencyId))?.name ?? "",
      district: districts.find((d) => String(d.id) === String(draftFilters.districtId))?.name ?? "",
      village: villages.find((v) => String(v.id) === String(draftFilters.villageId))?.name ?? "",
    });
    setAppliedFilters({ ...draftFilters });
  };

  const handleResetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setAppliedWilayahNames({ province: "", regency: "", district: "", village: "" });
  };

  const statusChartData = useMemo(
    () =>
      (report?.regions ?? []).map((row) => ({
        name: row.region_name,
        Sehat: row.healthy,
        Peringatan: row.warning,
        Kritis: row.critical,
        "Tidak terhubung": row.offline,
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

  const varietasChartData = useMemo(
    () => (report?.varietas_distribution ?? []).map((v) => ({ name: v.nama, count: v.count })),
    [report]
  );

  const filterLabel = useMemo(() => {
    const parts = [
      appliedWilayahNames.province,
      appliedWilayahNames.regency,
      appliedWilayahNames.district,
      appliedWilayahNames.village,
    ].filter(Boolean);
    return parts.join(" · ") || "Semua wilayah";
  }, [appliedWilayahNames]);

  const periodLabel =
    PERIOD_OPTIONS.find((p) => p.value === applied.days)?.label ?? `${applied.days} hari`;
  const groupLabel = GROUP_OPTIONS.find((g) => g.value === applied.groupBy)?.label ?? "Wilayah";

  const handleExportPdf = async () => {
    if (!report) return;
    await exportOperatorReportPdf(report, {
      operatorName: user?.name,
      filterLabel,
    });
  };

  const handleExportCsv = () => {
    if (!report) return;
    exportOperatorReportCsv(report);
  };

  const handleExportProblematicCsv = () => {
    if (!report?.problematic_screenhouses?.length) return;
    exportProblematicScreenhousesCsv(report.problematic_screenhouses);
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
          subtitle="Ringkasan screenhouse per periode, filter dan unduh"
          onExport={handleExportPdf}
          onExportCsv={handleExportCsv}
          exportDisabled={loading || !report?.regions?.length}
          exportCsvDisabled={loading || !report?.regions?.length}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-800">Filter laporan</div>
                <div className="text-xs text-gray-600 mt-0.5">
                  Atur filter lalu klik <strong>Terapkan</strong> — laporan tidak berubah otomatis
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {filtersDirty && (
                  <span className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                    Ada perubahan belum diterapkan
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  disabled={!filtersDirty || loading}
                  className="px-4 py-2 rounded-xl bg-bl-primary text-white text-sm font-semibold hover:bg-bl-dark disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Terapkan
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FilterSelect
                label="Periode"
                value={days}
                onChange={(e) => updateDraft({ days: Number(e.target.value) })}
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Kelompokkan per"
                value={groupBy}
                onChange={(e) => updateDraft({ groupBy: e.target.value })}
              >
                {GROUP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </FilterSelect>
            </div>

            <div className="pt-1">
              <div className="text-xs font-semibold text-gray-700 mb-2">Wilayah (opsional)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <FilterSelect
                label="Provinsi"
                value={provinceId}
                onChange={(e) =>
                  updateDraft({
                    provinceId: e.target.value,
                    regencyId: "",
                    districtId: "",
                    villageId: "",
                  })
                }
              >
                <option value="">Semua provinsi</option>
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Kabupaten/Kota"
                value={regencyId}
                disabled={!provinceId}
                onChange={(e) =>
                  updateDraft({
                    regencyId: e.target.value,
                    districtId: "",
                    villageId: "",
                  })
                }
              >
                <option value="">Semua kab/kota</option>
                {regencies.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Kecamatan"
                value={districtId}
                disabled={!regencyId}
                onChange={(e) =>
                  updateDraft({
                    districtId: e.target.value,
                    villageId: "",
                  })
                }
              >
                <option value="">Semua kecamatan</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Kelurahan/Desa"
                value={villageId}
                disabled={!districtId}
                onChange={(e) => updateDraft({ villageId: e.target.value })}
              >
                <option value="">Semua kelurahan/desa</option>
                {villages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </FilterSelect>
              </div>
            </div>

            {!loading && report && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-gray-600">Filter aktif:</span>
                <span className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                  {periodLabel} · {groupLabel}
                  {hasWilayahFilter ? ` · ${filterLabel}` : " · Semua wilayah"}
                </span>
              </div>
            )}
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
                  label="Tidak terhubung"
                  value={report.kpis.offline_count}
                  hint={
                    report.period_comparison?.alerts_delta != null
                      ? `Alert vs periode lalu: ${report.period_comparison.alerts_delta >= 0 ? "+" : ""}${report.period_comparison.alerts_delta}`
                      : undefined
                  }
                  tone={report.kpis.offline_count > 0 ? "amber" : "slate"}
                />
              </div>

              {(report.varietas_distribution?.length > 0 ||
                report.seedling_progress_by_district?.length > 0) && (
                <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Ringkasan kondisi bibit</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      Distribusi varietas dan progres pembibitan berdasarkan estimasi siap tanam
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {varietasChartData.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-700 mb-2">Distribusi varietas</div>
                        {varietasChartData.length > 0 ? (
                          <>
                            <ResponsiveContainer width="100%" height={220}>
                              <BarChart data={varietasChartData} layout="vertical" margin={{ left: 4, right: 28 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                                <YAxis
                                  type="category"
                                  dataKey="name"
                                  width={92}
                                  tick={{ fontSize: 10 }}
                                />
                                <Tooltip />
                                <Bar dataKey="count" name="Screenhouse" radius={[0, 4, 4, 0]}>
                                  {varietasChartData.map((_, i) => (
                                    <Cell key={i} fill={VARIETAS_CHART_COLORS[i % VARIETAS_CHART_COLORS.length]} />
                                  ))}
                                  <HorizontalCountLabels dataKey="count" />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                              {varietasChartData.map((v) => `${v.name}: ${v.count}`).join(" · ")}
                            </p>
                          </>
                        ) : null}
                      </div>
                    )}

                    {report.bibit_summary && (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-2">
                        <div className="text-xs font-semibold text-gray-700">Status pembibitan keseluruhan</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Skor rata-rata</span>
                            <div className="text-xl font-bold text-emerald-800 tabular-nums">
                              {report.bibit_summary.avg_stress_score != null
                                ? Math.round(report.bibit_summary.avg_stress_score)
                                : "—"}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Varietas unik</span>
                            <div className="text-xl font-bold text-gray-800 tabular-nums">
                              {report.bibit_summary.varietas_count}
                            </div>
                          </div>
                          <div className="text-emerald-800">
                            On track: <strong>{report.bibit_summary.on_track}</strong>
                          </div>
                          <div className="text-amber-800">
                            Terlambat: <strong>{report.bibit_summary.terlambat}</strong>
                          </div>
                          <div className="text-red-800">
                            Perlu evaluasi: <strong>{report.bibit_summary.perlu_evaluasi}</strong>
                          </div>
                          <div className="text-gray-600">
                            Belum diisi: <strong>{report.bibit_summary.belum_disi ?? 0}</strong>
                          </div>
                        </div>
                        <div className="pt-3 mt-1 border-t border-emerald-100 space-y-2 text-sm text-gray-700">
                          <div className="flex items-start gap-2">
                            <span aria-hidden>⚡</span>
                            <span>
                              Rata-rata durasi siklus:{" "}
                              <strong className="text-gray-900 tabular-nums">
                                {report.bibit_summary.avg_cycle_duration_days != null
                                  ? `${report.bibit_summary.avg_cycle_duration_days} hari`
                                  : "—"}
                              </strong>
                            </span>
                          </div>
                          {report.bibit_summary.most_stable_varietas && (
                            <div className="flex items-start gap-2">
                              <span aria-hidden>🌾</span>
                              <span>
                                Varietas paling stabil:{" "}
                                <strong className="text-gray-900">
                                  {report.bibit_summary.most_stable_varietas.nama}
                                </strong>
                                {" "}
                                (Rata-rata skor:{" "}
                                <span className="tabular-nums font-semibold text-emerald-800">
                                  {Math.round(report.bibit_summary.most_stable_varietas.avg_score)}
                                </span>
                                )
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {report.seedling_progress_by_district?.length > 0 && (
                    <div className="overflow-x-auto">
                      <div className="text-xs font-semibold text-gray-700 mb-2">
                        Progres pembibitan per kecamatan
                      </div>
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="text-table-head">
                            <th className="px-3 py-2 font-medium">Kecamatan</th>
                            <th className="px-3 py-2 font-medium text-center">Total</th>
                            <th className="px-3 py-2 font-medium text-center">On track</th>
                            <th className="px-3 py-2 font-medium text-center">Terlambat</th>
                            <th className="px-3 py-2 font-medium text-center">Perlu evaluasi</th>
                            <th className="px-3 py-2 font-medium">Varietas dominan</th>
                            <th className="px-3 py-2 font-medium text-center">Rata-rata durasi</th>
                            <th className="px-3 py-2 font-medium text-center">Rata-rata skor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.seedling_progress_by_district.map((row) => {
                            const scoreStyle =
                              row.avg_stress_score != null
                                ? getStressScoreStyle({
                                    score: row.avg_stress_score,
                                    category_key: categoryKeyFromScore(row.avg_stress_score),
                                  })
                                : null;
                            return (
                              <tr
                                key={row.district_id}
                                className="border-t border-gray-100 hover:bg-slate-50/80"
                              >
                                <td className="px-3 py-2 font-medium text-gray-800">
                                  {row.district_name}
                                  <span className="block text-[11px] text-gray-600 font-normal">
                                    {row.regency}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center tabular-nums">{row.total}</td>
                                <td className="px-3 py-2 text-center tabular-nums text-emerald-700">
                                  {row.on_track}
                                </td>
                                <td className="px-3 py-2 text-center tabular-nums text-amber-700">
                                  {row.terlambat}
                                </td>
                                <td className="px-3 py-2 text-center tabular-nums text-red-700">
                                  {row.perlu_evaluasi}
                                </td>
                                <td className="px-3 py-2 text-gray-800 font-medium">
                                  {row.dominant_varietas ?? "—"}
                                </td>
                                <td className="px-3 py-2 text-center tabular-nums text-gray-800">
                                  {row.avg_cycle_duration_days != null
                                    ? `${Math.round(row.avg_cycle_duration_days)} hari`
                                    : "—"}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {row.avg_stress_score != null ? (
                                    <span
                                      className={`inline-flex min-w-[2.25rem] px-2 py-0.5 rounded-lg text-sm font-bold tabular-nums ${scoreStyle?.badge ?? ""}`}
                                    >
                                      {Math.round(row.avg_stress_score)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {report.varietas_duration_stats?.length > 0 && (
                    <div className="overflow-x-auto border-t border-gray-100 pt-4">
                      <div className="text-xs font-semibold text-gray-700 mb-2">
                        Durasi pembibitan aktual vs standar biologis (per varietas)
                      </div>
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="text-table-head">
                            <th className="px-3 py-2 font-medium">Varietas</th>
                            <th className="px-3 py-2 font-medium text-center">Screenhouse</th>
                            <th className="px-3 py-2 font-medium text-center">Rata-rata aktual</th>
                            <th className="px-3 py-2 font-medium text-center">Standar biologis</th>
                            <th className="px-3 py-2 font-medium text-center">Indeks keterlambatan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.varietas_duration_stats.map((row) => (
                            <tr
                              key={row.nama}
                              className="border-t border-gray-100 hover:bg-slate-50/80"
                            >
                              <td className="px-3 py-2 font-medium text-gray-800">{row.nama}</td>
                              <td className="px-3 py-2 text-center tabular-nums">{row.screenhouse_count}</td>
                              <td className="px-3 py-2 text-center tabular-nums">
                                {row.avg_actual_days != null ? `${row.avg_actual_days} hari` : "—"}
                              </td>
                              <td className="px-3 py-2 text-center tabular-nums text-gray-600">
                                {row.avg_standard_days != null
                                  ? `${row.avg_standard_days} hari`
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 text-center tabular-nums">
                                {row.delay_index_days == null ? (
                                  <span className="text-gray-500">—</span>
                                ) : row.delay_index_days > 0 ? (
                                  <span className="text-amber-700 font-semibold">
                                    +{row.delay_index_days} hari
                                  </span>
                                ) : row.delay_index_days < 0 ? (
                                  <span className="text-emerald-700 font-semibold">
                                    {row.delay_index_days} hari
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 font-semibold">Tepat</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {(report.growth?.new_screenhouses > 0 ||
                report.growth?.farmers_approved > 0 ||
                report.growth?.farmers_pending > 0 ||
                report.growth?.farmers_rejected > 0) && (
                <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Aktivitas registrasi dalam periode</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      Unit screenhouse dan akun petani dihitung terpisah
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                      <div className="text-xs text-gray-600">Unit screenhouse terdaftar</div>
                      <div className="text-xl font-bold text-gray-900 tabular-nums mt-1">
                        {report.growth.new_screenhouses}
                      </div>
                      {report.growth.distinct_petani_owners > 0 && (
                        <div className="text-[11px] text-gray-600 mt-1">
                          Terhubung ke {report.growth.distinct_petani_owners} petani
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                      <div className="text-xs text-gray-600">Akun petani baru disetujui</div>
                      <div className="text-xl font-bold text-gray-900 tabular-nums mt-1">
                        {report.growth.farmers_approved}
                      </div>
                      <div className="text-[11px] text-gray-600 mt-1">Daftar &amp; disetujui dalam periode</div>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-3">
                      <div className="text-xs text-amber-800">Menunggu approval</div>
                      <div className="text-xl font-bold text-amber-900 tabular-nums mt-1">
                        {report.growth.farmers_pending}
                      </div>
                      <div className="text-[11px] text-amber-800/80 mt-1">Akun petani belum disetujui</div>
                    </div>
                    <div className="rounded-xl border border-red-100 bg-red-50/80 p-3">
                      <div className="text-xs text-red-800">Ditolak</div>
                      <div className="text-xl font-bold text-red-900 tabular-nums mt-1">
                        {report.growth.farmers_rejected}
                      </div>
                      <div className="text-[11px] text-red-800/80 mt-1">Akun petani ditolak dalam periode</div>
                    </div>
                  </div>
                  {report.growth.note && (
                    <p className="text-xs text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                      {report.growth.note}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-800 mb-1">
                    Status screenhouse per {groupLabel.toLowerCase()}
                  </div>
                  <div className="text-xs text-gray-600 mb-3">
                    Distribusi sehat, peringatan, kritis, dan tidak terhubung
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
                          >
                            <StackedSegmentLabels dataKey={SCREENHOUSE_STATUS[key].label} />
                          </Bar>
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center text-sm text-gray-600">
                      Tidak ada data untuk filter ini
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-800 mb-1">Tren alert harian</div>
                  <div className="text-xs text-gray-600 mb-3">
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
                        >
                          <LinePointLabels dataKey="count" />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center text-sm text-gray-600">
                      Belum ada alert dalam periode ini
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-800 mb-1">
                    Rata-rata kelembapan tanah
                  </div>
                  <div className="text-xs text-gray-600 mb-3">
                    Per {groupLabel.toLowerCase()} · maks. 8 wilayah · satuan %
                  </div>
                  {sensorTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={sensorTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} unit="%" />
                        <Tooltip formatter={(v) => (v != null ? `${v}%` : "—")} />
                        <Bar dataKey="kelembapan" name="Kelembapan (%)" fill="#2563eb" radius={[4, 4, 0, 0]}>
                          <VerticalCountLabels dataKey="kelembapan" suffix="%" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[240px] flex items-center text-sm text-gray-600">
                      Belum ada data kelembapan
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-800 mb-1">
                    Rata-rata suhu tanah
                  </div>
                  <div className="text-xs text-gray-600 mb-3">
                    Per {groupLabel.toLowerCase()} · maks. 8 wilayah · satuan °C
                  </div>
                  {sensorTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={sensorTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} unit="°C" />
                        <Tooltip formatter={(v) => (v != null ? `${v}°C` : "—")} />
                        <Bar dataKey="suhu" name="Suhu tanah (°C)" fill="#d97706" radius={[4, 4, 0, 0]}>
                          <VerticalCountLabels dataKey="suhu" suffix="°C" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[240px] flex items-center text-sm text-gray-600">
                      Belum ada data suhu tanah
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="text-sm font-semibold text-gray-800 mb-1">
                  Parameter alert terbanyak
                </div>
                <div className="text-xs text-gray-600 mb-3">
                  Ranking parameter yang paling sering melanggar batas aman
                </div>
                {paramChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={paramChartData} layout="vertical" margin={{ left: 8, right: 28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Jumlah alert" radius={[0, 4, 4, 0]}>
                        {paramChartData.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? "#dc2626" : "#f59e0b"} />
                        ))}
                        <HorizontalCountLabels dataKey="count" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[260px] flex items-center text-sm text-gray-600">
                    Belum ada alert dalam periode ini
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Detail per {groupLabel.toLowerCase()}</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      Pilih tab untuk melihat status atau data sensor · export PDF/CSV mencakup keduanya
                    </div>
                  </div>
                  <div className="flex rounded-xl border border-gray-200 p-0.5 bg-gray-50 shrink-0">
                    <button
                      type="button"
                      onClick={() => setRegionTableTab("status")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        regionTableTab === "status"
                          ? "bg-white text-emerald-800 shadow-sm"
                          : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      Status & Uptime
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegionTableTab("sensor")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        regionTableTab === "sensor"
                          ? "bg-white text-emerald-800 shadow-sm"
                          : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      Data Sensor Rata-rata
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  {regionTableTab === "status" ? (
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="text-table-head">
                          <th className="px-4 py-3 font-medium">{groupLabel}</th>
                          <th className="px-4 py-3 font-medium text-center">Total</th>
                          <th className="px-4 py-3 font-medium text-center">Sehat</th>
                          <th className="px-4 py-3 font-medium text-center">Peringatan</th>
                          <th className="px-4 py-3 font-medium text-center">Kritis</th>
                          <th className="px-4 py-3 font-medium text-center">Tidak terhubung</th>
                          <th className="px-4 py-3 font-medium text-center">Uptime</th>
                          <th className="px-4 py-3 font-medium text-center">Skor rata-rata</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.regions.map((row) => {
                          const scoreStyle =
                            row.avg_stress_score != null
                              ? getStressScoreStyle({
                                  score: row.avg_stress_score,
                                  category_key: categoryKeyFromScore(row.avg_stress_score),
                                })
                              : null;
                          return (
                          <tr key={row.region_id} className="border-t border-gray-100 hover:bg-slate-50/80">
                            <td className="px-4 py-3 font-medium text-gray-800">{row.region_name}</td>
                            <td className="px-4 py-3 text-center tabular-nums">{row.total}</td>
                            <td className="px-4 py-3 text-center tabular-nums text-bl-primary">{row.healthy}</td>
                            <td className="px-4 py-3 text-center tabular-nums text-amber-700">{row.warning}</td>
                            <td className="px-4 py-3 text-center tabular-nums text-red-700">{row.critical}</td>
                            <td className="px-4 py-3 text-center tabular-nums text-slate-600 font-medium">{row.offline}</td>
                            <td className="px-4 py-3 text-center tabular-nums">{row.uptime_pct}%</td>
                            <td className="px-4 py-3 text-center">
                              {row.avg_stress_score != null ? (
                                <span
                                  className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-lg text-sm font-bold tabular-nums ${scoreStyle?.badge ?? ""}`}
                                >
                                  {Math.round(row.avg_stress_score)}
                                </span>
                              ) : (
                                <span className="text-gray-500">—</span>
                              )}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="text-table-head">
                          <th className="px-4 py-3 font-medium">{groupLabel}</th>
                          <th className="px-4 py-3 font-medium text-right">N (mg/kg)</th>
                          <th className="px-4 py-3 font-medium text-right">P (mg/kg)</th>
                          <th className="px-4 py-3 font-medium text-right">K (mg/kg)</th>
                          <th className="px-4 py-3 font-medium text-right">Kelembapan</th>
                          <th className="px-4 py-3 font-medium text-right">Suhu tanah</th>
                          <th className="px-4 py-3 font-medium text-center">Alert</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.regions.map((row) => (
                          <tr key={row.region_id} className="border-t border-gray-100 hover:bg-slate-50/80">
                            <td className="px-4 py-3 font-medium text-gray-800">{row.region_name}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                              {row.sensor_avg?.nitrogen != null ? row.sensor_avg.nitrogen : "—"}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                              {row.sensor_avg?.phosphorus != null ? row.sensor_avg.phosphorus : "—"}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                              {row.sensor_avg?.potassium != null ? row.sensor_avg.potassium : "—"}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                              {row.sensor_avg?.soil_moisture != null
                                ? `${row.sensor_avg.soil_moisture}%`
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                              {row.sensor_avg?.soil_temperature != null
                                ? `${row.sensor_avg.soil_temperature}°C`
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-center tabular-nums">{row.active_alerts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {report.problematic_screenhouses?.length > 0 && (
                <div className="bg-white rounded-2xl border border-red-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-red-50 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">
                        Screenhouse perlu tindak lanjut
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        Prioritas kunjungan / hubungi petani
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportProblematicCsv}
                      className="text-xs font-medium text-bl-primary hover:underline shrink-0"
                    >
                      Unduh CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="text-table-head">
                          <th className="px-4 py-3 font-medium">Screenhouse</th>
                          <th className="px-4 py-3 font-medium">Varietas</th>
                          <th className="px-4 py-3 font-medium">Petani</th>
                          <th className="px-4 py-3 font-medium">Wilayah</th>
                          <th className="px-4 py-3 font-medium text-center">Skor kondisi</th>
                          <th className="px-4 py-3 font-medium">Estimasi siap tanam</th>
                          <th className="px-4 py-3 font-medium text-center">Status</th>
                          <th className="px-4 py-3 font-medium text-center">Alert</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.problematic_screenhouses.map((row) => {
                          const scoreStyle =
                            row.stress_score != null
                              ? getStressScoreStyle({
                                  score: row.stress_score,
                                  category_key: categoryKeyFromScore(row.stress_score),
                                })
                              : null;
                          return (
                          <tr key={row.id} className="border-t border-gray-100 hover:bg-slate-50/80">
                            <td className="px-4 py-3 font-medium text-gray-800">{row.name}</td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{row.varietas_nama ?? "—"}</td>
                            <td className="px-4 py-3 text-gray-600">
                              <div>{row.owner_name ?? "—"}</div>
                              {row.owner_phone && (
                                <div className="text-xs text-gray-600">{row.owner_phone}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">
                              {[row.village, row.district].filter(Boolean).join(", ")}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {row.stress_score != null ? (
                                <span
                                  className={`inline-flex min-w-[2.25rem] px-2 py-0.5 rounded-lg text-sm font-bold tabular-nums ${scoreStyle?.badge ?? ""}`}
                                  title={row.stress_category ?? undefined}
                                >
                                  {row.stress_score}
                                </span>
                              ) : (
                                <span className="text-gray-500 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">
                              {row.estimasi_siap_label ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">
                                {row.status_label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center tabular-nums">{row.active_alerts}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-600 font-medium text-sm">
              Gagal memuat laporan. Periksa koneksi ke server.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OperatorLaporanPage;
