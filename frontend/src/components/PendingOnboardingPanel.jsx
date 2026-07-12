import { CheckCircle2, Loader, Sprout, Bell, Plus } from "lucide-react";

/**
 * Panel onboarding untuk petani yang belum punya screenhouse aktif — semua
 * pengajuannya masih menunggu persetujuan operator. Menjawab "apa yang terjadi
 * selanjutnya" supaya rail kiri tidak terlihat kosong & petani tidak bingung.
 */
export default function PendingOnboardingPanel({ pendingCount = 0, onAjukan, className = "" }) {
  const steps = [
    {
      key: "submitted",
      icon: CheckCircle2,
      done: true,
      title: "Pengajuan terkirim",
      desc:
        pendingCount > 1
          ? `${pendingCount} screenhouse sudah kamu ajukan.`
          : "Screenhouse kamu sudah terdaftar.",
    },
    {
      key: "review",
      icon: Loader,
      active: true,
      title: "Sedang ditinjau operator",
      desc: "Operator wilayahmu memeriksa data screenhouse. Biasanya selesai dalam 1×24 jam kerja.",
    },
    {
      key: "active",
      icon: Sprout,
      title: "Monitoring aktif otomatis",
      desc: "Begitu disetujui, sensor langsung terpantau di dashboard ini.",
    },
  ];

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-4 space-y-3 text-left ${className}`}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Bell size={16} aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-800">Akun kamu sudah aktif</div>
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
            Screenhouse-mu sedang menunggu persetujuan operator sebelum bisa dipantau.
          </p>
        </div>
      </div>

      <ol className="space-y-2.5">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          return (
            <li key={step.key} className="flex gap-2.5">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    step.done
                      ? "bg-bl-surface-muted text-bl-primary"
                      : step.active
                      ? "bg-amber-50 text-amber-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  <step.icon size={13} className={step.active ? "animate-spin" : ""} aria-hidden />
                </span>
                {!isLast && <span className="w-px flex-1 bg-gray-200 mt-1" />}
              </div>
              <div className={`min-w-0 pb-0.5 ${isLast ? "" : "pb-1.5"}`}>
                <div
                  className={`text-xs font-semibold ${
                    step.active ? "text-amber-700" : step.done ? "text-gray-800" : "text-gray-500"
                  }`}
                >
                  {step.title}
                </div>
                <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{step.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="rounded-xl bg-bl-surface-muted border border-bl-accent/20 px-3 py-2">
        <p className="text-[11px] text-bl-primary leading-snug">
          Tidak perlu menunggu di halaman ini. Buka lagi dashboard nanti — data sensor
          muncul otomatis begitu screenhouse disetujui.
        </p>
      </div>

      {onAjukan && (
        <button
          type="button"
          onClick={onAjukan}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
        >
          <Plus size={14} aria-hidden />
          Ajukan screenhouse lain
        </button>
      )}
    </div>
  );
}
