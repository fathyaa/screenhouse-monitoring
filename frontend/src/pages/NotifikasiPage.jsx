import { useState } from "react";
import { Bell, TriangleAlert, CheckCircle2, Filter, Menu } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import { useAlerts, getAlertDetail } from "../context/AlertContext";
import PetaniTopbar from "../layouts/PetaniTopbar";

function NotifikasiPage() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [filter, setFilter] = useState("semua");
    const user = JSON.parse(localStorage.getItem("user"));
    const { alerts, activeCount, resolveAlert } = useAlerts();

    const filtered = filter === "semua" ? alerts : alerts.filter((a) => a.status === filter);
    const totalAktif = alerts.filter((a) => a.status === "active").length;
    const totalResolved = alerts.filter((a) => a.status === "resolved").length;

    return (
        <div className="fixed inset-0 flex bg-slate-100 overflow-hidden">
            <Sidebar isOpen={sidebarOpen} screenhouses={[]} role={user?.role} user={user} />

            <div className="flex-1 flex flex-col overflow-hidden min-w-0 text-left">

                {/* TOPBAR */}
                <PetaniTopbar
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    title="Notifikasi & alert"
                    subtitle="Pantau dan kelola alert screenhouse"
                    activeAlerts={activeCount}
                />

                <div className="flex-1 overflow-y-auto p-5 space-y-4">

                    {/* SUMMARY */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: "Total alert", value: alerts.length, icon: Bell, bg: "bg-gray-50", color: "text-gray-500" },
                            { label: "Aktif", value: totalAktif, icon: TriangleAlert, bg: "bg-red-50", color: "text-red-600" },
                            { label: "Resolved", value: totalResolved, icon: CheckCircle2, bg: "bg-green-50", color: "text-green-700" },
                        ].map((s) => (
                            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.bg}`}>
                                    <s.icon size={18} className={s.color} />
                                </div>
                                <div>
                                    <div className="text-xl font-bold text-gray-800">{s.value}</div>
                                    <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
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
                            { key: "resolved", label: "Resolved" },
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
                        {filtered.length === 0 && (
                            <div className="text-center py-12 text-gray-400">
                                <CheckCircle2 size={32} className="mx-auto mb-3 text-gray-200" />
                                <div className="text-sm">Tidak ada alert</div>
                            </div>
                        )}
                        {filtered.map((alert) => (
                            <div key={alert.id} className={`bg-white rounded-2xl border border-gray-200 p-4 flex gap-3 items-start ${alert.status === "active" ? "border-l-[3px] border-l-amber-400" : "border-l-[3px] border-l-green-500"}`}>

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
                                            {alert.status === "active" ? "Aktif" : "Resolved"}
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
                                            Resolved pada {new Date(alert.resolved_at).toLocaleString("id-ID")}
                                        </div>
                                    )}
                                </div>

                                {alert.status === "active" && (
                                    <button
                                        onClick={() => resolveAlert(alert.id)}
                                        className="shrink-0 px-3 py-1.5 rounded-xl bg-[#1e4d2b] hover:bg-[#2d6e3e] text-white text-xs font-medium flex items-center gap-1.5 transition"
                                    >
                                        <CheckCircle2 size={14} />Resolve
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

    const PARAM_LABELS = {
        nitrogen: "Nitrogen",
        phosphorus: "Phosphorus",
        potassium: "Potassium",
        moisture: "Kelembapan",
    }

    const PARAM_UNITS = {
        nitrogen: "mg/kg",
        phosphorus: "mg/kg",
        potassium: "mg/kg",
        moisture: "%",
    }

    const unit = PARAM_UNITS[detail.param] ?? ""
    const label = PARAM_LABELS[detail.param] ?? detail.param

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