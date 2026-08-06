/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BellOff } from "lucide-react";
import { API_URL } from "../config/api";

const PushNotificationContext = createContext(null);

function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalonePwa() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function detectPushSupport() {
  if (!("serviceWorker" in navigator)) {
    return { supported: false, reason: "no-service-worker" };
  }
  if (!("Notification" in window)) {
    return { supported: false, reason: "no-notification-api" };
  }
  if (!window.isSecureContext) {
    return { supported: false, reason: "insecure-context" };
  }
  if (!("PushManager" in window)) {
    if (isIosDevice() && !isStandalonePwa()) {
      return { supported: false, reason: "ios-need-install" };
    }
    return { supported: false, reason: "no-push-api" };
  }
  return { supported: true, reason: null };
}

const PUSH_UNSUPPORTED_MESSAGES = {
  "insecure-context":
    "Notifikasi ke HP butuh HTTPS. Saat uji di jaringan lokal, peringatan tetap muncul saat aplikasi dibuka.",
  "ios-need-install":
    "Di iPhone, tambahkan BibitLive ke Layar Utama dulu, lalu aktifkan notifikasi.",
  "no-push-api": "Browser ini belum mendukung notifikasi ke HP.",
  "no-service-worker": "Browser ini belum mendukung notifikasi latar belakang.",
  "no-notification-api": "Browser ini belum mendukung notifikasi.",
};

function getPushUnsupportedMessage(reason) {
  return PUSH_UNSUPPORTED_MESSAGES[reason] ?? PUSH_UNSUPPORTED_MESSAGES["no-push-api"];
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function getVapidPublicKey() {
  let publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    const res = await fetch(`${API_URL}/push/vapid-public-key`);
    const data = await res.json();
    publicKey = data.publicKey;
  }
  return publicKey;
}

