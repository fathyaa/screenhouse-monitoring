import { useState } from "react";
import { Download, Bell, Smartphone, X } from "lucide-react";
import toast from "react-hot-toast";
import { usePwaInstall, usePushNotifications } from "../hooks/usePwa";

export default function PwaInstallBanner() {
  const role = localStorage.getItem("role");
  const [hidden, setHidden] = useState(
    () => sessionStorage.getItem("pwa_banner_dismissed") === "1"
  );

  const { canInstall, installed, isIos, promptInstall } = usePwaInstall();
  const { permission, subscribed, loading, supported, subscribe } = usePushNotifications();

  if (role !== "petani" || hidden) return null;

  const showInstall = !installed && (canInstall || isIos);
  const showPush = supported && permission !== "granted" && !subscribed;
  if (!showInstall && !showPush) return null;

  const dismiss = () => {
    sessionStorage.setItem("pwa_banner_dismissed", "1");
    setHidden(true);
  };

  const handleInstall = async () => {
    if (canInstall) {
      const ok = await promptInstall();
      if (ok) toast.success("App terpasang di home screen");
      return;
    }
    toast("Di iPhone: tap Share → Add to Home Screen", { icon: "📱", duration: 6000 });
  };

  const handlePush = async () => {
    const result = await subscribe();
    if (result.ok) {
      toast.success("Notifikasi push aktif — alert tetap masuk saat app ditutup");
    } else if (result.reason === "denied") {
      toast.error("Izin notifikasi ditolak. Aktifkan lewat pengaturan browser.");
    } else {
      toast.error("Gagal mengaktifkan push notification");
    }
  };

  return (
    <div className="fixed bottom-4 left-3 right-3 z-[999] max-w-md mx-auto rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 shadow-lg relative">
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
        aria-label="Tutup"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <Smartphone size={18} className="text-emerald-700" />
        </div>
        <div className="text-left min-w-0">
          <div className="text-sm font-semibold text-gray-800">Pasang app di HP</div>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Install ke home screen dan aktifkan notifikasi push agar peringatan screenhouse
            tetap masuk walau browser ditutup.
          </p>

          <div className="flex flex-wrap gap-2 mt-3">
            {showInstall && (
              <button
                type="button"
                onClick={handleInstall}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 transition"
              >
                <Download size={14} />
                {isIos && !canInstall ? "Cara install (iOS)" : "Install app"}
              </button>
            )}
            {showPush && (
              <button
                type="button"
                onClick={handlePush}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-white text-emerald-800 text-xs font-medium hover:bg-emerald-50 transition disabled:opacity-50"
              >
                <Bell size={14} />
                {loading ? "Memproses..." : "Aktifkan notifikasi"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
