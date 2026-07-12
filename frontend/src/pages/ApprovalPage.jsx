import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, Phone, UserCheck, UserX, Menu, Leaf, MapPin, Map, Layers, ArrowRight } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import MapPointPreview from "../components/MapPointPreview";
import VarietasSelect from "../components/VarietasSelect";
import {
  ApprovalListSkeleton,
  KpiGridSkeleton,
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
            <Layers size={16} className="shrink-0 text-gray-600" />
            <span className="font-semibold text-gray-700">Jumlah rak bibit:</span>
            <input
                type="number"
                min={1}
                max={20}
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-16 h-8 px-2 border border-gray-200 rounded-lg text-sm text-gray-800 bg-white disabled:opacity-50"
            />
            <span className="text-xs text-gray-600">(1 rak bibit = 1 alat pengukur)</span>
        </div>
    );
}

function ApprovalCardFooter({ dateLabel, busy, canApprove = true, onReject, onApprove }) {
    return (
        <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-gray-600 font-medium">{dateLabel}</div>
            <div className="flex gap-2 w-full sm:w-auto">
                <button
                    type="button"
                    onClick={onReject}
                    disabled={busy}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-sm font-medium transition disabled:opacity-50"
                >
                    <UserX size={16} />
                    {busy ? "..." : "Tolak"}
                </button>
                <button
                    type="button"
                    onClick={onApprove}
                    disabled={busy || !canApprove}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-bl-primary hover:bg-bl-primary-hover text-white text-sm font-medium transition disabled:opacity-50"
                >
                    {busy ? "..." : "Setujui"}
                    {!busy && <ArrowRight size={16} />}
                </button>
            </div>
        </div>
    );
}

