import { useCallback, useEffect, useState } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";

function getDefaultOpen() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(DESKTOP_QUERY).matches;
}

export function useSidebarOpen() {
  const [isOpen, setIsOpen] = useState(getDefaultOpen);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event) => {
      // Tutup otomatis saat layar mengecil; jangan paksa buka lagi di desktop
      // supaya toggle hide/show tetap jalan setelah user menutup sidebar.
      if (!event.matches) setIsOpen(false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => setIsOpen((open) => !open), []);
  const close = useCallback(() => setIsOpen(false), []);
  const open = useCallback(() => setIsOpen(true), []);

  return { isOpen, setIsOpen, toggle, close, open };
}
