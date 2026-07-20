import { Download, Loader2, Menu } from "lucide-react";

export default function OperatorTopbar({
  onToggleSidebar,
  title,
  subtitle,
  onExport,
  onExportCsv,
  exportDisabled,
  exportCsvDisabled,
  exportLoading,
}) {
  return (
    <header className="app-topbar h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between z-10 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition shrink-0"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} className="icon-muted" />
        </button>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-800 truncate">{title}</div>
          {subtitle && (
            <div className="text-xs text-gray-600 truncate hidden sm:block">{subtitle}</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            disabled={exportDisabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {exportLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            <span className="hidden sm:inline">{exportLoading ? "Menyiapkan…" : "PDF"}</span>
          </button>
        )}

        {onExportCsv && (
          <button
            type="button"
            onClick={onExportCsv}
            disabled={exportCsvDisabled ?? exportDisabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Download size={14} />
            <span className="hidden sm:inline">CSV</span>
          </button>
        )}
      </div>
    </header>
  );
}