function ApprovalConfirmDialog({ dialog, busy, onCancel, onConfirm }) {
    if (!dialog) return null;

    const confirmLabel =
        dialog.action === "approve"
            ? busy
                ? "Memproses..."
                : "Ya, setujui"
            : busy
            ? "Memproses..."
            : "Ya, tolak";

    const confirmClass =
        dialog.action === "approve"
            ? "bg-bl-primary hover:bg-bl-primary-hover text-white disabled:opacity-50"
            : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50";

    return (
        <div
            className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4 bg-black/40"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-confirm-title"
        >
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm p-5 text-left">
                <div id="approval-confirm-title" className="text-sm font-semibold text-gray-800">
                    {dialog.title}
                </div>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{dialog.message}</p>
                <div className="flex gap-2 mt-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${confirmClass}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ScreenhouseInfo({ farmer, trayCount, onTrayCountChange, varietasId, onVarietasChange, onViewMap, busy, token }) {
    const wilayah = formatWilayah(farmer);
    const hasScreenhouse = Boolean(farmer.screenhouse_id || farmer.screenhouse_name);

    return (
        <div className="mt-3 p-4 rounded-xl bg-bl-surface-muted border border-bl-accent/20 space-y-2.5 text-left">
            <div className="text-xs uppercase tracking-wide text-gray-600 font-semibold">
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
                    <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-gray-700">
                            Varietas bibit
                            {farmer.varietas_nama && (
                                <span className="font-normal text-gray-600 ml-1">
                                    (diajukan: {farmer.varietas_nama})
                                </span>
                            )}
                        </div>
                        <VarietasSelect
                            compact
                            token={token}
                            value={varietasId}
                            onChange={onVarietasChange}
                            disabled={busy}
                            required
                        />
                    </div>
                    <div className="flex items-center flex-wrap gap-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                            <MapPin size={16} className="shrink-0 text-gray-600" />
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
    const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
    const [pendingUsers, setPendingUsers] = useState([]);
    const [pendingScreenhouses, setPendingScreenhouses] = useState([]);
    const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
    const [actionId, setActionId] = useState(null);
    const [shActionId, setShActionId] = useState(null);
    const [mapPreview, setMapPreview] = useState(null);
    const [trayCounts, setTrayCounts] = useState({});
    const [varietasSelections, setVarietasSelections] = useState({});
    const [loading, setLoading] = useState(true);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const user = JSON.parse(localStorage.getItem("user"));
    const token = localStorage.getItem("token");

    const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [pendingRes, statsRes, pendingShRes] = await Promise.all([
                fetch(`${API_URL}/auth/pending`, { headers: authHeaders }),
                fetch(`${API_URL}/auth/stats`, { headers: authHeaders }),
                fetch(`${API_URL}/screenhouses/pending`, { headers: authHeaders }),
            ]);

            const pendingData = pendingRes.ok ? await pendingRes.json() : [];
            const statsData = statsRes.ok ? await statsRes.json() : {};
            const pendingShData = pendingShRes.ok ? await pendingShRes.json() : [];

            setPendingUsers(Array.isArray(pendingData) ? pendingData : []);
            setPendingScreenhouses(Array.isArray(pendingShData) ? pendingShData : []);

            const nextTrayCounts = {};
            const nextVarietas = {};
            (Array.isArray(pendingData) ? pendingData : []).forEach((f) => {
                nextTrayCounts[`u-${f.id}`] = f.tray_count ?? 1;
                nextVarietas[`u-${f.id}`] = f.varietas_id ?? "";
            });
            (Array.isArray(pendingShData) ? pendingShData : []).forEach((sh) => {
                nextTrayCounts[`s-${sh.id}`] = sh.tray_count ?? 1;
                nextVarietas[`s-${sh.id}`] = sh.varietas_id ?? "";
            });
            setTrayCounts(nextTrayCounts);
            setVarietasSelections(nextVarietas);

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

    const getVarietasId = (key, fallback = "") => {
        const val = varietasSelections[key] ?? fallback;
        return val === "" || val == null ? null : Number(val);
    };

    const approveUser = async (farmer) => {
        if (!farmer.screenhouse_id && !farmer.screenhouse_name) {
            alert("Tidak bisa disetujui: data screenhouse belum ada.");
            return;
        }

        const trayCount = getTrayCount(`u-${farmer.id}`, farmer.tray_count ?? 1);
        const varietasId = getVarietasId(`u-${farmer.id}`, farmer.varietas_id);

        if (!varietasId) {
            alert("Pilih varietas bibit sebelum menyetujui.");
            return;
        }

        setActionId(farmer.id);
        try {
            const response = await fetch(`${API_URL}/auth/${farmer.id}/approve`, {
                method: "PATCH",
                headers: { ...authHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({ tray_count: trayCount, varietas_id: varietasId }),
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
        const varietasId = getVarietasId(`s-${sh.id}`, sh.varietas_id);

        if (!varietasId) {
            alert("Pilih varietas bibit sebelum menyetujui.");
            return;
        }

        setShActionId(sh.id);
        try {
            const response = await fetch(`${API_URL}/screenhouses/${sh.id}/approve`, {
                method: "PATCH",
                headers: { ...authHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({ tray_count: trayCount, varietas_id: varietasId }),
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

    const requestApproveUser = (farmer) => {
        if (!farmer.screenhouse_id && !farmer.screenhouse_name) return;
        const trayCount = getTrayCount(`u-${farmer.id}`, farmer.tray_count ?? 1);
        const nodeLabel = trayCount === 1 ? "1 alat pengukur" : `${trayCount} alat pengukur`;
        setConfirmDialog({
            action: "approve",
            entity: "user",
            item: farmer,
            title: "Setujui pendaftaran?",
            message: `Yakin menyetujui pendaftaran ${farmer.name}? Screenhouse ${farmer.screenhouse_name} akan aktif dengan ${nodeLabel}.`,
        });
    };

    const requestRejectUser = (farmer) => {
        setConfirmDialog({
            action: "reject",
            entity: "user",
            item: farmer,
            title: "Tolak pendaftaran?",
            message: "Yakin menolak pendaftaran ini? Petani akan mendapat notifikasi penolakan.",
        });
    };

    const requestApproveScreenhouse = (sh) => {
        const trayCount = getTrayCount(`s-${sh.id}`, sh.tray_count ?? 1);
        const nodeLabel = trayCount === 1 ? "1 alat pengukur" : `${trayCount} alat pengukur`;
        setConfirmDialog({
            action: "approve",
            entity: "screenhouse",
            item: sh,
            title: "Setujui pengajuan screenhouse?",
            message: `Yakin menyetujui pengajuan ${sh.name}? Screenhouse akan aktif dengan ${nodeLabel}.`,
        });
    };

    const requestRejectScreenhouse = (sh) => {
        setConfirmDialog({
            action: "reject",
            entity: "screenhouse",
            item: sh,
            title: "Tolak pengajuan screenhouse?",
            message: "Yakin menolak pengajuan ini? Petani akan mendapat notifikasi penolakan.",
        });
    };

    const handleConfirmAction = async () => {
        if (!confirmDialog) return;
        const { action, entity, item } = confirmDialog;

        if (entity === "user") {
            if (action === "approve") await approveUser(item);
            else await rejectUser(item);
        } else if (action === "approve") {
            await approveScreenhouse(item);
        } else {
            await rejectScreenhouse(item);
        }

        setConfirmDialog(null);
    };

    const confirmBusy = confirmDialog
        ? confirmDialog.entity === "user"
            ? actionId === confirmDialog.item?.id
            : shActionId === confirmDialog.item?.id
        : false;

    const formatDate = (dateStr) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString("id-ID", {
            day: "numeric", month: "short", year: "numeric",
        });
    };

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
                            <div className="text-sm font-semibold text-gray-800 truncate">Approval registrasi petani</div>
                            <div className="text-xs text-gray-600 truncate hidden sm:block">Verifikasi pendaftaran petani baru dan pengajuan screenhouse tambahan</div>
                        </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 bg-green-50 text-green-800 text-xs font-medium px-3 py-1.5 rounded-full shrink-0">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Siap pantau
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-left">

                    {loading ? (
                        <>
                            <KpiGridSkeleton count={3} className="grid-cols-3" />
                            <ApprovalListSkeleton count={2} />
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
                                    <div className="text-[10px] sm:text-xs text-gray-600 mt-1 leading-tight truncate w-full" title={s.fullLabel}>
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
                                            <div className="p-4">
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
                                                    <div className="space-y-1.5">
                                                        <div className="text-xs font-semibold text-gray-700">
                                                            Varietas bibit
                                                            {sh.varietas_nama && (
                                                                <span className="font-normal text-gray-600 ml-1">
                                                                    (diajukan: {sh.varietas_nama})
                                                                </span>
                                                            )}
                                                        </div>
                                                        <VarietasSelect
                                                            compact
                                                            token={token}
                                                            value={varietasSelections[`s-${sh.id}`] ?? sh.varietas_id ?? ""}
                                                            onChange={(id) =>
                                                                setVarietasSelections((prev) => ({
                                                                    ...prev,
                                                                    [`s-${sh.id}`]: id,
                                                                }))
                                                            }
                                                            disabled={busy}
                                                            required
                                                        />
                                                    </div>
                                                    <div className="flex items-center flex-wrap gap-2 text-sm text-gray-600">
                                                        <div className="flex items-center gap-1.5">
                                                            <MapPin size={16} className="shrink-0 text-gray-600" />
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
                                                <ApprovalCardFooter
                                                    dateLabel={`Diajukan ${formatDate(sh.created_at)}`}
                                                    busy={busy}
                                                    onReject={() => requestRejectScreenhouse(sh)}
                                                    onApprove={() => requestApproveScreenhouse(sh)}
                                                />
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
                                            <div className="p-4">
                                                <div className="text-base font-semibold text-gray-800">{farmer.name}</div>
                                                <div className="flex items-center gap-2 mt-1.5 text-sm text-gray-600">
                                                    <Phone size={16} className="shrink-0 text-gray-600" />
                                                    {farmer.phone_number ?? farmer.phone ?? "-"}
                                                </div>
                                                <ScreenhouseInfo
                                                    farmer={farmer}
                                                    trayCount={getTrayCount(`u-${farmer.id}`, farmer.tray_count ?? 1)}
                                                    onTrayCountChange={(n) =>
                                                        setTrayCounts((prev) => ({ ...prev, [`u-${farmer.id}`]: n }))
                                                    }
                                                    varietasId={varietasSelections[`u-${farmer.id}`] ?? farmer.varietas_id ?? ""}
                                                    onVarietasChange={(id) =>
                                                        setVarietasSelections((prev) => ({
                                                            ...prev,
                                                            [`u-${farmer.id}`]: id,
                                                        }))
                                                    }
                                                    token={token}
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
                                                <ApprovalCardFooter
                                                    dateLabel={`Mendaftar ${formatDate(farmer.created_at)}`}
                                                    busy={busy}
                                                    canApprove={canApprove}
                                                    onReject={() => requestRejectUser(farmer)}
                                                    onApprove={() => requestApproveUser(farmer)}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {pendingUsers.length === 0 && pendingScreenhouses.length === 0 && (
                        <div className="bg-white rounded-2xl border border-bl-accent/20 p-6 text-left text-sm text-gray-600 space-y-2">
                            <p>Tidak ada pendaftaran atau pengajuan screenhouse yang menunggu approval.</p>
                            <Link to="/operator/petani" className="inline-block text-bl-primary font-medium hover:underline">
                                Lihat daftar petani →
                            </Link>
                        </div>
                    )}

                    {pendingUsers.length === 0 && pendingScreenhouses.length > 0 && (
                        <div className="bg-white rounded-2xl border border-bl-accent/20 p-4 text-left text-sm text-gray-600">
                            Tidak ada pendaftaran petani baru. Lihat pengajuan screenhouse tambahan di atas.
                        </div>
                    )}

                    </>
                    )}

                </div>
            </div>

            <ApprovalConfirmDialog
                dialog={confirmDialog}
                busy={confirmBusy}
                onCancel={() => !confirmBusy && setConfirmDialog(null)}
                onConfirm={handleConfirmAction}
            />

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
