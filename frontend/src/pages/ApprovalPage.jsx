import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, Phone, UserCheck, UserX, Menu, Leaf, MapPin, Map, Layers } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import MapPointPreview from "../components/MapPointPreview";
import {
  ApprovalListSkeleton,
  KpiGridSkeleton,
  TableRowsSkeleton,
} from "../components/LoadingUI";

import { API_URL } from "../config/api";

function formatWilayah(farmer) {
    return [farmer.village, farmer.district, farmer.regency, farmer.province]
        .filter(Boolean)
        .join(", ");
}

function formatCoordinates(farmer) {
    if (farmer.latitude == null || farmer.longitude == null) return "-";
    return `${Number(farmer.latitude).toFixed(5)}, ${Number(farmer.longitude).toFixed(5)}`;
}

function TrayCountField({ value, onChange, disabled }) {
    return (
        <div className="flex items-center gap-2 text-sm text-gray-600">
            <Layers size={16} className="shrink-0 text-gray-400" />
            <span className="font-semibold text-gray-700">Tray terpasang:</span>
            <input
                type="number"
                min={1}
                max={20}
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-16 h-8 px-2 border border-gray-200 rounded-lg text-sm text-gray-800 bg-white disabled:opacity-50"
            />
            <span className="text-xs text-gray-400">(1 tray = 1 sensor node)</span>
        </div>
    );
}

function ScreenhouseInfo({ farmer, trayCount, onTrayCountChange, onViewMap, busy }) {
    const wilayah = formatWilayah(farmer);
    const hasScreenhouse = Boolean(farmer.screenhouse_id || farmer.screenhouse_name);

    return (
        <div className="mt-3 p-4 rounded-xl bg-bl-surface-muted border border-bl-accent/20 space-y-2.5 text-left">
            <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                Data screenhouse pendaftaran
            </div>
            {hasScreenhouse ? (
                <>
                    <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
                        <Leaf size={18} className="text-bl-primary shrink-0" />
                        {farmer.screenhouse_name}
                    </div>
                    <div className="text-sm text-gray-600 leading-relaxed">
                        <span className="font-semibold text-gray-700">Alamat:</span>{" "}
                        {farmer.address_detail || "-"}
                    </div>
                    <div className="text-sm text-gray-600 leading-relaxed">
                        <span className="font-semibold text-gray-700">Wilayah:</span>{" "}
                        {wilayah || "-"}
                    </div>
                    <TrayCountField
                        value={trayCount}
                        onChange={onTrayCountChange}
                        disabled={busy}
                    />
                    <div className="flex items-center flex-wrap gap-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                            <MapPin size={16} className="shrink-0 text-gray-400" />
                            <span className="font-semibold text-gray-700">Koordinat:</span>{" "}
                            {formatCoordinates(farmer)}
                        </div>
                        {farmer.latitude != null && farmer.longitude != null && (
                            <button
                                type="button"
                                onClick={() => onViewMap?.(farmer)}
                                className="inline-flex items-center gap-1.5 text-bl-primary font-semibold hover:underline text-sm"
                            >
                                <Map size={16} />
                                Lihat titik di peta
                            </button>
                        )}
                    </div>
                </>
            ) : (
                <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 leading-relaxed">
                    Data screenhouse belum tersimpan. Petani perlu mengirim ulang formulir di{" "}
                    <span className="font-medium">/register/screenhouse</span> dengan nomor HP yang sama.
                </div>
            )}
        </div>
    );
}

