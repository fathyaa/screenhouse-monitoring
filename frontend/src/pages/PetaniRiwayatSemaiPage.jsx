import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, FileBarChart, Menu, Sprout } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import PetaniTopbar from "../layouts/PetaniTopbar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import PullToRefresh from "../components/PullToRefresh";
import { API_URL } from "../config/api";
import { ScreenhouseCardsSkeleton } from "../components/LoadingUI";

const GRADE_STYLE = {
  A: "bg-emerald-50 text-emerald-800 border-emerald-100",
  B: "bg-amber-50 text-amber-800 border-amber-100",
  C: "bg-red-50 text-red-800 border-red-100",
};

function formatIdDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function cycleTitle(cycle) {
  const start = formatIdDate(cycle.tanggal_mulai);
  const monthYear = new Date(`${String(cycle.tanggal_mulai).slice(0, 10)}T12:00:00+07:00`)
    .toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  return `Siklus ${monthYear} — ${cycle.varietas_nama ?? "Varietas"}`;
}

export default function PetaniRiwayatSemaiPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const token = localStorage.getItem("token");
  const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
  const [screenhouses, setScreenhouses] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("completed");

  const loadData = useCallback(() => {
    if (!token) return Promise.resolve();
    setLoading(true);
    return Promise.all([
      fetch(`${API_URL}/screenhouses/my-screenhouses`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_URL}/screenhouses/my-cycles?status=${filter}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([sh, cyc]) => {
        setScreenhouses(Array.isArray(sh) ? sh : []);
        setCycles(Array.isArray(cyc) ? cyc : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeCycles = useMemo(
    () => cycles.filter((c) => c.status === "active"),
    [cycles]
  );
  const completedCycles = useMemo(
    () => cycles.filter((c) => c.status === "completed"),
    [cycles]
  );

  const displayCycles = filter === "active" ? activeCycles : completedCycles;

  return (
    <div className="app-shell fixed inset-0 flex bg-bl-surface overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        screenhouses={screenhouses}
        role="petani"
        user={user}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <PetaniTopbar
          onToggleSidebar={toggleSidebar}
          title="Riwayat Semai"
          subtitle="Rekap siklus pembibitan per screenhouse"
        />
        <PullToRefresh onRefresh={loadData} className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-5 max-w-4xl mx-auto space-y-5 text-left">
            <div className="flex items-start gap-3 rounded-2xl bg-white border border-gray-200 p-4">
              <FileBarChart size={20} className="shrink-0 text-bl-primary mt-0.5" />
              <div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Setiap siklus semai direkap otomatis saat diakhiri — mencakup durasi, kestabilan
                  sensor, stres tanaman, dan efisiensi peralatan otomatis.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {[
                { key: "completed", label: "Selesai" },
                { key: "active", label: "Berjalan" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    filter === key
                      ? "bg-bl-primary text-white border-bl-primary"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <ScreenhouseCardsSkeleton count={3} />
            ) : displayCycles.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                <Sprout size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-600">
                  {filter === "active"
                    ? "Tidak ada siklus semai yang sedang berjalan."
                    : "Belum ada siklus selesai. Akhiri siklus dari halaman screenhouse untuk melihat rekap."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayCycles.map((cycle) => (
                  <button
                    key={cycle.id}
                    type="button"
                    onClick={() =>
                      cycle.status === "completed" &&
                      navigate(`/petani/riwayat-semai/${cycle.screenhouse_id}/${cycle.id}`)
                    }
                    className={`w-full text-left bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 transition ${
                      cycle.status === "completed" ? "hover:border-bl-accent/40 hover:shadow-sm" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate">
                        {cycleTitle(cycle)}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {cycle.screenhouse_name} · {formatIdDate(cycle.tanggal_mulai)}
                        {cycle.tanggal_selesai && ` — ${formatIdDate(cycle.tanggal_selesai)}`}
                      </div>
                    </div>
                    {cycle.grade && (
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold border ${
                          GRADE_STYLE[cycle.grade] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        Grade {cycle.grade}
                      </span>
                    )}
                    {cycle.status === "completed" && (
                      <ChevronRight size={18} className="shrink-0 text-gray-400" />
                    )}
                    {cycle.status === "active" && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-bl-surface-muted text-bl-primary text-[10px] font-semibold">
                        Aktif
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </PullToRefresh>
      </div>
    </div>
  );
}
