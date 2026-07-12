import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Phone, UserX, Menu, Leaf, MapPin, Map, Layers, ArrowRight, Sprout, Pencil } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import MapPointPreview from "../components/MapPointPreview";
import VarietasSelect from "../components/VarietasSelect";
import useVarietasList from "../hooks/useVarietasList";
import { ApprovalListSkeleton } from "../components/LoadingUI";
import Pagination from "../components/Pagination";
import { usePagination } from "../hooks/usePagination";

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

function resolveVarietasNama(options, id, fallback = null) {
    const found = options.find((v) => String(v.id) === String(id));
    return found?.nama ?? fallback;
}

/**
 * Ringkasan "konfirmasi ajuan petani": default hanya menampilkan varietas +
 * jumlah rak yang diajukan petani sebagai teks, dengan tombol "Sesuaikan".
 * Field editable baru muncul saat operator memang perlu meng-override
 * (mis. varietas/tray berubah saat pemasangan). Otomatis terbuka bila petani
 * belum sempat mengisi varietas.
 */
function SetupConfirm({
    varietasId,
    varietasNamaProposed,
    onVarietasChange,
    trayCount,
    onTrayCountChange,
    options,
    token,
    busy,
}) {
    const hasVarietas = varietasId !== "" && varietasId != null;
    const [editing, setEditing] = useState(!hasVarietas);
    const namaTerpilih = resolveVarietasNama(options, varietasId, varietasNamaProposed);

    if (editing) {
        return (
            <div className="space-y-2.5 rounded-xl border border-bl-accent/30 bg-white/70 p-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Sesuaikan data pemasangan</span>
                    {hasVarietas && (
                        <button
                            type="button"
                            onClick={() => setEditing(false)}
                            className="text-xs font-semibold text-bl-primary hover:underline"
                        >
                            Selesai
                        </button>
                    )}
                </div>
                <TrayCountField value={trayCount} onChange={onTrayCountChange} disabled={busy} />
                <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-gray-700">
                        Varietas bibit
                        {varietasNamaProposed && (
                            <span className="font-normal text-gray-600 ml-1">
                                (diajukan: {varietasNamaProposed})
                            </span>
                        )}
                    </div>
                    <VarietasSelect
                        compact
                        token={token}
                        options={options}
                        value={varietasId}
                        onChange={onVarietasChange}
                        disabled={busy}
                        required
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-bl-accent/20 bg-white/70 p-3">
            <div className="min-w-0 space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                    <Sprout size={15} className="shrink-0 text-bl-primary" />
                    <span className="font-semibold">Varietas:</span>
                    <span className="truncate text-gray-800">{namaTerpilih || "belum dipilih"}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                    <Layers size={15} className="shrink-0 text-gray-600" />
                    <span className="font-semibold">Jumlah rak:</span>
                    <span className="text-gray-800">{trayCount}</span>
                    <span className="text-xs text-gray-500">(1 rak = 1 alat)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-gray-500">
                    Sesuai ajuan petani. Ubah bila kondisi pemasangan di lapangan berbeda.
                </p>
            </div>
            <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={busy}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-bl-primary hover:underline disabled:opacity-50"
            >
                <Pencil size={13} />
                Sesuaikan
            </button>
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

function ScreenhouseInfo({ farmer, trayCount, onTrayCountChange, varietasId, onVarietasChange, onViewMap, busy, token, varietasOptions }) {
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
                    <SetupConfirm
                        varietasId={varietasId}
                        varietasNamaProposed={farmer.varietas_nama}
                        onVarietasChange={onVarietasChange}
                        trayCount={trayCount}
                        onTrayCountChange={onTrayCountChange}
                        options={varietasOptions}
                        token={token}
                        busy={busy}
                    />
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

    // Fetch daftar varietas sekali di parent, lalu oper ke setiap kartu —
    // menghindari N request identik ke /varietas-bibit saat banyak kartu pending.
    const { list: varietasOptions } = useVarietasList(token);

    const {
        page: shPage,
        setPage: setShPage,
        pageItems: pagedPendingScreenhouses,
        pageCount: shPageCount,
        total: shTotal,
        pageSize: shPageSize,
    } = usePagination(pendingScreenhouses, 5);

    const {
        page: userPage,
        setPage: setUserPage,
        pageItems: pagedPendingUsers,
        pageCount: userPageCount,
        total: userTotal,
        pageSize: userPageSize,
    } = usePagination(pendingUsers, 5);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [pendingRes, pendingShRes] = await Promise.all([
                fetch(`${API_URL}/auth/pending`, { headers: authHeaders }),
                fetch(`${API_URL}/screenhouses/pending`, { headers: authHeaders }),
            ]);

            const pendingData = pendingRes.ok ? await pendingRes.json() : [];
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
            toast.error("Tidak bisa disetujui: data screenhouse belum ada.");
            return;
        }

        const trayCount = getTrayCount(`u-${farmer.id}`, farmer.tray_count ?? 1);
        const varietasId = getVarietasId(`u-${farmer.id}`, farmer.varietas_id);

        if (!varietasId) {
            toast.error("Pilih varietas bibit sebelum menyetujui.");
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
                toast.error(data.message || "Gagal menyetujui pendaftaran");
                return;
            }

            await loadData();
        } catch (err) {
            console.error(err);
            toast.error("Gagal menyetujui pendaftaran");
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
                toast.error(data.message || "Gagal menolak pendaftaran");
                return;
            }

            await loadData();
        } catch (err) {
            console.error(err);
            toast.error("Gagal menolak pendaftaran");
        } finally {
            setActionId(null);
        }
    };

    const approveScreenhouse = async (sh) => {
        const trayCount = getTrayCount(`s-${sh.id}`, sh.tray_count ?? 1);
        const varietasId = getVarietasId(`s-${sh.id}`, sh.varietas_id);

        if (!varietasId) {
            toast.error("Pilih varietas bibit sebelum menyetujui.");
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
                toast.error(data.message || "Gagal menyetujui screenhouse");
                return;
            }

            await loadData();
        } catch (err) {
            console.error(err);
            toast.error("Gagal menyetujui screenhouse");
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
                toast.error(data.message || "Gagal menolak screenhouse");
                return;
            }

            await loadData();
        } catch (err) {
            console.error(err);
            toast.error("Gagal menolak screenhouse");
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
                            <div className="text-sm font-semibold text-gray-800 truncate">Persetujuan pendaftaran</div>
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
                        <ApprovalListSkeleton count={2} />
                    ) : (
                    <>
                    {pendingScreenhouses.length > 0 && (
                        <>
                            <div className="text-sm font-semibold text-gray-800 text-left">
                                Pengajuan screenhouse baru
                            </div>
                            <div className="space-y-2">
                                {pagedPendingScreenhouses.map((sh) => {
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
                                                    <SetupConfirm
                                                        varietasId={varietasSelections[`s-${sh.id}`] ?? sh.varietas_id ?? ""}
                                                        varietasNamaProposed={sh.varietas_nama}
                                                        onVarietasChange={(id) =>
                                                            setVarietasSelections((prev) => ({
                                                                ...prev,
                                                                [`s-${sh.id}`]: id,
                                                            }))
                                                        }
                                                        trayCount={getTrayCount(`s-${sh.id}`, sh.tray_count ?? 1)}
                                                        onTrayCountChange={(n) =>
                                                            setTrayCounts((prev) => ({ ...prev, [`s-${sh.id}`]: n }))
                                                        }
                                                        options={varietasOptions}
                                                        token={token}
                                                        busy={busy}
                                                    />
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
                            <Pagination
                                page={shPage}
                                pageCount={shPageCount}
                                total={shTotal}
                                pageSize={shPageSize}
                                onPageChange={setShPage}
                                itemLabel="pengajuan"
                                className="bg-white rounded-2xl border border-bl-accent/20"
                            />
                        </>
                    )}

                    {pendingUsers.length > 0 && (
                        <>
                            <div className="text-sm font-semibold text-gray-800 text-left">Pendaftaran petani baru</div>
                            <div className="space-y-2">
                                {pagedPendingUsers.map((farmer) => {
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
                                                    varietasOptions={varietasOptions}
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
                            <Pagination
                                page={userPage}
                                pageCount={userPageCount}
                                total={userTotal}
                                pageSize={userPageSize}
                                onPageChange={setUserPage}
                                itemLabel="pendaftaran"
                                className="bg-white rounded-2xl border border-bl-accent/20"
                            />
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
