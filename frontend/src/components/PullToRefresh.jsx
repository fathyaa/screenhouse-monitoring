import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

const MOBILE_QUERY = "(max-width: 639px)";
const PULL_THRESHOLD = 68;
const MAX_PULL = 110;

export default function PullToRefresh({ onRefresh, className = "", children }) {
  const scrollRef = useRef(null);
  const startY = useRef(0);
  const pullRef = useRef(0);
  const dragging = useRef(false);

  const [enabled, setEnabled] = useState(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const runRefresh = useCallback(async () => {
    if (refreshing || !onRefresh) return;
    setRefreshing(true);
    setPull(48);
    try {
      await onRefresh();
    } catch (err) {
      console.error("[pull-refresh]", err);
    } finally {
      setRefreshing(false);
      pullRef.current = 0;
      setPull(0);
    }
  }, [onRefresh, refreshing]);

  useEffect(() => {
    if (!enabled) return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;

    const onTouchStart = (e) => {
      if (refreshing || el.scrollTop > 2) return;
      dragging.current = true;
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (!dragging.current || refreshing) return;

      if (el.scrollTop > 2) {
        dragging.current = false;
        pullRef.current = 0;
        setPull(0);
        return;
      }

      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }

      const next = Math.min(delta * 0.5, MAX_PULL);
      pullRef.current = next;
      setPull(next);
      if (e.cancelable) e.preventDefault();
    };

    const onTouchEnd = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (pullRef.current >= PULL_THRESHOLD) {
        runRefresh();
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [enabled, refreshing, runRefresh]);

  const offset = refreshing ? 48 : pull;
  const showHint = enabled && (pull > 8 || refreshing);

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      {showHint && (
        <div
          className="absolute inset-x-0 top-0 z-10 flex flex-col items-center justify-end pointer-events-none lg:hidden"
          style={{ height: offset }}
          aria-live="polite"
        >
          <Loader2
            size={20}
            className={`text-bl-primary mb-0.5 ${refreshing ? "animate-spin" : ""}`}
            style={refreshing ? undefined : { transform: `rotate(${pull * 2.5}deg)` }}
          />
          <span className="text-[11px] text-gray-600 font-medium pb-1.5">
            {refreshing
              ? "Memperbarui..."
              : pull >= PULL_THRESHOLD
              ? "Lepas untuk refresh"
              : "Tarik untuk refresh"}
          </span>
        </div>
      )}

      <div
        ref={scrollRef}
        className={`h-full overflow-y-auto overscroll-y-contain ${className}`}
        style={{
          transform: enabled && offset ? `translateY(${offset}px)` : undefined,
          transition: dragging.current ? "none" : "transform 0.22s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
