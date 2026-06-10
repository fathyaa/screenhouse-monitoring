import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";

const MOBILE_QUERY = "(max-width: 639px)";

export default function AppToaster() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <Toaster
      position={isMobile ? "bottom-center" : "top-center"}
      containerStyle={
        isMobile
          ? { bottom: "max(1rem, env(safe-area-inset-bottom))" }
          : undefined
      }
      toastOptions={{
        duration: 3500,
        style: isMobile
          ? { maxWidth: "calc(100vw - 2rem)", textAlign: "center" }
          : undefined,
      }}
    />
  );
}
