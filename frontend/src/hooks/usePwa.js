import { useCallback, useEffect, useState } from "react";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(ua));

    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    return () => {
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installPrompt) return false;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (outcome === "accepted") {
      setInstalled(true);
      return true;
    }
    return false;
  }, [installPrompt]);

  return {
    canInstall: Boolean(installPrompt),
    installed,
    isIos,
    promptInstall,
  };
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function usePushNotifications() {
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(
      "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    );
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported) return { ok: false, reason: "unsupported" };

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        return { ok: false, reason: "denied" };
      }

      let publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        const { API_URL } = await import("../config/api");
        const res = await fetch(`${API_URL}/push/vapid-public-key`);
        const data = await res.json();
        publicKey = data.publicKey;
      }
      if (!publicKey) {
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
      const { API_URL } = await import("../config/api");
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
        throw new Error(data.message || "Gagal menyimpan subscription push");
      }

      setSubscribed(true);
      localStorage.setItem("push_subscribed", "true");
      return { ok: true };
    } catch (err) {
      console.error("[push]", err);
      return { ok: false, reason: err.message };
    } finally {
      setLoading(false);
    }
  }, [supported]);

  useEffect(() => {
    if (localStorage.getItem("role") !== "petani") return;
    if (localStorage.getItem("push_subscribed") === "true") {
      setSubscribed(true);
    }
  }, []);

  return { permission, subscribed, loading, supported, subscribe };
}
