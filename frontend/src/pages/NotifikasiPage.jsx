import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Bell, TriangleAlert, CheckCircle2, Filter, Menu } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import { useAlerts, getAlertDetail } from "../context/AlertContext";
import PetaniTopbar from "../layouts/PetaniTopbar";
import { pickPrimaryAlert } from "../utils/petaniAlertNav";

function NotifikasiPage() {
    const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
    const [filter, setFilter] = useState("semua");
    const [blinkId, setBlinkId] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const highlightHandled = useRef(false);
    const user = JSON.parse(localStorage.getItem("user"));
    const { alerts, activeCount, resolvedCount, totalCount, alertsLoading, resolveAlert, refetchAlerts } = useAlerts();

    useEffect(() => {
        refetchAlerts();
    }, [refetchAlerts]);

    useEffect(() => {
        highlightHandled.current = false;
    }, [searchParams]);

    useEffect(() => {
        if (alertsLoading || highlightHandled.current) return;

        const highlightParam = searchParams.get("highlight");
        const screenhouseParam = searchParams.get("screenhouse");
        if (!highlightParam && !screenhouseParam) return;

        let targetId = highlightParam ? Number(highlightParam) : null;

        if (!targetId && screenhouseParam) {
            const matches = alerts.filter(
                (a) => String(a.screenhouse_id) === String(screenhouseParam)
            );
            targetId =
                pickPrimaryAlert(matches.filter((a) => a.status === "active"))?.id ??
                pickPrimaryAlert(matches)?.id ??
                null;
        }

        if (!targetId) {
            highlightHandled.current = true;
            setSearchParams({}, { replace: true });
            return;
        }

        const alert = alerts.find((a) => a.id === targetId);
        if (!alert) return;

        if (filter !== "semua" && alert.status !== filter) {
            setFilter("semua");
            return;
        }

        highlightHandled.current = true;

        const scrollTimer = window.setTimeout(() => {
            const el = document.getElementById(`alert-${targetId}`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                setBlinkId(targetId);
            }
            setSearchParams({}, { replace: true });

            window.setTimeout(() => setBlinkId(null), 3800);
        }, 120);

        return () => window.clearTimeout(scrollTimer);
    }, [alertsLoading, alerts, filter, searchParams, setSearchParams]);

    const filtered = filter === "semua" ? alerts : alerts.filter((a) => a.status === filter);

    return (
        <div className="app-shell fixed inset-0 flex bg-slate-100 overflow-hidden">
            <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} screenhouses={[]} role={user?.role} user={user} />

            <div className="flex-1 flex flex-col overflow-hidden min-w-0 text-left">
                <PetaniTopbar
                    onToggleSidebar={toggleSidebar}
                    title="Peringatan"
                    subtitle="Pantau dan tandai peringatan screenhouse"
                />

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

                    {/* SUMMARY */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {[
                            { label: "Total", fullLabel: "Total peringatan", value: totalCount, icon: Bell, bg: "bg-gray-50", color: "text-gray-500", valColor: "text-gray-800" },
                            { label: "Aktif", fullLabel: "Aktif", value: activeCount, icon: TriangleAlert, bg: "bg-red-50", color: "text-red-600", valColor: "text-red-600" },
                            { label: "Selesai", fullLabel: "Sudah ditangani", value: resolvedCount, icon: CheckCircle2, bg: "bg-green-50", color: "text-green-700", valColor: "text-green-700" },
                        ].map((s) => (
                            <div key={s.fullLabel} className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 p-2.5 sm:p-4 flex flex-col items-center text-center sm:flex-row sm:items-center sm:gap-3 sm:text-left min-w-0">
                                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${s.bg}`}>
                                    <s.icon size={15} className={`sm:hidden ${s.color}`} />
                                    <s.icon size={18} className={`hidden sm:block ${s.color}`} />
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

                    {/* FILTER */}
                    <div className="flex items-center gap-2">
                        <Filter size={14} className="text-gray-400" />
                        <span className="text-xs text-gray-400 mr-1">Filter:</span>
                        {[
                            { key: "semua", label: "Semua" },
                            { key: "active", label: "Aktif" },
                            { key: "resolved", label: "Sudah ditangani" },
                        ].map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === f.key ? "bg-[#1e4d2b] text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* ALERT LIST */}
                    <div className="space-y-3">
                        {alertsLoading && (
                            <div className="text-center py-12 text-gray-400">
                                <div className="text-sm">Memuat notifikasi...</div>
                            </div>
                        )}
                        {!alertsLoading && filtered.length === 0 && (
                            <div className="text-center py-12 text-gray-400">
                                <CheckCircle2 size={32} className="mx-auto mb-3 text-gray-200" />
                                <div className="text-sm">Tidak ada peringatan</div>
                            </div>
                        )}
                        {filtered.map((alert) => (
                            <div
                                key={alert.id}
                                id={`alert-${alert.id}`}
                                className={`bg-white rounded-2xl border border-gray-200 p-4 flex gap-3 items-start scroll-mt-24 ${
                                    alert.status === "active"
                                        ? "border-l-[3px] border-l-amber-400"
                                        : "border-l-[3px] border-l-green-500"
                                } ${blinkId === alert.id ? "alert-highlight-blink" : ""}`}
                            >

                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${alert.status === "active" ? "bg-amber-50" : "bg-green-50"}`}>
                                    {alert.status === "active"
                                        ? <TriangleAlert size={17} className="text-amber-600" />
                                        : <CheckCircle2 size={17} className="text-green-700" />
                                    }
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs font-medium">Perhatian</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${alert.status === "active" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                                            {alert.status === "active" ? "Aktif" : "Sudah ditangani"}
                                        </span>
                                    </div>
                                    <div className="text-sm font-semibold text-gray-800">{alert.message}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{alert.screenhouse_name}</div>
                                    <div className="text-xs text-gray-400 mt-1">
                                        {new Date(alert.created_at).toLocaleString("id-ID")}
                                    </div>

                                    <AlertValueDetail alert={alert} />

                                    {alert.status === "resolved" && alert.resolved_at && (
                                        <div className="mt-2 text-xs text-green-700 flex items-center gap-1">
                                            <CheckCircle2 size={12} />
                                            Ditangani pada {new Date(alert.resolved_at).toLocaleString("id-ID")}
                                        </div>
                                    )}
                                </div>

                                {alert.status === "active" && (
                                    <button
                                        onClick={() => resolveAlert(alert.id)}
                                        className="shrink-0 px-3 py-1.5 rounded-xl bg-[#1e4d2b] hover:bg-[#2d6e3e] text-white text-xs font-medium flex items-center gap-1.5 transition"
                                    >
                                        <CheckCircle2 size={14} />Sudah ditangani
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
}

function AlertValueDetail({ alert }) {
    const detail = getAlertDetail(alert)
    if (!detail || detail.actual === undefined || detail.actual === null) return null

    const unit = detail.unit ?? ""
    const label = detail.label
      ? detail.label.charAt(0).toUpperCase() + detail.label.slice(1)
      : detail.param

    return (
        <div className="mt-2 flex items-center gap-3 flex-wrap">
            {/* Nilai aktual */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 border border-red-100">
                <span className="text-[10px] text-red-500 uppercase tracking-wide">Aktual</span>
                <span className="text-xs font-bold text-red-700">{detail.actual} {unit}</span>
            </div>

            {/* Batas yang dilanggar */}
            {detail.isMin && detail.min !== undefined && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide">Min</span>
                    <span className="text-xs font-semibold text-gray-600">{detail.min} {unit}</span>
                </div>
            )}
            {detail.isMax && detail.max !== undefined && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide">Maks</span>
                    <span className="text-xs font-semibold text-gray-600">{detail.max} {unit}</span>
                </div>
            )}

            {/* Visual bar */}
            {detail.min !== undefined && detail.max !== undefined && (
                <div className="w-full mt-1">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>{detail.min}</span>
                        <span className="text-gray-500">Rentang normal {label}</span>
                        <span>{detail.max}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full relative overflow-hidden">
                        {/* Bar normal range */}
                        <div className="absolute h-full bg-green-200 rounded-full"
                            style={{
                                left: `${(detail.min / (detail.max * 1.5)) * 100}%`,
                                width: `${((detail.max - detail.min) / (detail.max * 1.5)) * 100}%`,
                            }}
                        />
                        {/* Marker nilai aktual */}
                        {detail.actual !== null && (
                            <div
                                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 border border-white shadow-sm"
                                style={{ left: `calc(${Math.min((detail.actual / (detail.max * 1.5)) * 100, 98)}% - 4px)` }}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default NotifikasiPage;