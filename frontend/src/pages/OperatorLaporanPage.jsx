import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Lightbulb,
  Timer,
  Sprout,
  Target,
  CalendarClock,
  ChevronDown,
  Activity,
  Phone,
  TriangleAlert,
  CheckCircle2,
} from "lucide-react";
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
import OperatorBottomNav from "../layouts/OperatorBottomNav";
import OperatorTopbar from "../layouts/OperatorTopbar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import { API_URL } from "../config/api";
import { SCREENHOUSE_STATUS, STATUS_ORDER } from "../constants/screenhouseStatus";
import { exportOperatorReportPdf } from "../utils/exportReportPdf";
import { exportOperatorReportCsv, exportProblematicScreenhousesCsv } from "../utils/exportReportCsv";
import { getStressScoreStyle, categoryKeyFromScore } from "../constants/stressScore";
import { ChartGridSkeleton, KpiGridSkeleton } from "../components/LoadingUI";
import FilterSelect from "../components/FilterSelect";
import Pagination from "../components/Pagination";
import { usePagination } from "../hooks/usePagination";
import {
  CHART_STATUS,
  CHART_GRID,
  CATEGORICAL_PALETTE,
} from "../constants/chartColors";
import {
  HorizontalCountLabels,
  LinePointLabels,
  StackedSegmentLabels,
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

const VARIETAS_CHART_COLORS = CATEGORICAL_PALETTE;

const STATUS_BAR_COLORS = {
  healthy: SCREENHOUSE_STATUS.healthy.color,
  warning: SCREENHOUSE_STATUS.warning.color,
  critical: SCREENHOUSE_STATUS.critical.color,
  offline: SCREENHOUSE_STATUS.offline.color,
};

/**
 * Fallback kartu untuk tabel laporan di layar HP — tabel dense multi-kolom
 * jadi baris kartu bertumpuk (mirip halaman admin), bukan overflow-x scroll.
 */
function ReportCardList({ children }) {
  return <div className="sm:hidden divide-y divide-gray-100">{children}</div>;
}

function ReportCard({ title, subtitle, badge, items }) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-800">{title}</div>
          {subtitle && <div className="text-xs text-gray-600 mt-0.5">{subtitle}</div>}
        </div>
        {badge != null && <div className="shrink-0">{badge}</div>}
      </div>
      {items?.length > 0 && (
        <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
          {items.map(({ label, value }) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-gray-500 leading-tight">{label}</dt>
              <dd className="text-sm text-gray-800 tabular-nums mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Satu kalimat ringkas dari data yang sudah ada di report — bukan data baru. */
function buildInsightText(report) {
  if (!report) return null;
  const problematicCount = report.problematic_screenhouses?.length ?? 0;
  const terlambat = report.readiness?.behind_count ?? report.bibit_summary?.terlambat ?? 0;
  const topParam = report.top_alert_params?.[0]?.label;
  const delta = report.period_comparison?.alerts_delta;

  const parts = [];
  if (problematicCount > 0) {
    parts.push(`${problematicCount} screenhouse perlu tindak lanjut`);
  }
  if (terlambat > 0) {
    parts.push(`${terlambat} pembibitan terlambat / perlu evaluasi`);
  }

  if (!parts.length) {
    return "Semua screenhouse dalam kondisi baik pada periode ini.";
  }

  let text = `${parts.join(", ")}.`;
  if (topParam) {
    text += ` Penyebab alert terbanyak: ${topParam.toLowerCase()}.`;
  }
  if (delta != null && delta !== 0) {
    text += ` Alert ${delta > 0 ? "naik" : "turun"} ${Math.abs(delta)} dibanding periode sebelumnya.`;
  }
  return text;
}

function KpiCard({ label, value, hint, tone = "slate", icon: Icon }) {
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
      <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold ${labelTones[tone] ?? labelTones.slate}`}>
        {Icon && <Icon size={13} aria-hidden />}
        {label}
      </div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-gray-600 mt-1">{hint}</div>}
    </div>
  );
}

/**
 * Headline outcome IP400: % kesiapan tepat waktu vs target, dengan verdict
 * on-track / tertinggal — jawaban pertama yang dicari pengambil keputusan.
 */
function VerdictHeader({ kpis, periodLabel, filterLabel }) {
  const pct = kpis?.on_time_readiness_pct;
  const target = kpis?.target_readiness_pct ?? 90;
  const hasData = pct != null;
  const onTrack = hasData && pct >= target;

  const tone = !hasData
    ? { wrap: "border-gray-200 bg-white", ic: "bg-gray-100 text-gray-500", head: "text-gray-800", bar: "#94a3b8" }
    : onTrack
    ? { wrap: "border-bl-primary/45 bg-[#e3f2ea]", ic: "bg-white/70 text-bl-primary", head: "text-bl-dark", bar: SCREENHOUSE_STATUS.healthy.color }
    : { wrap: "border-red-300 bg-red-50", ic: "bg-red-100 text-red-700", head: "text-red-950", bar: SCREENHOUSE_STATUS.critical.color };

  const Icon = !hasData ? Target : onTrack ? CheckCircle2 : TriangleAlert;

  let verdict;
  if (!hasData) {
    verdict = "Belum cukup data kesiapan untuk menilai target — pastikan alat mengirim data & tanggal semai terisi.";
  } else if (onTrack) {
    verdict = `On-track: ${pct}% pembibitan siap tepat waktu, memenuhi target ${target}%.`;
  } else {
    verdict = `Tertinggal: ${pct}% siap tepat waktu, di bawah target ${target}%. ${kpis.behind_count ?? 0} unit terlambat / perlu evaluasi.`;
  }

  return (
    <div className={`rounded-2xl border px-5 py-4 flex items-start gap-4 ${tone.wrap}`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${tone.ic}`}>
        <Icon size={24} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-2xl font-bold tabular-nums ${tone.head}`}>
            {hasData ? `${pct}%` : "—"}
          </span>
          <span className="text-xs text-gray-600">kesiapan tepat waktu · target {target}%</span>
        </div>
        {hasData && (
          <div className="mt-2 h-2 rounded-full bg-white/70 overflow-hidden relative max-w-md">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, pct)}%`, backgroundColor: tone.bar }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-gray-700/70"
              style={{ left: `${Math.min(100, target)}%` }}
              title={`Target ${target}%`}
            />
          </div>
        )}
        <p className={`text-sm mt-2 leading-relaxed ${tone.head}`}>{verdict}</p>
        <p className="text-[11px] text-gray-500 mt-1">
          {periodLabel} · {filterLabel}
        </p>
      </div>
    </div>
  );
}

