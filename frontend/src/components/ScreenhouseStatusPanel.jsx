import { CheckCircle, Wifi, RefreshCw } from "lucide-react";
import { FARMER_LABELS } from "../constants/farmerLabels";

/** Ringkasan jumlah screenhouse & alat terhubung — sebelumnya di footer sidebar, sekarang di dashboard. */
export default function ScreenhouseStatusPanel({ stats, loading, onRefresh, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-4 text-left ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Status screenhouse</p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          title="Perbarui status"
          aria-label="Perbarui status screenhouse"
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="flex items-center gap-3 pt-2 text-sm text-gray-700">
        <CheckCircle size={17} className="text-bl-primary shrink-0" />
        {stats.screenhouseCount > 0
          ? `${stats.screenhouseCount} screenhouse aktif`
          : "Belum ada screenhouse aktif"}
      </div>
      <div className="flex items-center gap-3 pt-2 text-sm text-gray-700">
        <Wifi size={17} className="text-bl-primary shrink-0" />
        {stats.sinkNodeCount > 0
          ? `${stats.onlineSinkCount}/${stats.sinkNodeCount} alat terhubung`
          : `Ketuk ${FARMER_LABELS.refresh.toLowerCase()} untuk cek alat`}
      </div>
    </div>
  );
}
