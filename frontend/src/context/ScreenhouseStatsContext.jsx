/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { API_URL } from "../config/api";

const ScreenhouseStatsContext = createContext(null);

const DEFAULT_STATS = { screenhouseCount: 0, sinkNodeCount: 0, onlineSinkCount: 0 };

/**
 * Statistik ringkas untuk sidebar ("Status screenhouse"/"Status sistem"),
 * disimpan di root context supaya tidak reset tiap pindah halaman —
 * Sidebar di-mount ulang tiap route karena router tidak pakai layout/outlet.
 */
export function ScreenhouseStatsProvider({ children }) {
  const [footerStats, setFooterStats] = useState(DEFAULT_STATS);
  const [footerStatsLoading, setFooterStatsLoading] = useState(false);

  const fetchFooterStats = useCallback(() => {
    const role = localStorage.getItem("role");
    const token = localStorage.getItem("token");
    if (!token || !role) return Promise.resolve();

    setFooterStatsLoading(true);

    if (role === "operator" || role === "super_admin") {
      return fetch(`${API_URL}/screenhouses/operator-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setFooterStats({
              screenhouseCount: data.screenhouse_count ?? 0,
              sinkNodeCount: data.online_sink_node_count ?? data.sink_node_count ?? 0,
              onlineSinkCount: data.online_sink_node_count ?? 0,
            });
          }
        })
        .catch(console.error)
        .finally(() => setFooterStatsLoading(false));
    }

    if (role === "petani") {
      return fetch(`${API_URL}/screenhouses/my-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setFooterStats({
              screenhouseCount: data.screenhouse_count ?? 0,
              sinkNodeCount: data.online_nodes ?? data.active_sensors ?? 0,
              onlineSinkCount: data.online_nodes ?? data.active_sensors ?? 0,
            });
          }
        })
        .catch(console.error)
        .finally(() => setFooterStatsLoading(false));
    }

    setFooterStatsLoading(false);
    return Promise.resolve();
  }, []);

  useEffect(() => {
    fetchFooterStats();
    window.addEventListener("auth-changed", fetchFooterStats);
    const interval = setInterval(fetchFooterStats, 30000);
    return () => {
      window.removeEventListener("auth-changed", fetchFooterStats);
      clearInterval(interval);
    };
  }, [fetchFooterStats]);

  return (
    <ScreenhouseStatsContext.Provider
      value={{ footerStats, footerStatsLoading, refetch: fetchFooterStats }}
    >
      {children}
    </ScreenhouseStatsContext.Provider>
  );
}

const defaultScreenhouseStatsContext = {
  footerStats: DEFAULT_STATS,
  footerStatsLoading: false,
  refetch: async () => {},
};

export function useScreenhouseStats() {
  const ctx = useContext(ScreenhouseStatsContext);
  if (!ctx) {
    console.warn("[useScreenhouseStats] Dipanggil di luar ScreenhouseStatsProvider — pakai nilai default");
    return defaultScreenhouseStatsContext;
  }
  return ctx;
}
