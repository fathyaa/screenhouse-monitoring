import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserCheck,
  Leaf,
  Wifi,
  Users,
  ClipboardCheck,
  SlidersHorizontal,
  Map,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import AdminPageShell from "../components/AdminPageShell";
import { KpiGridSkeleton } from "../components/LoadingUI";
import { API_URL } from "../config/api";

/** Satu kartu KPI. Bila `to` diisi, seluruh kartu jadi tombol menuju halaman terkait. */
function KpiCard({ icon: Icon, label, value, hint, tone = "neutral", to, onNavigate }) {
  const tones = {
    amber: "text-amber-600 bg-amber-50",
    green: "text-bl-primary bg-bl-surface-muted",
    slate: "text-slate-500 bg-slate-100",
    neutral: "text-gray-600 bg-gray-100",
  };
  const clickable = Boolean(to);
  const Wrapper = clickable ? "button" : "div";

  return (
    <Wrapper
      type={clickable ? "button" : undefined}
      onClick={clickable ? () => onNavigate(to) : undefined}
      className={`text-left bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-3 ${
        clickable ? "hover:border-bl-accent/40 hover:shadow-sm transition cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon size={18} aria-hidden />
        </span>
        {clickable && <ArrowRight size={15} className="text-gray-400" aria-hidden />}
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{value}</div>
        <div className="text-xs font-medium text-gray-700 mt-1.5">{label}</div>
        {hint && <div className="text-[11px] text-gray-500 mt-0.5">{hint}</div>}
      </div>
    </Wrapper>
  );
}

const QUICK_LINKS = [
  { icon: Users, label: "Kelola User", desc: "Tambah, ubah, atur peran akun", to: "/admin/kelola-user" },
  { icon: Leaf, label: "Kelola Screenhouse", desc: "Status & data semua screenhouse", to: "/admin/kelola-screenhouse" },
  { icon: SlidersHorizontal, label: "Kelola Batas Aman", desc: "Threshold sensor per screenhouse", to: "/admin/kelola-threshold" },
  { icon: ClipboardCheck, label: "Approval Petani", desc: "Tinjau pengajuan yang menunggu", to: "/operator/approval" },
  { icon: Map, label: "Dashboard Operator", desc: "Peta & pemantauan realtime", to: "/operator" },
];

export default function AdminOverviewPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [approvalRes, operatorRes] = await Promise.all([
        fetch(`${API_URL}/auth/stats`, { headers: authHeaders }),
        fetch(`${API_URL}/screenhouses/operator-stats`, { headers: authHeaders }),
      ]);
      if (!approvalRes.ok || !operatorRes.ok) throw new Error("stats fetch failed");
      const approval = await approvalRes.json();
      const operator = await operatorRes.json();
      setStats({ ...approval, ...operator });
    } catch (err) {
      console.error("[admin-overview] gagal memuat statistik", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const kpis = useMemo(() => {
    if (!stats) return [];
    const online = stats.online_sink_node_count ?? 0;
    const totalSink = stats.sink_node_count ?? 0;
    return [
      {
        icon: UserCheck,
        label: "Petani menunggu approval",
        value: stats.farmers_pending ?? 0,
        hint: (stats.farmers_pending ?? 0) > 0 ? "Perlu ditinjau" : "Tidak ada antrean",
        tone: (stats.farmers_pending ?? 0) > 0 ? "amber" : "green",
        to: "/operator/approval",
      },
      {
        icon: ClipboardCheck,
        label: "Pengajuan screenhouse",
        value: stats.screenhouses_pending ?? 0,
        hint: (stats.screenhouses_pending ?? 0) > 0 ? "Menunggu persetujuan" : "Tidak ada antrean",
        tone: (stats.screenhouses_pending ?? 0) > 0 ? "amber" : "green",
        to: "/operator/approval",
      },
      {
        icon: Leaf,
        label: "Screenhouse aktif",
        value: stats.screenhouse_count ?? 0,
        hint: "Sedang dipantau",
        tone: "green",
        to: "/admin/kelola-screenhouse",
      },
      {
        icon: Wifi,
        label: "Alat terhubung",
        value: totalSink > 0 ? `${online}/${totalSink}` : "0",
        hint: totalSink > 0 && online < totalSink ? `${totalSink - online} alat offline` : "Semua terhubung",
        tone: totalSink > 0 && online < totalSink ? "slate" : "green",
      },
    ];
  }, [stats]);

  return (
    <AdminPageShell
      title="Ringkasan sistem"
      subtitle={`Halo, ${user?.name || "Admin"}. Kondisi platform BibitLive hari ini.`}
    >
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800">Ringkasan</h2>
          <button
            type="button"
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} aria-hidden />
            Perbarui
          </button>
        </div>

        {loading ? (
          <KpiGridSkeleton count={4} />
        ) : error ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-700">Gagal memuat statistik sistem.</p>
            <button
              type="button"
              onClick={loadStats}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg btn-bl px-4 py-2 text-xs"
            >
              <RefreshCw size={13} aria-hidden />
              Coba lagi
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} onNavigate={navigate} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Kelola</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_LINKS.map(({ icon: Icon, label, desc, to }) => (
            <button
              key={to}
              type="button"
              onClick={() => navigate(to)}
              className="text-left bg-white rounded-2xl border border-gray-200 p-4 flex items-start gap-3 hover:border-bl-accent/40 hover:shadow-sm transition"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bl-surface-muted text-bl-primary">
                <Icon size={18} aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-800">{label}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-snug">{desc}</div>
              </div>
              <ArrowRight size={15} className="text-gray-400 shrink-0 ml-auto mt-1" aria-hidden />
            </button>
          ))}
        </div>
      </section>
    </AdminPageShell>
  );
}
