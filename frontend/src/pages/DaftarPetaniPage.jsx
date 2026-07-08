import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Search, Users } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import { KpiGridSkeleton, TableRowsSkeleton, ListPanelSkeleton } from "../components/LoadingUI";

import { API_URL } from "../config/api";

const STATUS_FILTERS = [
    { value: "all", label: "Semua" },
    { value: "approved", label: "Aktif" },
    { value: "pending", label: "Pending" },
    { value: "rejected", label: "Ditolak" },
];

function formatDate(dateStr) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function statusBadge(status) {
    if (status === "approved") {
        return <span className="px-2 py-0.5 rounded-full bg-bl-surface-muted text-bl-primary text-xs font-medium">Aktif</span>;
    }
    if (status === "pending") {
        return <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">Pending</span>;
    }
    if (status === "rejected") {
        return <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-medium">Ditolak</span>;
    }
    return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">{status || "-"}</span>;
}

function DaftarPetaniPage() {
    const navigate = useNavigate();
    const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
    const [farmers, setFarmers] = useState([]);
    const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const user = JSON.parse(localStorage.getItem("user"));
    const token = localStorage.getItem("token");

    const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [farmersRes, statsRes] = await Promise.all([
                fetch(`${API_URL}/auth/farmers`, { headers: authHeaders }),
                fetch(`${API_URL}/auth/stats`, { headers: authHeaders }),
            ]);

            const farmersData = farmersRes.ok ? await farmersRes.json() : [];
            const statsData = statsRes.ok ? await statsRes.json() : {};

            setFarmers(Array.isArray(farmersData) ? farmersData : []);
            setStats({
                pending: statsData.pending ?? 0,
                approved: statsData.approved ?? 0,
                rejected: statsData.rejected ?? 0,
            });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [authHeaders]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredFarmers = useMemo(() => {
        const q = search.trim().toLowerCase();
        return farmers.filter((farmer) => {
            if (statusFilter !== "all" && farmer.status !== statusFilter) return false;
            if (!q) return true;
            const name = (farmer.name ?? "").toLowerCase();
            const phone = (farmer.phone_number ?? "").toLowerCase();
            return name.includes(q) || phone.includes(q);
        });
    }, [farmers, search, statusFilter]);

    return (
        <div className="app-shell fixed inset-0 flex bg-bl-surface overflow-hidden text-left">
            <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} role={user?.role} user={user} />

            <div className="flex-1 flex flex-col overflow-hidden min-w-0 text-left">
                <header className="app-topbar h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3 text-left min-w-0">
                        <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-gray-100 transition shrink-0" aria-label="Toggle sidebar">
                            <Menu size={20} className="icon-muted" />
                        </button>
                        <div className="text-left min-w-0">
                            <div className="text-sm font-semibold text-gray-800 truncate">Daftar Petani</div>
                            <div className="text-xs text-gray-600 truncate hidden sm:block">Semua petani terdaftar dan screenhouse miliknya</div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-left">
                    {loading ? (
                        <>
                            <KpiGridSkeleton count={3} className="grid-cols-3" />
                            <div className="hidden sm:block bg-white rounded-2xl border border-bl-accent/20 overflow-hidden">
                                <table className="w-full min-w-[720px]">
                                    <tbody>
                                        <TableRowsSkeleton rows={8} />
                                    </tbody>
                                </table>
                            </div>
                            <div className="sm:hidden bg-white rounded-2xl border border-bl-accent/20 p-4">
                                <ListPanelSkeleton count={5} />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                {[
                                    { label: "Aktif", value: stats.approved, color: "text-bl-primary", bg: "bg-bl-surface-muted" },
                                    { label: "Pending", value: stats.pending, color: "text-amber-700", bg: "bg-amber-50" },
                                    { label: "Ditolak", value: stats.rejected, color: "text-red-600", bg: "bg-red-50" },
                                ].map((s) => (
                                    <div key={s.label} className="bg-white rounded-xl sm:rounded-2xl border border-bl-accent/20 p-2.5 sm:p-4 text-center sm:text-left min-w-0">
                                        <div className={`text-lg sm:text-xl font-bold leading-none ${s.color}`}>{s.value}</div>
                                        <div className="text-[10px] sm:text-xs text-gray-600 mt-1">{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                                <div className="relative flex-1 max-w-md">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Cari nama atau no HP..."
                                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-bl-primary/20"
                                    />
                                </div>
                                <div className="flex gap-1.5 flex-wrap">
                                    {STATUS_FILTERS.map((f) => (
                                        <button
                                            key={f.value}
                                            type="button"
                                            onClick={() => setStatusFilter(f.value)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                                statusFilter === f.value
                                                    ? "bg-bl-primary text-white"
                                                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-bl-accent/20 overflow-hidden text-left">
                                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                                    <Users size={16} className="text-bl-primary shrink-0" />
                                    <span className="text-sm font-semibold text-gray-800">
                                        {filteredFarmers.length} petani
                                    </span>
                                    {(search || statusFilter !== "all") && farmers.length !== filteredFarmers.length && (
                                        <span className="text-xs text-gray-500">dari {farmers.length} total</span>
                                    )}
                                </div>
                                {filteredFarmers.length === 0 ? (
                                    <div className="px-4 py-6 text-left text-sm text-gray-600">
                                        {farmers.length === 0
                                            ? "Belum ada petani terdaftar"
                                            : "Tidak ada petani yang cocok dengan filter"}
                                    </div>
                                ) : (
                                    <>
                                        {/* Tabel — layar sm ke atas */}
                                        <div className="hidden sm:block overflow-x-auto">
                                            <table className="w-full min-w-[720px]">
                                                <thead>
                                                    <tr className="border-b border-gray-100">
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 w-12">No</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Nama</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">No HP</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Screenhouse</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Status</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Terdaftar</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredFarmers.map((farmer, index) => (
                                                        <tr key={farmer.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition text-left">
                                                            <td className="px-4 py-3 text-xs text-gray-600 font-medium">{index + 1}</td>
                                                            <td className="px-4 py-3 text-sm font-medium text-gray-800">{farmer.name}</td>
                                                            <td className="px-4 py-3 text-xs text-gray-600">{farmer.phone_number ?? "-"}</td>
                                                            <td className="px-4 py-3 text-xs">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => navigate(`/operator/petani/${farmer.id}`)}
                                                                    className="text-bl-primary font-medium hover:underline"
                                                                >
                                                                    {farmer.screenhouse_count ?? 0} screenhouse
                                                                </button>
                                                            </td>
                                                            <td className="px-4 py-3">{statusBadge(farmer.status)}</td>
                                                            <td className="px-4 py-3 text-xs text-gray-600 font-medium whitespace-nowrap">{formatDate(farmer.created_at)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Kartu — layar sempit di bawah sm */}
                                        <div className="sm:hidden divide-y divide-gray-100">
                                            {filteredFarmers.map((farmer, index) => (
                                                <div key={farmer.id} className="p-4 flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="text-xs text-gray-500">#{index + 1}</div>
                                                        <div className="text-sm font-medium text-gray-800 truncate">{farmer.name}</div>
                                                        <div className="text-xs text-gray-600 mt-0.5">{farmer.phone_number ?? "-"}</div>
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(`/operator/petani/${farmer.id}`)}
                                                            className="text-xs text-bl-primary font-medium hover:underline mt-1"
                                                        >
                                                            {farmer.screenhouse_count ?? 0} screenhouse
                                                        </button>
                                                        <div className="text-[11px] text-gray-500 mt-1">Terdaftar {formatDate(farmer.created_at)}</div>
                                                    </div>
                                                    <div className="shrink-0">{statusBadge(farmer.status)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default DaftarPetaniPage;
