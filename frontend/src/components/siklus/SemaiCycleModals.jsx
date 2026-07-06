import { Flag, PlayCircle } from "lucide-react";
import CycleStartModal from "./CycleStartModal";

export function SemaiCycleEndButton({ onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-[11px] font-medium hover:bg-amber-100 transition ${className}`}
    >
      <Flag size={13} />
      Akhiri siklus semai secara manual
    </button>
  );
}

export function SemaiCycleStartButton({ onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-bl-primary hover:bg-bl-primary-hover text-white text-[11px] font-medium transition ${className}`}
    >
      <PlayCircle size={13} />
      Mulai siklus baru
    </button>
  );
}

export function SemaiCycleEndConfirmModal({ open, onClose, onConfirm, ending }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm p-5 text-left">
        <div className="text-sm font-semibold text-gray-800">Akhiri siklus semai?</div>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Data sensor selama siklus ini akan dikunci dan direkap. Screenhouse akan kosong siap untuk
          siklus baru.
        </p>
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={ending}
            className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {ending ? "Merekap..." : "Ya, akhiri siklus"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SemaiCycleStartModal({
  open,
  onClose,
  screenhouseId,
  token,
  onStarted,
}) {
  return (
    <CycleStartModal
      open={open}
      onClose={onClose}
      screenhouseId={screenhouseId}
      token={token}
      onStarted={onStarted}
    />
  );
}