/** KPI kesehatan perangkat gabungan (uptime + offline + alert kritis). */
function DeviceHealthCard({ deviceHealth }) {
  if (!deviceHealth) return null;
  const { uptime_pct, offline_count, critical_alerts, auto_handled_alerts } = deviceHealth;
  const tone = critical_alerts > 0 || uptime_pct < 80 ? "amber" : "slate";
  const tones = {
    slate: "border-gray-200 bg-white",
    amber: "border-amber-300 bg-amber-50",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-gray-600">
        <Activity size={13} aria-hidden />
        Kesehatan perangkat
      </div>
      <div className="text-2xl font-bold mt-1 tabular-nums text-gray-900">{uptime_pct}%</div>
      <div className="text-xs text-gray-600 mt-1">
        {offline_count} tidak terhubung ·{" "}
        <span className={critical_alerts > 0 ? "text-red-700 font-medium" : ""}>
          {critical_alerts} alert kritis
        </span>
        {auto_handled_alerts > 0 && (
          <span className="text-gray-500"> · {auto_handled_alerts} ditangani otomatis</span>
        )}
      </div>
    </div>
  );
}

/** Kalender kesiapan — berapa batch siap tanam dalam jendela waktu ke depan. */
function ReadinessCalendar({ readiness }) {
  if (!readiness) return null;
  const b = readiness.readiness_buckets ?? {};
  const cells = [
    { key: "overdue", label: "Lewat estimasi", value: b.overdue ?? 0, tone: "text-red-700 bg-red-50 border-red-100" },
    { key: "d0_7", label: "≤ 7 hari", value: b.d0_7 ?? 0, tone: "text-emerald-800 bg-emerald-50 border-emerald-100" },
    { key: "d8_14", label: "8–14 hari", value: b.d8_14 ?? 0, tone: "text-emerald-800 bg-emerald-50 border-emerald-100" },
    { key: "d15_30", label: "15–30 hari", value: b.d15_30 ?? 0, tone: "text-gray-800 bg-gray-50 border-gray-100" },
    { key: "d30_plus", label: "> 30 hari", value: b.d30_plus ?? 0, tone: "text-gray-800 bg-gray-50 border-gray-100" },
  ];
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock size={16} className="text-bl-primary shrink-0" aria-hidden />
        <div className="text-sm font-semibold text-gray-800">Kalender kesiapan tanam</div>
      </div>
      <div className="text-xs text-gray-600 mb-3">
        Jumlah screenhouse per jendela estimasi siap tanam — untuk menjadwalkan olah lahan & transplantasi.
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {cells.map((c) => (
          <div key={c.key} className={`rounded-xl border p-3 ${c.tone}`}>
            <div className="text-2xl font-bold tabular-nums">{c.value}</div>
            <div className="text-[11px] font-medium mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>
      {(b.no_estimate ?? 0) > 0 && (
        <div className="text-[11px] text-gray-500 mt-2">
          {b.no_estimate} screenhouse belum punya estimasi (tanggal semai / data sensor belum lengkap).
        </div>
      )}
    </div>
  );
}

/** Bagian sekunder yang bisa dilipat — menjaga layar utama fokus ke keputusan. */
function CollapsibleSection({ title, subtitle, defaultOpen = false, children }) {
  return (
    <details className="bg-white rounded-2xl border border-gray-200 overflow-hidden group" open={defaultOpen}>
      <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between gap-2 hover:bg-gray-50">
        <div>
          <div className="text-sm font-semibold text-gray-800">{title}</div>
          {subtitle && <div className="text-xs text-gray-600 mt-0.5">{subtitle}</div>}
        </div>
        <ChevronDown size={18} className="text-gray-500 transition-transform group-open:rotate-180 shrink-0" />
      </summary>
      <div className="px-4 pb-4 pt-1 space-y-4 border-t border-gray-100">{children}</div>
    </details>
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
  const [exportingPdf, setExportingPdf] = useState(false);

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
  const [regionLimit, setRegionLimit] = useState(8);

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
      (report?.regions ?? []).slice(0, regionLimit).map((row) => ({
        name: row.region_name,
        Sehat: row.healthy,
        Peringatan: row.warning,
        Kritis: row.critical,
        "Tidak terhubung": row.offline,
      })),
    [report, regionLimit]
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

  const paramChartData = useMemo(
    () => (report?.top_alert_params ?? []).map((p) => ({ name: p.label, count: p.count })),
    [report]
  );

  const varietasChartData = useMemo(
    () => (report?.varietas_distribution ?? []).map((v) => ({ name: v.nama, count: v.count })),
    [report]
  );

  const insightText = useMemo(() => buildInsightText(report), [report]);

  const {
    page: regionPage,
    setPage: setRegionPage,
    pageItems: pagedRegions,
    pageCount: regionPageCount,
    total: regionTotal,
    pageSize: regionPageSize,
  } = usePagination(report?.regions ?? [], 10, report);

  const {
    page: worklistPage,
    setPage: setWorklistPage,
    pageItems: pagedProblematic,
    pageCount: worklistPageCount,
    total: worklistTotal,
    pageSize: worklistPageSize,
  } = usePagination(report?.problematic_screenhouses ?? [], 8, report);

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
    setExportingPdf(true);
    try {
      await exportOperatorReportPdf(report, {
        operatorName: user?.name,
        filterLabel,
      });
    } finally {
      setExportingPdf(false);
    }
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
          exportDisabled={loading || !report?.regions?.length || exportingPdf}
          exportCsvDisabled={loading || !report?.regions?.length}
          exportLoading={exportingPdf}
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
              <div>
                <FilterSelect
                  label="Periode"
                  value={[1, 7, 30].includes(days) ? String(days) : "custom"}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateDraft({ days: v === "custom" ? 14 : Number(v) });
                  }}
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </FilterSelect>
                {![1, 7, 30].includes(days) && (
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={days}
                    onChange={(e) =>
                      updateDraft({
                        days: Math.max(1, Math.min(90, Number(e.target.value) || 1)),
                      })
                    }
                    placeholder="Jumlah hari (1–90)"
                    className="mt-2 w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-800 outline-none focus:ring-1 focus:ring-green-300"
                  />
                )}
              </div>

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

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-700">Wilayah di grafik:</span>
              {[
                { value: 8, label: "8 teratas" },
                { value: 15, label: "15 teratas" },
                { value: Infinity, label: "Semua" },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setRegionLimit(opt.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    regionLimit === opt.value
                      ? "bg-bl-primary text-white"
                      : "text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <span className="text-[11px] text-gray-500">· berlaku langsung</span>
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
              {/* 1. Verdict IP400 — jawaban pertama: on-track atau tertinggal */}
              <VerdictHeader kpis={report.kpis} periodLabel={periodLabel} filterLabel={filterLabel} />

              {/* 2. KPI outcome */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                  label="Kesiapan tepat waktu"
                  value={report.kpis.on_time_readiness_pct != null ? `${report.kpis.on_time_readiness_pct}%` : "—"}
                  hint={`Target ${report.kpis.target_readiness_pct ?? 90}% · ${report.readiness?.with_estimate ?? 0} unit terjadwal`}
                  tone={
                    report.kpis.on_time_readiness_pct == null
                      ? "slate"
                      : report.kpis.on_time_readiness_pct >= (report.kpis.target_readiness_pct ?? 90)
                      ? "green"
                      : "red"
                  }
                  icon={Target}
                />
                <KpiCard
                  label="Siap ≤ 14 hari"
                  value={report.kpis.ready_within_14d ?? 0}
                  hint="Segera jadwalkan olah lahan"
                  icon={CalendarClock}
                />
                <KpiCard
                  label="Terlambat / perlu evaluasi"
                  value={report.kpis.behind_count ?? 0}
                  hint={`${report.problematic_screenhouses?.length ?? 0} screenhouse perlu tindak lanjut`}
                  tone={(report.kpis.behind_count ?? 0) > 0 ? "amber" : "slate"}
                  icon={TriangleAlert}
                />
                <DeviceHealthCard deviceHealth={report.device_health} />
              </div>

              {/* 3. Insight singkat */}
              {insightText && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                  <Lightbulb size={16} className="text-emerald-700 mt-0.5 shrink-0" aria-hidden />
                  <p className="text-sm text-emerald-950 leading-relaxed">{insightText}</p>
                </div>
              )}

              {/* 4. Aksi hari ini — worklist prioritas */}
              {report.problematic_screenhouses?.length > 0 && (
                <div className="bg-white rounded-2xl border border-red-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-red-50 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">
                        Aksi hari ini — screenhouse perlu tindak lanjut
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        Prioritas kunjungan / hubungi petani (urut dari paling bermasalah)
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
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="text-table-head">
                          <th className="px-4 py-3 font-medium">Screenhouse</th>
                          <th className="px-4 py-3 font-medium">Alasan</th>
                          <th className="px-4 py-3 font-medium">Petani</th>
                          <th className="px-4 py-3 font-medium">Wilayah</th>
                          <th className="px-4 py-3 font-medium text-center">Skor kondisi</th>
                          <th className="px-4 py-3 font-medium">Estimasi siap tanam</th>
                          <th className="px-4 py-3 font-medium text-center">Status</th>
                          <th className="px-4 py-3 font-medium text-center">Alert</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedProblematic.map((row) => {
                          const scoreStyle =
                            row.stress_score != null
                              ? getStressScoreStyle({
                                  score: row.stress_score,
                                  category_key: categoryKeyFromScore(row.stress_score),
                                })
                              : null;
                          const reason =
                            row.insight ||
                            (row.abnormal?.length
                              ? row.abnormal.map((a) => a.label).join(", ")
                              : "—");
                          return (
                          <tr key={row.id} className="border-t border-gray-100 hover:bg-slate-50/80 align-top">
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {row.name}
                              <span className="block text-xs text-gray-500 font-normal">{row.varietas_nama ?? "—"}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs max-w-[16rem]">{reason}</td>
                            <td className="px-4 py-3 text-gray-600">
                              <div>{row.owner_name ?? "—"}</div>
                              {row.owner_phone && (
                                <div className="text-xs text-gray-600 flex items-center gap-1">
                                  <Phone size={11} className="shrink-0" aria-hidden />
                                  {row.owner_phone}
                                </div>
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
                  <ReportCardList>
                    {pagedProblematic.map((row) => {
                      const scoreStyle =
                        row.stress_score != null
                          ? getStressScoreStyle({
                              score: row.stress_score,
                              category_key: categoryKeyFromScore(row.stress_score),
                            })
                          : null;
                      const wilayah = [row.village, row.district].filter(Boolean).join(", ");
                      const reason =
                        row.insight ||
                        (row.abnormal?.length ? row.abnormal.map((a) => a.label).join(", ") : "—");
                      return (
                        <ReportCard
                          key={row.id}
                          title={row.name}
                          subtitle={[row.varietas_nama, wilayah].filter(Boolean).join(" · ")}
                          badge={
                            row.stress_score != null ? (
                              <span
                                className={`inline-flex min-w-[2.25rem] justify-center px-2 py-0.5 rounded-lg text-sm font-bold tabular-nums ${scoreStyle?.badge ?? ""}`}
                              >
                                {row.stress_score}
                              </span>
                            ) : null
                          }
                          items={[
                            { label: "Alasan", value: reason },
                            {
                              label: "Petani",
                              value: (
                                <>
                                  {row.owner_name ?? "—"}
                                  {row.owner_phone && (
                                    <span className="block text-xs text-gray-500">{row.owner_phone}</span>
                                  )}
                                </>
                              ),
                            },
                            {
                              label: "Status",
                              value: (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">
                                  {row.status_label}
                                </span>
                              ),
                            },
                            { label: "Estimasi siap tanam", value: row.estimasi_siap_label ?? "—" },
                            { label: "Alert aktif", value: row.active_alerts },
                          ]}
                        />
                      );
                    })}
                  </ReportCardList>
                  <Pagination
                    page={worklistPage}
                    pageCount={worklistPageCount}
                    total={worklistTotal}
                    pageSize={worklistPageSize}
                    onPageChange={setWorklistPage}
                    itemLabel="screenhouse"
                    className="border-t border-gray-100"
                  />
                  <div className="px-4 py-2 text-[11px] text-gray-500 border-t border-gray-100">
                    Unduhan PDF/CSV memuat seluruh {worklistTotal} screenhouse, bukan hanya halaman ini.
                  </div>
                </div>
              )}

              {/* 5. Prioritas wilayah — satu tabel gabungan progres IP400 + kesehatan */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="text-sm font-semibold text-gray-800">Prioritas per {groupLabel.toLowerCase()}</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      Progres pembibitan + kesehatan perangkat · fokuskan wilayah dengan terlambat/perlu evaluasi terbanyak
                    </div>
                  </div>
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="text-table-head">
                          <th className="px-4 py-3 font-medium">{groupLabel}</th>
                          <th className="px-3 py-3 font-medium text-center">Total</th>
                          <th className="px-3 py-3 font-medium text-center">On track</th>
                          <th className="px-3 py-3 font-medium text-center">Terlambat</th>
                          <th className="px-3 py-3 font-medium text-center">Perlu evaluasi</th>
                          <th className="px-3 py-3 font-medium text-center">Uptime</th>
                          <th className="px-3 py-3 font-medium text-center">Skor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedRegions.map((row) => {
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
                            <td className="px-3 py-3 text-center tabular-nums">{row.total}</td>
                            <td className="px-3 py-3 text-center tabular-nums text-emerald-700">{row.on_track ?? 0}</td>
                            <td className="px-3 py-3 text-center tabular-nums text-amber-700">{row.terlambat ?? 0}</td>
                            <td className="px-3 py-3 text-center tabular-nums text-red-700">{row.perlu_evaluasi ?? 0}</td>
                            <td className="px-3 py-3 text-center tabular-nums">{row.uptime_pct}%</td>
                            <td className="px-3 py-3 text-center">
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
                  </div>
                  <ReportCardList>
                    {pagedRegions.map((row) => {
                      const scoreStyle =
                        row.avg_stress_score != null
                          ? getStressScoreStyle({
                              score: row.avg_stress_score,
                              category_key: categoryKeyFromScore(row.avg_stress_score),
                            })
                          : null;
                      return (
                        <ReportCard
                          key={row.region_id}
                          title={row.region_name}
                          badge={
                            row.avg_stress_score != null ? (
                              <span
                                className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-lg text-sm font-bold tabular-nums ${scoreStyle?.badge ?? ""}`}
                              >
                                {Math.round(row.avg_stress_score)}
                              </span>
                            ) : null
                          }
                          items={[
                            { label: "Total", value: row.total },
                            { label: "On track", value: <span className="text-emerald-700">{row.on_track ?? 0}</span> },
                            { label: "Terlambat", value: <span className="text-amber-700">{row.terlambat ?? 0}</span> },
                            { label: "Perlu evaluasi", value: <span className="text-red-700">{row.perlu_evaluasi ?? 0}</span> },
                            { label: "Uptime", value: `${row.uptime_pct}%` },
                          ]}
                        />
                      );
                    })}
                  </ReportCardList>
                  <Pagination
                    page={regionPage}
                    pageCount={regionPageCount}
                    total={regionTotal}
                    pageSize={regionPageSize}
                    onPageChange={setRegionPage}
                    itemLabel={groupLabel.toLowerCase()}
                    className="border-t border-gray-100"
                  />
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-800 mb-1">
                    Status per {groupLabel.toLowerCase()}
                  </div>
                  <div className="text-xs text-gray-600 mb-3">
                    Distribusi sehat, peringatan, kritis, dan tidak terhubung
                  </div>
                  {statusChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={statusChartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10 }} />
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
                    <div className="h-[320px] flex items-center text-sm text-gray-600">
                      Tidak ada data untuk filter ini
                    </div>
                  )}
                </div>
              </div>

              {/* 6. Kalender kesiapan */}
              <ReadinessCalendar readiness={report.readiness} />

              {/* 7. Lampiran analitik — sekunder, dilipat */}
              <CollapsibleSection
                title="Analitik bibit & varietas"
                subtitle="Performa varietas, throughput siklus selesai, dan aktivitas registrasi"
              >
                {varietasChartData.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-2">Distribusi & ketahanan varietas</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={varietasChartData} layout="vertical" margin={{ left: 4, right: 28 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="Screenhouse" radius={[0, 4, 4, 0]}>
                          {varietasChartData.map((_, i) => (
                            <Cell key={i} fill={VARIETAS_CHART_COLORS[i % VARIETAS_CHART_COLORS.length]} />
                          ))}
                          <HorizontalCountLabels dataKey="count" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    {report.varietas_resilience?.length > 0 && (
                      <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                        Skor rata-rata per varietas:{" "}
                        {report.varietas_resilience
                          .slice(0, 6)
                          .map((v) => `${v.nama} ${v.avg_score != null ? Math.round(v.avg_score) : "—"}`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                )}

                {report.bibit_summary && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-2">
                    <div className="text-xs font-semibold text-gray-700">Ringkasan pembibitan</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600 text-xs">Skor rata-rata</span>
                        <div className="text-xl font-bold text-emerald-800 tabular-nums">
                          {report.bibit_summary.avg_stress_score != null
                            ? Math.round(report.bibit_summary.avg_stress_score)
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600 text-xs">Varietas unik</span>
                        <div className="text-xl font-bold text-gray-800 tabular-nums">
                          {report.bibit_summary.varietas_count}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600 text-xs">Siklus selesai (periode)</span>
                        <div className="text-xl font-bold text-gray-800 tabular-nums">
                          {report.cycle_throughput?.completed_count ?? 0}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600 text-xs">Grade A / B / C</span>
                        <div className="text-sm font-semibold text-gray-800 tabular-nums mt-1">
                          {report.cycle_throughput?.grade
                            ? `${report.cycle_throughput.grade.A} / ${report.cycle_throughput.grade.B} / ${report.cycle_throughput.grade.C}`
                            : "—"}
                        </div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-emerald-100 text-sm text-gray-700 flex flex-wrap gap-x-6 gap-y-1">
                      {report.bibit_summary.most_stable_varietas && (
                        <span className="flex items-center gap-1.5">
                          <Sprout size={14} aria-hidden />
                          Varietas paling stabil:{" "}
                          <strong className="text-gray-900">{report.bibit_summary.most_stable_varietas.nama}</strong>
                          {" "}({Math.round(report.bibit_summary.most_stable_varietas.avg_score)})
                        </span>
                      )}
                      {report.cycle_throughput?.low_adoption && (
                        <span className="flex items-center gap-1.5 text-amber-800">
                          <Timer size={14} aria-hidden />
                          Data siklus selesai masih sedikit — throughput belum representatif.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {report.varietas_duration_stats?.length > 0 ? (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-2">
                      Durasi pembibitan (dari siklus yang SELESAI) vs target
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="text-table-head">
                            <th className="px-3 py-2 font-medium">Varietas</th>
                            <th className="px-3 py-2 font-medium text-center">Siklus selesai</th>
                            <th className="px-3 py-2 font-medium text-center">Rata-rata aktual</th>
                            <th className="px-3 py-2 font-medium text-center">Target</th>
                            <th className="px-3 py-2 font-medium text-center">Selisih</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.varietas_duration_stats.map((row) => (
                            <tr key={row.nama} className="border-t border-gray-100 hover:bg-slate-50/80">
                              <td className="px-3 py-2 font-medium text-gray-800">{row.nama}</td>
                              <td className="px-3 py-2 text-center tabular-nums">{row.cycle_count}</td>
                              <td className="px-3 py-2 text-center tabular-nums">
                                {row.avg_actual_days != null ? `${row.avg_actual_days} hari` : "—"}
                              </td>
                              <td className="px-3 py-2 text-center tabular-nums text-gray-600">
                                {row.avg_standard_days != null ? `${row.avg_standard_days} hari` : "—"}
                              </td>
                              <td className="px-3 py-2 text-center tabular-nums">
                                {row.delay_index_days == null ? (
                                  <span className="text-gray-500">—</span>
                                ) : row.delay_index_days > 0 ? (
                                  <span className="text-amber-700 font-semibold">+{row.delay_index_days} hari</span>
                                ) : row.delay_index_days < 0 ? (
                                  <span className="text-emerald-700 font-semibold">{row.delay_index_days} hari</span>
                                ) : (
                                  <span className="text-emerald-700 font-semibold">Tepat</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 border border-gray-100 rounded-xl px-3 py-2 bg-gray-50">
                    Durasi aktual belum bisa dihitung — belum ada siklus semai yang berstatus <em>selesai</em> pada periode ini.
                  </p>
                )}

                {(report.growth?.new_screenhouses > 0 ||
                  report.growth?.farmers_approved > 0 ||
                  report.growth?.farmers_pending > 0 ||
                  report.growth?.farmers_rejected > 0) && (
                  <div className="border-t border-gray-100 pt-3">
                    <div className="text-xs font-semibold text-gray-700 mb-2">Aktivitas registrasi dalam periode</div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                        <div className="text-xs text-gray-600">Unit screenhouse baru</div>
                        <div className="text-xl font-bold text-gray-900 tabular-nums mt-1">
                          {report.growth.new_screenhouses}
                        </div>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                        <div className="text-xs text-gray-600">Petani baru disetujui</div>
                        <div className="text-xl font-bold text-gray-900 tabular-nums mt-1">
                          {report.growth.farmers_approved}
                        </div>
                      </div>
                      <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-3">
                        <div className="text-xs text-amber-800">Menunggu approval</div>
                        <div className="text-xl font-bold text-amber-900 tabular-nums mt-1">
                          {report.growth.farmers_pending}
                        </div>
                      </div>
                      <div className="rounded-xl border border-red-100 bg-red-50/80 p-3">
                        <div className="text-xs text-red-800">Ditolak</div>
                        <div className="text-xl font-bold text-red-900 tabular-nums mt-1">
                          {report.growth.farmers_rejected}
                        </div>
                      </div>
                    </div>
                    {report.growth.note && (
                      <p className="text-xs text-gray-600 leading-relaxed mt-2">{report.growth.note}</p>
                    )}
                  </div>
                )}
              </CollapsibleSection>

              {/* 8. Diagnostik teknis — sekunder, dilipat */}
              <CollapsibleSection
                title="Diagnostik teknis"
                subtitle="Tren alert, parameter penyebab, dan rata-rata sensor per wilayah"
              >
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-800 mb-1">Tren alert harian</div>
                    <div className="text-xs text-gray-600 mb-3">
                      Jumlah alert terpicu dalam {report.period_days} hari terakhir
                    </div>
                    {alertTrendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={alertTrendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="count"
                            name="Alert"
                            stroke={CHART_STATUS.above}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          >
                            <LinePointLabels dataKey="count" />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[260px] flex items-center text-sm text-gray-600">
                        Belum ada alert dalam periode ini
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-gray-800 mb-1">Parameter alert terbanyak</div>
                    <div className="text-xs text-gray-600 mb-3">
                      Parameter yang paling sering melanggar batas aman
                    </div>
                    {paramChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={paramChartData} layout="vertical" margin={{ left: 8, right: 28 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                          <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="count" name="Jumlah alert" radius={[0, 4, 4, 0]}>
                            {paramChartData.map((_, i) => (
                              <Cell key={i} fill={i === 0 ? CHART_STATUS.above : CHART_STATUS.below} />
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
                </div>

                <div>
                  <div className="text-sm font-semibold text-gray-800 mb-2">
                    Rata-rata sensor per {groupLabel.toLowerCase()}
                  </div>
                  <div className="overflow-x-auto">
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
                        {pagedRegions.map((row) => (
                          <tr key={row.region_id} className="border-t border-gray-100 hover:bg-slate-50/80">
                            <td className="px-4 py-3 font-medium text-gray-800">{row.region_name}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                              {row.sensor_avg?.nitrogen ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                              {row.sensor_avg?.phosphorus ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                              {row.sensor_avg?.potassium ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                              {row.sensor_avg?.soil_moisture != null ? `${row.sensor_avg.soil_moisture}%` : "—"}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                              {row.sensor_avg?.soil_temperature != null ? `${row.sensor_avg.soil_temperature}°C` : "—"}
                            </td>
                            <td className="px-4 py-3 text-center tabular-nums">{row.active_alerts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2">
                    Rata-rata dihitung dari unit yang mengirim data. Kelembapan/suhu antar wilayah bukan target intervensi
                    langsung — nilai keputusan ada di kolom progres & worklist di atas.
                  </p>
                </div>
              </CollapsibleSection>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-600 font-medium text-sm">
              Gagal memuat laporan. Periksa koneksi ke server.
            </div>
          )}
        </div>

        <OperatorBottomNav />
      </div>
    </div>
  );
}

export default OperatorLaporanPage;
