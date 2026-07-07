import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Menu } from "lucide-react";
import { useAlerts } from "../context/AlertContext";

export default function PetaniTopbar({ onToggleSidebar, title, subtitle, onBack }) {
    const navigate = useNavigate();
    const { unreadCount } = useAlerts();

    return (
        <header className="app-topbar h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between z-10">
            <div className="flex items-center gap-3 min-w-0">
                <button
                    onClick={onToggleSidebar}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition shrink-0"
                    aria-label="Toggle sidebar"
                >
                    <Menu size={20} className="icon-muted" />
                </button>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition shrink-0"
                        aria-label="Kembali"
                    >
                        <ArrowLeft size={20} className="icon-muted" />
                    </button>
                )}
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">{title}</div>
                    <div className="text-xs text-gray-600 truncate hidden sm:block">{subtitle}</div>
                </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                    onClick={() => navigate("/petani/peringatan")}
                    title="Buka peringatan"
                    aria-label="Buka peringatan"
                    className="relative p-2 rounded-xl hover:bg-gray-100 transition"
                >
                    <Bell size={18} className="text-gray-600" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </button>

                <div className="hidden sm:flex items-center gap-2 bg-green-50 text-green-800 text-xs font-medium px-3 py-1.5 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Siap pantau
                </div>
            </div>
        </header>
    );
}