export function PushNotificationProvider({ children }) {
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);
  const [supportReason, setSupportReason] = useState(null);
  // Preferensi akun (bukan per-device) — sama di web maupun HP, dipakai
  // untuk membisukan suara/toast in-app sekaligus push ke semua device.
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const { supported: ok, reason } = detectPushSupport();
    setSupported(ok);
    setSupportReason(reason);
  }, []);

  const syncMutedFromServer = useCallback(async () => {
    const role = localStorage.getItem("role");
    const token = localStorage.getItem("token");
    if (role !== "petani" || !token) {
      setMuted(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setMuted(Boolean(data.notifications_muted));
    } catch {
      // Diamkan — biarkan nilai lokal terakhir dipakai.
    }
  }, []);

  useEffect(() => {
    syncMutedFromServer();
    window.addEventListener("auth-changed", syncMutedFromServer);
    return () => window.removeEventListener("auth-changed", syncMutedFromServer);
  }, [syncMutedFromServer]);

  const setNotificationsMuted = useCallback(async (nextMuted) => {
    const token = localStorage.getItem("token");
    if (!token) return { ok: false };

    try {
      const res = await fetch(`${API_URL}/auth/me/notifications`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ muted: nextMuted }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan preferensi notifikasi");
      setMuted(nextMuted);
      return { ok: true };
    } catch (err) {
      console.error("[push] gagal ubah preferensi notifikasi", err);
      return { ok: false };
    }
  }, []);

  const syncFromBrowser = useCallback(async () => {
    if (localStorage.getItem("role") !== "petani") {
      setEnabled(false);
      return;
    }

    if (!supported) {
      setEnabled(false);
      return;
    }

    const perm = Notification.permission;
    setPermission(perm);

    if (perm !== "granted" || localStorage.getItem("push_muted") === "true") {
      setEnabled(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const active =
        Boolean(subscription) && localStorage.getItem("push_subscribed") === "true";
      setEnabled(active);
      if (!active && subscription) {
        localStorage.removeItem("push_subscribed");
      }
    } catch {
      setEnabled(false);
    }
  }, [supported]);

  useEffect(() => {
    syncFromBrowser();
    window.addEventListener("auth-changed", syncFromBrowser);
    return () => window.removeEventListener("auth-changed", syncFromBrowser);
  }, [syncFromBrowser]);

  const enable = useCallback(async () => {
    if (!supported) {
      toast.error(getPushUnsupportedMessage(supportReason));
      return { ok: false, reason: supportReason ?? "unsupported" };
    }

    if (localStorage.getItem("role") !== "petani") {
      return { ok: false, reason: "not-petani" };
    }

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Izin notifikasi ditolak. Aktifkan lewat pengaturan browser/HP.");
        return { ok: false, reason: "denied" };
      }

      const publicKey = await getVapidPublicKey();
      if (!publicKey) {
        toast.error("Notifikasi belum siap di server. Hubungi operator sistem.");
        return { ok: false, reason: "no-vapid" };
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/push/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Gagal menyimpan pengaturan notifikasi");
      }

      localStorage.setItem("push_subscribed", "true");
      localStorage.removeItem("push_muted");
      setEnabled(true);
      toast.success("Notifikasi ke HP aktif");
      return { ok: true };
    } catch (err) {
      console.error("[push]", err);
      toast.error("Gagal mengaktifkan notifikasi ke HP");
      return { ok: false, reason: err.message };
    } finally {
      setLoading(false);
    }
  }, [supported, supportReason]);

  const disable = useCallback(async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker?.ready;
      const subscription = registration
        ? await registration.pushManager.getSubscription()
        : null;

      if (subscription) {
        const token = localStorage.getItem("token");
        if (token) {
          await fetch(`${API_URL}/push/unsubscribe`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          }).catch(() => {});
        }
        await subscription.unsubscribe();
      }

      localStorage.setItem("push_muted", "true");
      localStorage.removeItem("push_subscribed");
      setEnabled(false);
      toast("Notifikasi ke HP dimatikan", { icon: <BellOff size={16} /> });
      return { ok: true };
    } catch (err) {
      console.error("[push/unsubscribe]", err);
      toast.error("Gagal mematikan notifikasi");
      return { ok: false, reason: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Satu-satunya sumber kebenaran untuk posisi sakelar di UI.
   *
   * `muted` saja TIDAK cukup: ia default `false` di database, jadi petani yang
   * belum pernah mengizinkan notifikasi akan melihat sakelar menyala padahal
   * tidak ada subscription push sama sekali — dan klik pertamanya justru masuk
   * ke cabang "matikan". Sakelar baru boleh ON kalau notifikasi benar-benar
   * akan sampai.
   *
   * Pengecualian `!supported`: di browser tanpa Push API, bunyi + toast in-app
   * sudah merupakan pengiriman penuh yang bisa diberikan aplikasi ini, jadi
   * `muted` sendirian sudah menggambarkan keadaan dengan jujur.
   */
  const active = !muted && (enabled || !supported);

  const toggle = useCallback(async () => {
    if (loading) return;

    if (!active) {
      // Menyalakan notifikasi — aktifkan flag akun dulu, lalu coba daftar push di device ini.
      // Di browser tanpa Push API, `enable()` dilewati supaya petani tidak dapat
      // toast error padahal notifikasi in-app-nya berhasil dinyalakan.
      await setNotificationsMuted(false);
      if (supported && !enabled) await enable();
    } else {
      // Mematikan notifikasi — flag akun mati duluan (langsung membisukan suara/toast
      // di semua device untuk akun ini), baru bereskan subscription push device ini.
      await setNotificationsMuted(true);
      if (enabled) await disable();
    }
  }, [loading, active, supported, enabled, enable, disable, setNotificationsMuted]);

  return (
    <PushNotificationContext.Provider
      value={{
        permission,
        enabled,
        muted,
        active,
        loading,
        supported,
        supportReason,
        getUnsupportedMessage: () => getPushUnsupportedMessage(supportReason),
        enable,
        disable,
        toggle,
      }}
    >
      {children}
    </PushNotificationContext.Provider>
  );
}

const defaultPushContext = {
  permission: "default",
  enabled: false,
  muted: false,
  active: false,
  loading: false,
  supported: false,
  getUnsupportedMessage: () => getPushUnsupportedMessage(null),
  enable: async () => ({ ok: false }),
  disable: async () => ({ ok: false }),
  toggle: async () => {},
};

export function usePushNotifications() {
  const ctx = useContext(PushNotificationContext);
  if (!ctx) return defaultPushContext;
  return ctx;
}
