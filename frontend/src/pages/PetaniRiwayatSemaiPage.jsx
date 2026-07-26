import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, FileBarChart, Sprout, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import Sidebar from "../layouts/Sidebar";
import PetaniTopbar from "../layouts/PetaniTopbar";
import PetaniBottomNav from "../layouts/PetaniBottomNav";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import PullToRefresh from "../components/PullToRefresh";
import Pagination from "../components/Pagination";
import { usePagination } from "../hooks/usePagination";
import { API_URL } from "../config/api";
import { ScreenhouseCardsSkeleton } from "../components/LoadingUI";

const GRADE_STYLE = {
  A: "bg-emerald-50 text-emerald-800 border-emerald-100",
  B: "bg-amber-50 text-amber-800 border-amber-100",
  C: "bg-red-50 text-red-800 border-red-100",
};

const GRADE_LABEL = {
  A: "Sangat baik",
  B: "Cukup baik",
  C: "Perlu evaluasi",
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
  const [deleteCycle, setDeleteCycle] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  const confirmDeleteCycle = async () => {
    if (!deleteCycle) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `${API_URL}/screenhouses/${deleteCycle.screenhouse_id}/cycles/${deleteCycle.id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menghapus siklus");
      toast.success("Siklus dihapus");
      setDeleteCycle(null);
      loadData();
    } catch (err) {
      toast.error(err.message || "Gagal menghapus siklus");
    } finally {
      setDeleting(false);
    }
  };

  const {
    page,
    setPage,
    pageItems: pagedCycles,
    pageCount,
    total,
    pageSize,
  } = usePagination(displayCycles, 8, filter);

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
                  Setelah satu siklus selesai, Anda dapat melihat ringkasannya: berapa lama,
                  seberapa stabil kondisinya, dan apakah alat bekerja baik.
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
                {pagedCycles.map((cycle) => (
                  <div
                    key={cycle.id}
                    className={`w-full bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 transition ${
                      cycle.status === "completed" ? "hover:border-bl-accent/40 hover:shadow-sm" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        cycle.status === "completed" &&
                        navigate(`/petani/riwayat-semai/${cycle.screenhouse_id}/${cycle.id}`)
                      }
                      disabled={cycle.status !== "completed"}
                      className="flex-1 min-w-0 text-left disabled:cursor-default"
                    >
                      <div className="text-sm font-semibold text-gray-800 truncate">
                        {cycleTitle(cycle)}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {cycle.screenhouse_name} · {formatIdDate(cycle.tanggal_mulai)}
                        {cycle.tanggal_selesai && ` — ${formatIdDate(cycle.tanggal_selesai)}`}
                      </div>
                    </button>
                    {cycle.grade && (
                      <div className="shrink-0 flex flex-col items-end gap-0.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                            GRADE_STYLE[cycle.grade] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          Grade {cycle.grade}
                        </span>
                        {GRADE_LABEL[cycle.grade] && (
                          <span className="text-[10px] text-gray-500">{GRADE_LABEL[cycle.grade]}</span>
                        )}
                      </div>
                    )}
                    {cycle.status === "active" && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-bl-surface-muted text-bl-primary text-[10px] font-semibold">
                        Aktif
                      </span>
                    )}
                    {cycle.status === "completed" && (
                      <ChevronRight size={18} className="shrink-0 text-gray-400" />
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteCycle(cycle)}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition"
                      title="Hapus siklus"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  total={total}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  itemLabel="siklus"
                  className="bg-white rounded-2xl border border-gray-200"
                />
              </div>
            )}
          </div>
        </PullToRefresh>
        <PetaniBottomNav />
      </div>

      {deleteCycle && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm p-5 text-left">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 size={18} />
              </span>
              <div className="text-sm font-semibold text-gray-800">Hapus siklus ini?</div>
            </div>
            <p className="text-sm text-gray-600 mt-3 leading-relaxed">
              {cycleTitle(deleteCycle)} akan dihapus permanen dari riwayat
              {deleteCycle.status === "active" && " dan siklus yang sedang berjalan akan dihentikan"}.
              Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDeleteCycle(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteCycle}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {deleting ? "Menghapus..." : "Ya, hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
