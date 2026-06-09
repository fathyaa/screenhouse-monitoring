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
    const onChange = (event) => setIsOpen(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => setIsOpen((open) => !open), []);
  const close = useCallback(() => setIsOpen(false), []);
  const open = useCallback(() => setIsOpen(true), []);

  return { isOpen, setIsOpen, toggle, close, open };
}
