/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import toast from "react-hot-toast";
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

  useEffect(() => {
    const { supported: ok, reason } = detectPushSupport();
    setSupported(ok);
    setSupportReason(reason);
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
      toast("Notifikasi ke HP dimatikan", { icon: "🔕" });
      return { ok: true };
    } catch (err) {
      console.error("[push/unsubscribe]", err);
      toast.error("Gagal mematikan notifikasi");
      return { ok: false, reason: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = useCallback(async () => {
    if (loading) return;
    if (enabled) return disable();
    return enable();
  }, [loading, enabled, enable, disable]);

  return (
    <PushNotificationContext.Provider
      value={{
        permission,
        enabled,
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
  loading: false,
  supported: false,
  enable: async () => ({ ok: false }),
  disable: async () => ({ ok: false }),
  toggle: async () => {},
};

export function usePushNotifications() {
  const ctx = useContext(PushNotificationContext);
  if (!ctx) return defaultPushContext;
  return ctx;
}
