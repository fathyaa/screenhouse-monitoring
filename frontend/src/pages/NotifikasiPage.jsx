import { useState } from "react";
import { Bell, TriangleAlert, CheckCircle2, Filter, Menu } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import socket from "../lib/socket";

function NotifikasiPage() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [filter, setFilter] = useState("semua");

    const user = { name: "Pak Eko", role: "petani" };
    const [alerts, setAlerts] = useState([]);

    useEffect(() => {
        socket.on("alert-update",
            (alert) => {
                setAlerts((prev) => [
                    {
                        ...alert,
                        status: "aktif",
                    },
                    ...prev,
                ]);
            }
        );

        return () => {
            socket.off(
                "new-alert"
            );
        };
    }, []);

    const activeAlerts = alerts.filter(
        (a) => a.status === "aktif"
    ).length;

    const filtered = filter === "semua" ? alerts : alerts.filter((a) => a.status === filter);

    const totalAktif = alerts.filter(
        (a) => a.status === "aktif"
    ).length;

    const totalResolved = alerts.filter(
        (a) => a.status === "resolved"
    ).length;

    return (
        <div className="fixed inset-0 flex bg-slate-100 overflow-hidden">
            <Sidebar isOpen={sidebarOpen} screenhouses={[]} role={user.role} user={user} />

            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* TOPBAR */}
                <header className="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-5 z-10">
                    <div className="flex items-center gap-3">
                        <button
                            className="relative p-1.5 rounded-lg hover:bg-gray-100 transition"
                            onClick={() => setSidebarOpen(!sidebarOpen)}>
                            <Menu size={20} className="text-gray-500" />
                            {activeAlerts > 0 && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                            )}
                        </button>
                        <div>
                            <div className="text-sm font-semibold text-gray-800">Notifikasi & alert</div>
                            <div className="text-xs text-gray-400">Pantau dan kelola alert screenhouse</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-green-50 text-green-800 text-xs font-medium px-3 py-1.5 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Online
                    </div>
                </header>

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
                        {["semua", "aktif", "resolved"].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === f
                                    ? "bg-[#1e4d2b] text-white"
                                    : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
                                    }`}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* ALERT LIST */}
                    <div className="space-y-3">
                        {filtered.map((alert) => (
                            <div
                                key={alert.id}
                                className={`bg-white rounded-2xl border border-gray-200 p-4 flex gap-3 items-start ${alert.status === "aktif" ? "border-l-[3px] border-l-amber-400" : "border-l-[3px] border-l-green-500"
                                    }`}
                            >
                                {/* ICON */}
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${alert.status === "aktif" ? "bg-amber-50" : "bg-green-50"}`}>
                                    {alert.status === "aktif"
                                        ? <TriangleAlert size={17} className="text-amber-600" />
                                        : <CheckCircle2 size={17} className="text-green-700" />
                                    }
                                </div>

                                {/* BODY */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs font-medium">Perhatian</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${alert.status === "aktif" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                                            }`}>
                                            {alert.status}
                                        </span>
                                    </div>
                                    <div className="text-sm font-semibold text-gray-800">{alert.title}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{alert.screenhouse} — {alert.sensor}</div>
                                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                                        <span>Nilai: <span className="font-semibold text-gray-700">{alert.value}</span></span>
                                        <span>Batas: <span className="font-semibold text-gray-700">{alert.threshold}</span></span>
                                        <span>{alert.time}</span>
                                    </div>
                                    {alert.status === "resolved" && (
                                        <div className="mt-2 text-xs text-green-700 flex items-center gap-1">
                                            <CheckCircle2 size={12} />
                                            Resolved pada {alert.resolvedAt}
                                        </div>
                                    )}
                                </div>

                                {/* ACTION */}
                                {alert.status === "aktif" && (
                                    <button className="shrink-0 px-3 py-1.5 rounded-xl bg-[#1e4d2b] hover:bg-[#2d6e3e] text-white text-xs font-medium flex items-center gap-1.5 transition">
                                        <CheckCircle2 size={14} />
                                        Resolve
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

export default NotifikasiPage;