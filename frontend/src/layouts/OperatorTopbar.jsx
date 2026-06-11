import { NavLink } from "react-router-dom";
import { Download, Menu } from "lucide-react";

const NAV_ITEMS = [
  { to: "/operator", label: "Peta realtime", end: true },
  { to: "/operator/laporan", label: "Laporan wilayah", end: false },
];

export default function OperatorTopbar({
  onToggleSidebar,
  title,
  subtitle,
  onExport,
  exportDisabled,
}) {
  return (
    <header className="app-topbar h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between z-10 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition shrink-0"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} className="text-gray-500" />
        </button>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-800 truncate">{title}</div>
          {subtitle && (
            <div className="text-xs text-gray-400 truncate hidden sm:block">{subtitle}</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <nav className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 rounded-xl p-0.5 sm:p-1 max-w-[200px] sm:max-w-none overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {onExport && (
          <button
            type="button"
            onClick={onExport}
            disabled={exportDisabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Unduh PDF</span>
          </button>
        )}

        <div className="hidden md:flex items-center gap-2 bg-green-50 text-green-800 text-xs font-medium px-3 py-1.5 rounded-full">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Online
        </div>
      </div>
    </header>
  );
}