function ApprovalPage() {
    const navigate = useNavigate();
    const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
    const [pendingUsers, setPendingUsers] = useState([]);
    const [pendingScreenhouses, setPendingScreenhouses] = useState([]);
    const [farmers, setFarmers] = useState([]);
    const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
    const [actionId, setActionId] = useState(null);
    const [shActionId, setShActionId] = useState(null);
    const [mapPreview, setMapPreview] = useState(null);
    const [trayCounts, setTrayCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem("user"));
    const token = localStorage.getItem("token");

    const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [pendingRes, farmersRes, statsRes, pendingShRes] = await Promise.all([
                fetch(`${API_URL}/auth/pending`, { headers: authHeaders }),
                fetch(`${API_URL}/auth/farmers`, { headers: authHeaders }),
                fetch(`${API_URL}/auth/stats`, { headers: authHeaders }),
                fetch(`${API_URL}/screenhouses/pending`, { headers: authHeaders }),
            ]);

            const pendingData = pendingRes.ok ? await pendingRes.json() : [];
            const farmersData = farmersRes.ok ? await farmersRes.json() : [];
            const statsData = statsRes.ok ? await statsRes.json() : {};
            const pendingShData = pendingShRes.ok ? await pendingShRes.json() : [];

            setPendingUsers(Array.isArray(pendingData) ? pendingData : []);
            setPendingScreenhouses(Array.isArray(pendingShData) ? pendingShData : []);
            setFarmers(Array.isArray(farmersData) ? farmersData : []);

            const nextTrayCounts = {};
            (Array.isArray(pendingData) ? pendingData : []).forEach((f) => {
                nextTrayCounts[`u-${f.id}`] = f.tray_count ?? 1;
            });
            (Array.isArray(pendingShData) ? pendingShData : []).forEach((sh) => {
                nextTrayCounts[`s-${sh.id}`] = sh.tray_count ?? 1;
            });
            setTrayCounts(nextTrayCounts);

            setStats({
                pending: statsData.pending ?? 0,
                approved: statsData.approved ?? 0,
                rejected: statsData.rejected ?? 0,
            });
            window.dispatchEvent(new Event("approval-changed"));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [authHeaders]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const getTrayCount = (key, fallback = 1) => {
        const val = trayCounts[key] ?? fallback;
        const n = Number(val);
        return Number.isInteger(n) && n >= 1 && n <= 20 ? n : fallback;
    };

    const approveUser = async (farmer) => {
        if (!farmer.screenhouse_id && !farmer.screenhouse_name) {
            alert("Tidak bisa disetujui: data screenhouse belum ada.");
            return;
        }

        const trayCount = getTrayCount(`u-${farmer.id}`, farmer.tray_count ?? 1);

        if (!window.confirm(`Setujui pendaftaran ${farmer.name} dengan ${trayCount} tray?`)) return;

        setActionId(farmer.id);
        try {
            const response = await fetch(`${API_URL}/auth/${farmer.id}/approve`, {
                method: "PATCH",
                headers: { ...authHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({ tray_count: trayCount }),
            });
            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Gagal menyetujui pendaftaran");
                return;
            }

            await loadData();
        } catch (err) {
            console.error(err);
            alert("Gagal menyetujui pendaftaran");
        } finally {
            setActionId(null);
        }
    };

    const rejectUser = async (farmer) => {
        if (!window.confirm(`Tolak pendaftaran ${farmer.name}? Data pending akan dihapus.`)) return;

        setActionId(farmer.id);
        try {
            const response = await fetch(`${API_URL}/auth/${farmer.id}/reject`, {
                method: "PATCH",
                headers: authHeaders,
            });
            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Gagal menolak pendaftaran");
                return;
            }

            await loadData();
        } catch (err) {
            console.error(err);
            alert("Gagal menolak pendaftaran");
        } finally {
            setActionId(null);
        }
    };

    const approveScreenhouse = async (sh) => {
        const trayCount = getTrayCount(`s-${sh.id}`, sh.tray_count ?? 1);

        if (!window.confirm(`Setujui screenhouse "${sh.name}" milik ${sh.owner_name} dengan ${trayCount} tray?`)) return;

        setShActionId(sh.id);
        try {
            const response = await fetch(`${API_URL}/screenhouses/${sh.id}/approve`, {
                method: "PATCH",
                headers: { ...authHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({ tray_count: trayCount }),
            });
            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Gagal menyetujui screenhouse");
                return;
            }

            await loadData();
        } catch (err) {
            console.error(err);
            alert("Gagal menyetujui screenhouse");
        } finally {
            setShActionId(null);
        }
    };

    const rejectScreenhouse = async (sh) => {
        if (!window.confirm(`Tolak pengajuan "${sh.name}" milik ${sh.owner_name}?`)) return;

        setShActionId(sh.id);
        try {
            const response = await fetch(`${API_URL}/screenhouses/${sh.id}/reject`, {
                method: "PATCH",
                headers: authHeaders,
            });
            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Gagal menolak screenhouse");
                return;
            }

            await loadData();
        } catch (err) {
            console.error(err);
            alert("Gagal menolak screenhouse");
        } finally {
            setShActionId(null);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString("id-ID", {
            day: "numeric", month: "short", year: "numeric",
        });
    };

    const statusBadge = (status) => {
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
    };

    return (
        <div className="app-shell fixed inset-0 flex bg-bl-surface overflow-hidden text-left">
            <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} role={user?.role} user={user} />

            <div className="flex-1 flex flex-col overflow-hidden min-w-0 text-left">
                <header className="app-topbar h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3 text-left min-w-0">
                        <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-gray-100 transition shrink-0" aria-label="Toggle sidebar">
                            <Menu size={20} className="text-gray-500" />
                        </button>
                        <div className="text-left min-w-0">
                            <div className="text-sm font-semibold text-gray-800 truncate">Approval registrasi petani</div>
                            <div className="text-xs text-gray-400 truncate hidden sm:block">Verifikasi pendaftaran petani baru dan pengajuan screenhouse tambahan</div>
                        </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 bg-green-50 text-green-800 text-xs font-medium px-3 py-1.5 rounded-full shrink-0">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Online
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-left">

                    {loading ? (
                        <>
                            <KpiGridSkeleton count={3} className="grid-cols-3" />
                            <ApprovalListSkeleton count={2} />
                            <div className="text-sm font-semibold text-gray-800 text-left">Petani terdaftar</div>
                            <div className="bg-white rounded-2xl border border-bl-accent/20 overflow-hidden">
                                <table className="w-full min-w-[720px]">
                                    <tbody>
                                        <TableRowsSkeleton rows={5} />
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                    <>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {[
                            { label: "Menunggu", fullLabel: "Menunggu approval", value: stats.pending, icon: ClipboardCheck, bg: "bg-amber-50", color: "text-amber-700", valColor: "text-amber-700" },
                            { label: "Disetujui", fullLabel: "Disetujui", value: stats.approved, icon: UserCheck, bg: "bg-bl-surface-muted", color: "text-bl-primary", valColor: "text-bl-primary" },
                            { label: "Ditolak", fullLabel: "Ditolak", value: stats.rejected, icon: UserX, bg: "bg-red-50", color: "text-red-600", valColor: "text-red-600" },
                        ].map((s) => (
                            <div key={s.fullLabel} className="bg-white rounded-xl sm:rounded-2xl border border-bl-accent/20 p-2.5 sm:p-4 flex flex-col items-center text-center sm:flex-row sm:items-center sm:gap-3 sm:text-left min-w-0">
                                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${s.bg}`}>
                                    <s.icon size={15} className={`sm:hidden ${s.color}`} />
                                    <s.icon size={17} className={`hidden sm:block ${s.color}`} />
                                </div>
                                <div className="min-w-0 mt-1.5 sm:mt-0">
                                    <div className={`text-lg sm:text-xl font-bold leading-none ${s.valColor}`}>{s.value}</div>
                                    <div className="text-[10px] sm:text-xs text-gray-400 mt-1 leading-tight truncate w-full" title={s.fullLabel}>
                                        <span className="sm:hidden">{s.label}</span>
                                        <span className="hidden sm:inline">{s.fullLabel}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {pendingScreenhouses.length > 0 && (
                        <>
                            <div className="text-sm font-semibold text-gray-800 text-left">
                                Pengajuan screenhouse baru
                            </div>
                            <div className="space-y-2">
                                {pendingScreenhouses.map((sh) => {
                                    const busy = shActionId === sh.id;
                                    const wilayah = [sh.village, sh.district, sh.regency, sh.province]
                                        .filter(Boolean)
                                        .join(", ");

                                    return (
                                        <div
                                            key={sh.id}
                                            className="bg-white rounded-2xl border border-bl-accent/20 border-l-[3px] border-l-bl-accent overflow-hidden text-left"
                                        >
                                            <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <div className="text-sm font-semibold text-gray-800">
                                                            {sh.name}
                                                        </div>
                                                        <span className="px-2 py-0.5 rounded-full bg-bl-surface-muted text-bl-primary text-[10px] font-medium">
                                                            Screenhouse tambahan
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-gray-600 leading-relaxed mt-1.5">
                                                        <span className="font-semibold text-gray-700">Pemilik:</span>{" "}
                                                        <span className="font-semibold text-gray-800">{sh.owner_name}</span>
                                                        {" · "}
                                                        {sh.owner_phone ?? "-"}
                                                    </div>
                                                    <div className="mt-3 p-4 rounded-xl bg-bl-surface-muted border border-bl-accent/20 space-y-2 text-left">
                                                        <div className="text-sm text-gray-600 leading-relaxed">
                                                            <span className="font-semibold text-gray-700">Alamat:</span>{" "}
                                                            {sh.address_detail || "-"}
                                                        </div>
                                                        <div className="text-sm text-gray-600 leading-relaxed">
                                                            <span className="font-semibold text-gray-700">Wilayah:</span>{" "}
                                                            {wilayah || "-"}
                                                        </div>
                                                        <TrayCountField
                                                            value={getTrayCount(`s-${sh.id}`, sh.tray_count ?? 1)}
                                                            onChange={(n) =>
                                                                setTrayCounts((prev) => ({ ...prev, [`s-${sh.id}`]: n }))
                                                            }
                                                            disabled={busy}
                                                        />
                                                        <div className="flex items-center flex-wrap gap-2 text-sm text-gray-600">
                                                            <div className="flex items-center gap-1.5">
                                                                <MapPin size={16} className="shrink-0 text-gray-400" />
                                                                <span className="font-semibold text-gray-700">Koordinat:</span>{" "}
                                                                {sh.latitude != null && sh.longitude != null
                                                                    ? `${Number(sh.latitude).toFixed(5)}, ${Number(sh.longitude).toFixed(5)}`
                                                                    : "-"}
                                                            </div>
                                                            {sh.latitude != null && sh.longitude != null && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setMapPreview({
                                                                            latitude: Number(sh.latitude),
                                                                            longitude: Number(sh.longitude),
                                                                            title: sh.name,
                                                                            subtitle: wilayah,
                                                                        })
                                                                    }
                                                                    className="inline-flex items-center gap-1.5 text-bl-primary font-semibold hover:underline"
                                                                >
                                                                    <Map size={16} />
                                                                    Lihat titik di peta
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-gray-400 mt-2 text-left">
                                                        Diajukan {formatDate(sh.created_at)}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 w-full sm:w-auto sm:shrink-0">
                                                    <button
                                                        onClick={() => approveScreenhouse(sh)}
                                                        disabled={busy}
                                                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl bg-bl-primary hover:bg-bl-primary-hover text-white text-xs font-medium transition disabled:opacity-50"
                                                    >
                                                        <UserCheck size={14} />
                                                        {busy ? "..." : "Setujui"}
                                                    </button>
                                                    <button
                                                        onClick={() => rejectScreenhouse(sh)}
                                                        disabled={busy}
                                                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-xs font-medium transition disabled:opacity-50"
                                                    >
                                                        <UserX size={14} />
                                                        {busy ? "..." : "Tolak"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {pendingUsers.length > 0 && (
                        <>
                            <div className="text-sm font-semibold text-gray-800 text-left">Pendaftaran petani baru</div>
                            <div className="space-y-2">
                                {pendingUsers.map((farmer) => {
                                    const busy = actionId === farmer.id;
                                    const canApprove = Boolean(farmer.screenhouse_id || farmer.screenhouse_name);

                                    return (
                                        <div key={farmer.id} className="bg-white rounded-2xl border border-bl-accent/20 border-l-[3px] border-l-amber-400 overflow-hidden text-left">
                                            <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="text-base font-semibold text-gray-800">{farmer.name}</div>
                                                    <div className="flex items-center gap-2 mt-1.5 text-sm text-gray-600">
                                                        <Phone size={16} className="shrink-0 text-gray-400" />
                                                        {farmer.phone_number ?? farmer.phone ?? "-"}
                                                    </div>
                                                    <ScreenhouseInfo
                                                        farmer={farmer}
                                                        trayCount={getTrayCount(`u-${farmer.id}`, farmer.tray_count ?? 1)}
                                                        onTrayCountChange={(n) =>
                                                            setTrayCounts((prev) => ({ ...prev, [`u-${farmer.id}`]: n }))
                                                        }
                                                        busy={busy}
                                                        onViewMap={(f) =>
                                                            setMapPreview({
                                                                latitude: Number(f.latitude),
                                                                longitude: Number(f.longitude),
                                                                title: f.screenhouse_name || f.name,
                                                                subtitle: formatWilayah(f),
                                                            })
                                                        }
                                                    />
                                                    <div className="text-xs text-gray-400 mt-2 text-left">
                                                        Mendaftar {formatDate(farmer.created_at)}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 w-full sm:w-auto sm:shrink-0">
                                                    <button
                                                        onClick={() => approveUser(farmer)}
                                                        disabled={busy || !canApprove}
                                                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl bg-bl-primary hover:bg-bl-primary-hover text-white text-xs font-medium transition disabled:opacity-50"
                                                    >
                                                        <UserCheck size={14} />
                                                        {busy ? "..." : "Setujui"}
                                                    </button>
                                                    <button
                                                        onClick={() => rejectUser(farmer)}
                                                        disabled={busy}
                                                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-xs font-medium transition disabled:opacity-50"
                                                    >
                                                        <UserX size={14} />
                                                        {busy ? "..." : "Tolak"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {pendingUsers.length === 0 && pendingScreenhouses.length === 0 && (
                        <div className="bg-white rounded-2xl border border-bl-accent/20 p-6 text-left text-sm text-gray-400">
                            Tidak ada pendaftaran atau pengajuan screenhouse yang menunggu approval
                        </div>
                    )}

                    {pendingUsers.length === 0 && pendingScreenhouses.length > 0 && (
                        <div className="bg-white rounded-2xl border border-bl-accent/20 p-4 text-left text-sm text-gray-400">
                            Tidak ada pendaftaran petani baru. Lihat pengajuan screenhouse tambahan di atas.
                        </div>
                    )}

                    <div className="text-sm font-semibold text-gray-800 text-left">Petani terdaftar</div>

                    <div className="bg-white rounded-2xl border border-bl-accent/20 overflow-hidden text-left">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px]">
                                <thead>
                                    <tr className="border-b border-gray-100">
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 w-12">No</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Nama</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">No HP</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Screenhouse</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Terdaftar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {farmers.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-6 text-left text-sm text-gray-400">
                                                Belum ada petani terdaftar
                                            </td>
                                        </tr>
                                    ) : (
                                        farmers.map((farmer, index) => (
                                            <tr key={farmer.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition text-left">
                                                <td className="px-4 py-3 text-xs text-gray-500">{index + 1}</td>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-800">{farmer.name}</td>
                                                <td className="px-4 py-3 text-xs text-gray-600">{farmer.phone_number ?? "-"}</td>
                                                <td className="px-4 py-3 text-xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/operator/approval/petani/${farmer.id}`)}
                                                        className="text-bl-primary font-medium hover:underline"
                                                    >
                                                        {farmer.screenhouse_count ?? 0} screenhouse
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3">{statusBadge(farmer.status)}</td>
                                                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(farmer.created_at)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    </>
                    )}

                </div>
            </div>

            <MapPointPreview
                open={Boolean(mapPreview)}
                onClose={() => setMapPreview(null)}
                latitude={mapPreview?.latitude}
                longitude={mapPreview?.longitude}
                title={mapPreview?.title}
                subtitle={mapPreview?.subtitle}
            />
        </div>
    );
}

export default ApprovalPage;
