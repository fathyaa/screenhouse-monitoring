import { Sprout } from "lucide-react";
import { useSemaiCycle } from "./useSemaiCycle";
import {
  SemaiCycleEndButton,
  SemaiCycleStartButton,
  SemaiCycleEndConfirmModal,
  SemaiCycleStartModal,
} from "./SemaiCycleModals";

function formatIdDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function cycleAgeDays(tanggalMulai) {
  if (!tanggalMulai) return null;
  const start = new Date(`${String(tanggalMulai).slice(0, 10)}T12:00:00+07:00`);
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
}

/** Panel legacy — dipakai jika masih perlu tampilan penuh (mis. operator). */
export default function SemaiCyclePanel({
  screenhouseId,
  token,
  onCycleChanged,
  className = "",
}) {
  const cycle = useSemaiCycle(screenhouseId, token, onCycleChanged);
  const ageDays = cycle.activeCycle ? cycleAgeDays(cycle.activeCycle.tanggal_mulai) : null;

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-4 text-left ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-sm font-semibold text-gray-800">Siklus semai</div>
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
            Varietas dan tanggal semai diatur lewat siklus — bukan edit langsung.
          </p>
        </div>
        <Sprout size={18} className="shrink-0 text-bl-primary mt-0.5" />
      </div>

      {cycle.loading ? (
        <p className="text-sm text-gray-500 py-4">Memuat siklus...</p>
      ) : cycle.activeCycle ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-bl-surface-muted border border-bl-accent/20 p-3.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-bl-primary mb-1">
              Siklus aktif
            </div>
            <div className="text-base font-semibold text-gray-800">
              {cycle.activeCycle.varietas_nama ?? "Varietas belum dipilih"}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Mulai: {formatIdDate(cycle.activeCycle.tanggal_mulai)}
              {cycle.activeCycle.estimasi_siap && (
                <> · Target siap: {formatIdDate(cycle.activeCycle.estimasi_siap)}</>
              )}
            </div>
            {ageDays != null && (
              <p className="text-xs text-gray-600 mt-2">
                Bibit berumur <strong>{ageDays} hari</strong> dalam siklus ini.
              </p>
            )}
          </div>
          <SemaiCycleEndButton onClick={() => cycle.setShowEndConfirm(true)} className="text-sm py-2.5" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-dashed border-gray-200 bg-slate-50 px-4 py-6 text-center">
            <p className="text-sm text-gray-600">Belum ada siklus semai aktif.</p>
          </div>
          <SemaiCycleStartButton onClick={() => cycle.setShowStartModal(true)} className="text-sm py-2.5" />
        </div>
      )}

      <SemaiCycleEndConfirmModal
        open={cycle.showEndConfirm}
        onClose={() => cycle.setShowEndConfirm(false)}
        onConfirm={cycle.handleEndCycle}
        ending={cycle.ending}
      />
      <SemaiCycleStartModal
        open={cycle.showStartModal}
        onClose={() => cycle.setShowStartModal(false)}
        screenhouseId={screenhouseId}
        token={token}
        onStarted={cycle.handleCycleStarted}
      />
    </div>
  );
}
