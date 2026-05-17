import { useState, useEffect } from "react";
import { ClipboardCheck, Phone, CreditCard, UserCheck, UserX, Menu } from "lucide-react";
import Sidebar from "../layouts/Sidebar";

function ApprovalPage() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const user = JSON.parse(
        localStorage.getItem("user")
    );

    const [pendingUsers, setPendingUsers] = useState([]);
    const [approvedUsers, setApprovedUsers] = useState([]);

    useEffect(() => {
        const token = localStorage.getItem("token");
        fetch("http://localhost:3004/auth/users/pending", {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then(setPendingUsers);

        fetch("http://localhost:3004/auth/users/approved", {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then(setApprovedUsers);

    }, []);

    const approveUser = async (id) => {
        try {
            const token = localStorage.getItem("token");

            await fetch(`http://localhost:3004/auth/users/${id}/approve`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            });

            setPendingUsers((prev) => prev.filter((u) => u.id !== id));

        } catch (err) {
            console.log(err);
        }
    };

    return (
        <div className="fixed inset-0 flex bg-slate-100 overflow-hidden">
            <Sidebar isOpen={sidebarOpen} screenhouses={[]} role={user.role} user={user} />

            <div className="flex-1 flex flex-col overflow-hidden min-w-0">

                {/* TOPBAR */}
                <header className="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-5 z-10">
                    <div className="flex gap-3">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
                            <Menu size={20} className="text-gray-500" />
                        </button>
                        <div>
                            <div className="text-sm font-semibold text-gray-800 text-left">Approval registrasi petani</div>
                            <div className="text-xs text-gray-400">Verifikasi dan setujui pendaftaran petani baru</div>
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
                            { label: "Menunggu approval", value: pendingUsers.length, icon: ClipboardCheck, bg: "bg-amber-50", color: "text-amber-700", valColor: "text-amber-700" },
                            { label: "Disetujui", value: approvedUsers.length, icon: UserCheck, bg: "bg-green-50", color: "text-green-700", valColor: "text-green-700" },
                            { label: "Ditolak", value: 0, icon: UserX, bg: "bg-gray-100", color: "text-gray-400", valColor: "text-gray-400" },
                        ].map((s) => (
                            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.bg}`}>
                                    <s.icon size={17} className={s.color} />
                                </div>
                                <div>
                                    <div className={`text-xl font-bold ${s.valColor}`}>{s.value}</div>
                                    <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {pendingUsers.length > 0 && (
                        <>
                            {/* PENDING */}
                            <div className="text-sm font-semibold text-gray-800">Menunggu approval</div>

                            <div className="space-y-2">
                                {pendingUsers.map((farmer) => (
                                    <div key={farmer.id} className="bg-white rounded-2xl border border-gray-200 border-l-[3px] border-l-amber-400 p-4 flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-gray-800 text-left">{farmer.name}</div>
                                            <div className="flex gap-4 mt-1.5 flex-wrap">
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                    <Phone size={12} />{farmer.phone_number}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                    <CreditCard size={12} />{farmer.phone_number}
                                                </div>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1 text-left">
                                                Mendaftar {farmer.created_at} · {farmer.name}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                onClick={() => approveUser(farmer.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1e4d2b] hover:bg-[#2d6e3e] text-white text-xs font-medium transition">
                                                <UserCheck size={14} />Setujui
                                            </button>
                                            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-xs font-medium transition">
                                                <UserX size={14} />Tolak
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* TABLE */}
                    <div className="text-sm font-semibold text-gray-800">Petani terdaftar</div>

                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Nama</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">No HP</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">No KTP</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Terdaftar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {approvedUsers.map((farmer) => (
                                    <tr key={farmer.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition text-left">
                                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{farmer.name}</td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{farmer.phone_number}</td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{farmer.phone_number}</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">Aktif</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{farmer.created_at}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default ApprovalPage;