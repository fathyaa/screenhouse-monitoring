import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Clock,
  Gauge,
  Menu,
  Sprout,
  Thermometer,
  Wifi,
} from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import PetaniTopbar from "../layouts/PetaniTopbar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import { API_URL } from "../config/api";
import { ScreenhouseDetailSkeleton } from "../components/LoadingUI";

const GRADE_STYLE = {
  A: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-900", badge: "bg-emerald-600" },
  B: { bg: "bg-amber-50 border-amber-200", text: "text-amber-900", badge: "bg-amber-600" },
  C: { bg: "bg-red-50 border-red-200", text: "text-red-900", badge: "bg-red-600" },
};

function formatIdDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function MetricCard({ icon: Icon, title, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
        {Icon && <Icon size={14} />}
        {title}
      </div>
      {children}
    </div>
  );
}

export default function SemaiCycleDetailPage() {
  const { screenhouseId, cycleId } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const token = localStorage.getItem("token");
  const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
  const [cycle, setCycle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API_URL}/screenhouses/${screenhouseId}/cycles/${cycleId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(setCycle)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [screenhouseId, cycleId, token]);

  const analytics = cycle?.analytics ?? {};
  const grade = analytics.grade ?? (cycle?.grade ? { letter: cycle.grade } : null);
  const gradeStyle = GRADE_STYLE[grade?.letter] ?? GRADE_STYLE.B;

  if (loading) {
    return (
      <div className="app-shell fixed inset-0 flex bg-bl-surface overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} role="petani" user={user} />
        <div className="flex-1 overflow-y-auto p-5">
          <ScreenhouseDetailSkeleton />
        </div>
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="app-shell fixed inset-0 flex bg-bl-surface overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} role="petani" user={user} />
        <div className="flex-1 flex items-center justify-center p-5">
          <p className="text-sm text-gray-600">Siklus tidak ditemukan.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell fixed inset-0 flex bg-bl-surface overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} role="petani" user={user} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <PetaniTopbar
          onToggleSidebar={toggleSidebar}
          title="Detail Rekap Siklus"
          subtitle={cycle.screenhouse_name}
          onBack={() => navigate("/petani/riwayat-semai")}
        />
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 max-w-3xl mx-auto space-y-5 text-left w-full">
          <div className={`rounded-2xl border p-5 ${gradeStyle.bg}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
                  Kesimpulan kualitas bibit
                </div>
                <div className={`text-xl font-bold mt-1 ${gradeStyle.text}`}>
                  Grade {grade?.letter ?? "—"} — {grade?.title ?? "Rekap siklus"}
                </div>
                <p className={`text-sm mt-2 leading-relaxed ${gradeStyle.text} opacity-90`}>
                  {grade?.summary ?? "Rekap analytics tersedia setelah siklus diakhiri."}
                </p>
              </div>
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 ${gradeStyle.badge}`}
              >
                {grade?.letter ?? "?"}
              </div>
            </div>
            <div className="mt-4 text-sm opacity-90">
              <strong>{cycle.varietas_nama}</strong> · {formatIdDate(cycle.tanggal_mulai)}
              {cycle.tanggal_selesai && ` — ${formatIdDate(cycle.tanggal_selesai)}`}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MetricCard icon={Clock} title="Akurasi waktu">
              <div className="text-lg font-bold text-gray-900">
                {analytics.durasi?.aktual_hari ?? "—"} hari
                {analytics.durasi?.target_hari != null && (
                  <span className="text-sm font-normal text-gray-600">
                    {" "}
                    / target {analytics.durasi.target_hari} hari
                  </span>
                )}
              </div>
              {analytics.durasi?.label && (
                <p className="text-xs text-gray-600 mt-1">{analytics.durasi.label}</p>
              )}
            </MetricCard>

            <MetricCard icon={Wifi} title="Keandalan perangkat">
              <div className="text-lg font-bold text-gray-900">
                {analytics.uptime?.pct ?? "—"}% online
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Offline ~{analytics.uptime?.offline_pct ?? 0}% dari masa pembibitan
              </p>
            </MetricCard>
          </div>

          {analytics.stability?.length > 0 && (
            <MetricCard icon={Gauge} title="Kestabilan parameter">
              <div className="space-y-2.5">
                {analytics.stability.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-700">
                      {item.icon} {item.label}
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-900">{item.pct}%</span>
                      <span className="text-[11px] text-gray-600 ml-1">({item.quality})</span>
                    </div>
                  </div>
                ))}
              </div>
            </MetricCard>
          )}

          {analytics.stress && (
            <MetricCard icon={Thermometer} title="Akumulasi durasi stres">
              <div className="text-lg font-bold text-gray-900">
                {analytics.stress.total_label ?? "—"}
              </div>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                {analytics.stress.summary}
              </p>
              {analytics.stress.breakdown?.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {analytics.stress.breakdown.map((b) => (
                    <li key={b.key} className="text-xs text-gray-600">
                      · {b.label}: {b.label_duration} ({b.note})
                    </li>
                  ))}
                </ul>
              )}
            </MetricCard>
          )}

          {analytics.actuators?.length > 0 && (
            <MetricCard icon={Bot} title="Korelasi otomatisasi">
              <div className="space-y-2">
                {analytics.actuators.map((a) => (
                  <p key={a.key} className="text-sm text-gray-700 leading-relaxed">
                    {a.summary}
                  </p>
                ))}
              </div>
            </MetricCard>
          )}

          {cycle.catatan && (
            <div className="rounded-2xl bg-slate-50 border border-gray-200 p-4 text-sm text-gray-700">
              <span className="font-semibold">Catatan petani:</span> {cycle.catatan}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
