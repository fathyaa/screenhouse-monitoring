import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Clock3, Search, X, Radio, Plus } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import { useAlerts } from "../context/AlertContext";
import PetaniTopbar from "../layouts/PetaniTopbar";
import ActuatorControls from "../components/ActuatorControls";
import DashboardAlertList from "../components/DashboardAlertList";

import { API_URL } from "../config/api";
import { getSocket } from "../lib/socket";
import {
  buildPetaniAlertUrl,
  isAttentionStatus,
  pickPrimaryAlert,
} from "../utils/petaniAlertNav";
import { screenhouseMatchesQuery } from "../utils/screenhouseSearch";
import {
  deriveScreenhouseStatus,
  formatLastSensorUpdate,
  timeAgo,
} from "../constants/screenhouseStatus";
import PullToRefresh from "../components/PullToRefresh";
import ScreenhouseMiniStats from "../components/ScreenhouseMiniStats";
import EstimasiTanamPanel from "../components/EstimasiTanamPanel";
import { FARMER_LABELS } from "../constants/farmerLabels";
import {
  ScreenhouseCardsSkeleton,
  Skeleton,
} from "../components/LoadingUI";

const CARD_STATUS_RANK = { critical: 4, warning: 3, offline: 2, pending: 1.5, healthy: 1 };
/** Search bar baru berguna kalau petani punya banyak screenhouse. */
const SEARCH_MIN_SCREENHOUSES = 10;

const CARD_ACCENT = {
  critical: "border-l-red-500",
  warning: "border-l-amber-500",
  offline: "border-l-slate-400",
  pending: "border-l-amber-400",
  healthy: "border-l-bl-accent",
};

function shortenScreenhouseName(name) {
  return String(name ?? "")
    .replace(/^Screenhouse\s+/i, "")
    .trim() || name;
}

function getScreenhouseCardMeta(sensor, screenhouseAlerts = [], screenhouseStatus = "active") {
  if (screenhouseStatus === "pending") {
    return {
      status: "pending",
      rank: CARD_STATUS_RANK.pending,
      chip: { label: "Menunggu approval", cls: "bg-amber-50 text-amber-700" },
      primaryAlert: null,
    };
  }

  if (screenhouseAlerts.length > 0) {
    const status = deriveScreenhouseStatus({
      activeAlertCount: screenhouseAlerts.length,
    });
    return {
      status,
      rank: CARD_STATUS_RANK[status],
      chip: {
        label: "Perlu perhatian",
        cls:
          status === "critical"
            ? "bg-red-50 text-red-700"
            : "bg-amber-50 text-amber-700",
      },
      primaryAlert: pickPrimaryAlert(screenhouseAlerts),
    };
  }

  if (!sensor) {
    return {
      status: "offline",
      rank: CARD_STATUS_RANK.offline,
      chip: { label: FARMER_LABELS.offline, cls: "bg-slate-100 text-slate-600" },
      primaryAlert: null,
    };
  }

  return {
    status: "healthy",
    rank: CARD_STATUS_RANK.healthy,
    chip: { label: "Sehat", cls: "bg-bl-surface-muted text-bl-primary" },
    primaryAlert: null,
  };
}

function PetaniDashboard() {
  const [screenhouses, setScreenhouses] = useState([]);
  const [latestSensorData, setLatestSensorData] = useState({});
  const [stressScores, setStressScores] = useState({});
  const [estimasiTanam, setEstimasiTanam] = useState({});
  const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
  const [searchQuery, setSearchQuery] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  const { alerts, unreadAlerts, refetchAlerts } = useAlerts();

  const goToAlert = useCallback(
    ({ alertId, screenhouseId } = {}) => {
      navigate(buildPetaniAlertUrl({ alertId, screenhouseId }));
    },
    [navigate]
  );

  const activeAlerts = useMemo(
    () => alerts.filter((a) => a.status === "active"),
    [alerts]
  );

  const alertsByScreenhouse = useMemo(() => {
    const map = {};
    activeAlerts.forEach((a) => {
      map[a.screenhouse_id] = [...(map[a.screenhouse_id] ?? []), a];
    });
    return map;
  }, [activeAlerts]);


  const loadEstimasiTanam = useCallback(
    (shList) => {
      if (!token || !shList?.length) return Promise.resolve();
      const active = shList.filter((sh) => sh.status === "active");
      if (!active.length) {
        setEstimasiTanam({});
        return Promise.resolve();
      }

      return Promise.all(
        active.map((sh) =>
          fetch(`${API_URL}/screenhouses/${sh.id}/estimasi-tanam`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => [sh.id, data])
            .catch(() => [sh.id, null])
        )
      ).then((entries) => {
        setEstimasiTanam(Object.fromEntries(entries.filter(([, data]) => data)));
      });
    },
    [token]
  );

  const loadStressScores = useCallback(
    (shList) => {
      if (!token || !shList?.length) return Promise.resolve();
      const active = shList.filter((sh) => sh.status === "active");
      if (!active.length) {
        setStressScores({});
        return Promise.resolve();
      }

      return Promise.all(
        active.map((sh) =>
          fetch(`${API_URL}/screenhouses/${sh.id}/stress-score`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => [sh.id, data])
            .catch(() => [sh.id, null])
        )
      ).then((entries) => {
        setStressScores(Object.fromEntries(entries.filter(([, data]) => data)));
      });
    },
    [token]
  );

  const loadLatestSensorData = useCallback(() => {
    if (!token) return Promise.resolve();
    return fetch(`${API_URL}/sensor-data/latest`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const mapped = {};
        data.forEach((item) => {
          if (item.screenhouse_id != null) {
            mapped[item.screenhouse_id] = item;
          }
        });
        setLatestSensorData(mapped);
      })
      .catch(console.error);
  }, [token]);

  const loadScreenhouses = useCallback(() => {
    if (!token) return Promise.resolve();
    return fetch(`${API_URL}/screenhouses/my-screenhouses`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setScreenhouses(list);
        loadStressScores(list);
        loadEstimasiTanam(list);
        return list;
      })
      .catch(console.error);
  }, [token, loadStressScores, loadEstimasiTanam]);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([loadScreenhouses(), loadLatestSensorData()]);
    refetchAlerts();
  }, [loadScreenhouses, loadLatestSensorData, refetchAlerts]);

  useEffect(() => {
    let active = true;
    Promise.all([loadScreenhouses(), loadLatestSensorData()]).finally(() => {
      if (active) setPageLoading(false);
    });
    return () => {
      active = false;
    };
  }, [loadScreenhouses, loadLatestSensorData]);

  useEffect(() => {
    const intervalId = setInterval(loadLatestSensorData, 30000);
    return () => clearInterval(intervalId);
  }, [loadLatestSensorData]);

  useEffect(() => {
    const pollAlerts = setInterval(refetchAlerts, 30000);
    return () => clearInterval(pollAlerts);
  }, [refetchAlerts]);

  useEffect(() => {
    const handler = (update) => {
      if (!update?.screenhouse_id) return;
      setLatestSensorData((prev) => {
        const current = prev[update.screenhouse_id];
        return {
          ...prev,
          [update.screenhouse_id]: {
            ...(current ?? {}),
            ...update,
            screenhouse_id: update.screenhouse_id,
          },
        };
      });
      refetchAlerts();
      if (update.screenhouse_id) {
        fetch(`${API_URL}/screenhouses/${update.screenhouse_id}/stress-score`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data) {
              setStressScores((prev) => ({ ...prev, [update.screenhouse_id]: data }));
            }
          })
          .catch(console.error);
      }
    };
    const socket = getSocket();
    if (!socket) return;

    socket.on("sensor-update", handler);
    return () => socket.off("sensor-update", handler);
  }, [refetchAlerts, token]);

  useEffect(() => {
    const handler = (update) => {
      if (!update?.screenhouse_id) return;
      setLatestSensorData((prev) => {
        const current = prev[update.screenhouse_id];
        if (!current) return prev;
        return {
          ...prev,
          [update.screenhouse_id]: {
            ...current,
            fan_status: update.fan_status,
            irrigation_status: update.irrigation_status,
            lamp_status: update.lamp_status,
            created_at: update.created_at ?? current.created_at,
          },
        };
      });
    };
    const socket = getSocket();
    if (!socket) return;

    socket.on("actuator-update", handler);
    return () => socket.off("actuator-update", handler);
  }, []);

  const handleActuatorUpdated = useCallback((update) => {
    if (!update?.screenhouse_id) return;
    setLatestSensorData((prev) => {
      const current = prev[update.screenhouse_id];
      if (!current) return prev;
      return {
        ...prev,
        [update.screenhouse_id]: {
          ...current,
          fan_status: update.fan_status,
          irrigation_status: update.irrigation_status,
          lamp_status: update.lamp_status,
          created_at: update.created_at ?? current.created_at,
        },
      };
    });
  }, []);

  const showScreenhouseSearch = screenhouses.length > SEARCH_MIN_SCREENHOUSES;

  const sortedScreenhouses = useMemo(
    () =>
      [...screenhouses].sort((a, b) => {
        const rankA = getScreenhouseCardMeta(
          latestSensorData[a.id],
          alertsByScreenhouse[a.id],
          a.status
        ).rank;
        const rankB = getScreenhouseCardMeta(
          latestSensorData[b.id],
          alertsByScreenhouse[b.id],
          b.status
        ).rank;
        if (rankB !== rankA) return rankB - rankA;
        return a.name.localeCompare(b.name, "id");
      }),
    [screenhouses, latestSensorData, alertsByScreenhouse]
  );

  const filteredScreenhouses = useMemo(() => {
    if (!searchQuery.trim()) return sortedScreenhouses;
    return sortedScreenhouses.filter((sh) => screenhouseMatchesQuery(sh, searchQuery));
  }, [sortedScreenhouses, searchQuery]);

  return (
    <div className="app-shell fixed inset-0 flex bg-bl-surface overflow-hidden text-left">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        screenhouses={screenhouses}
        role={user?.role}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 text-left">
        <PetaniTopbar
          onToggleSidebar={toggleSidebar}
          title="Dashboard petani"
          subtitle={`Halo, ${user?.name}. Pantau screenhouse kamu.`}
        />

        <PullToRefresh onRefresh={refreshDashboard} className="p-4 sm:p-5 space-y-4 text-left">
          {pageLoading ? (
            <>
              <Skeleton className="h-24 rounded-2xl" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-36" />
                <ScreenhouseCardsSkeleton count={4} />
              </div>
            </>
          ) : (
            <>
          {unreadAlerts.length > 0 && (
            <DashboardAlertList
              alerts={unreadAlerts}
              onNavigateAlert={goToAlert}
              onViewAll={() => navigate("/petani/peringatan")}
            />
          )}

          <div className="text-left space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-800">Screenhouse saya</div>
                <div className="text-xs text-gray-600 mt-0.5 text-left">
                  Klik nama screenhouse untuk melihat detail.
                  {showScreenhouseSearch && searchQuery.trim() && (
                    <span className="text-gray-600 font-medium">
                      {" "}
                      · {filteredScreenhouses.length} dari {sortedScreenhouses.length} ditampilkan
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/petani/ajukan-screenhouse")}
                title="Ajukan pendaftaran screenhouse baru untuk ditinjau operator"
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bl-primary hover:bg-bl-primary-hover text-white text-xs font-medium transition"
              >
                <Plus size={14} />
                Ajukan screenhouse baru
              </button>
            </div>
            {showScreenhouseSearch && (
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"
              />
              <input
                type="text"
                role="searchbox"
                aria-label="Cari screenhouse"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama screenhouse..."
                className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-bl-primary/20 focus:border-bl-primary/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-600 p-0.5 rounded"
                  aria-label="Hapus pencarian"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            )}

            {showScreenhouseSearch && filteredScreenhouses.length === 0 && searchQuery.trim() ? (
              <div className="text-center py-8 text-sm text-gray-600 bg-white rounded-2xl border border-gray-200">
                Tidak ada screenhouse yang cocok dengan &ldquo;{searchQuery.trim()}&rdquo;
              </div>
            ) : (
              <div className="space-y-3">
                {filteredScreenhouses.map((sh) => {
              const sensor = latestSensorData[sh.id];
              const shAlerts = alertsByScreenhouse[sh.id] ?? [];
              const cardMeta = getScreenhouseCardMeta(sensor, shAlerts, sh.status);
              const { chip: statusChip, status, primaryAlert } = cardMeta;
              const isPending = sh.status === "pending";
              const needsAttention = isAttentionStatus(status);

              return (
                <div
                  key={sh.id}
                  className={`bg-white rounded-2xl border border-gray-200 border-l-4 text-left overflow-hidden ${
                    CARD_ACCENT[status] ?? CARD_ACCENT.healthy
                  }`}
                >
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => !isPending && navigate(`/petani/screenhouse/${sh.id}`)}
                        disabled={isPending}
                        className={`text-base font-bold text-left leading-snug ${
                          isPending
                            ? "text-gray-600 cursor-default"
                            : "text-gray-900 hover:text-bl-primary"
                        }`}
                      >
                        {shortenScreenhouseName(sh.name)}
                      </button>
                      {needsAttention ? (
                        <button
                          type="button"
                          onClick={() =>
                            goToAlert({
                              alertId: primaryAlert?.id,
                              screenhouseId: sh.id,
                            })
                          }
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 transition hover:opacity-90 ${statusChip.cls}`}
                        >
                          {statusChip.label}
                        </button>
                      ) : (
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${statusChip.cls}`}
                        >
                          {statusChip.label}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 text-[11px] text-gray-600 font-medium">
                        <MapPin size={11} className="shrink-0" />
                        {sh.village}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 text-[11px] text-gray-600 font-medium"
                        title={
                          sensor?.created_at
                            ? formatLastSensorUpdate(sensor.created_at)
                            : undefined
                        }
                      >
                        <Clock3 size={11} className="shrink-0" />
                        {sensor?.created_at ? timeAgo(sensor.created_at) : FARMER_LABELS.noDataHint}
                      </span>
                      {(sh.node_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 text-[11px] text-gray-600 font-medium">
                          <Radio size={11} className="shrink-0" />
                          {FARMER_LABELS.nodeCount(sh.node_count)}
                        </span>
                      )}
                    </div>

                    {needsAttention && primaryAlert?.message && (
                      <button
                        type="button"
                        onClick={() =>
                          goToAlert({
                            alertId: primaryAlert?.id,
                            screenhouseId: sh.id,
                          })
                        }
                        className="mt-2.5 w-full text-left text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg px-2.5 py-2 leading-snug hover:bg-red-100/80 transition"
                      >
                        {primaryAlert.message}
                      </button>
                    )}
                  </div>

                  <div className="px-4 pb-4">
                    {isPending ? (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        Pengajuan screenhouse menunggu persetujuan operator. Monitoring akan aktif setelah disetujui.
                      </p>
                    ) : (
                      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
                        <div className="flex-1 min-w-0 space-y-2">
                          <EstimasiTanamPanel
                            layout="dashboard"
                            estimasi={estimasiTanam[sh.id]}
                            stressScore={stressScores[sh.id]}
                            varietasNama={sh.varietas_nama || sh.seed_variety}
                            tanggalSemai={sh.tanggal_semai ?? sh.seedling_start_date}
                            durasiPembibitanHari={sh.durasi_pembibitan_hari}
                            deviceOffline={status === "offline"}
                            showStressScore
                          />
                          <ScreenhouseMiniStats sensor={sensor} />
                        </div>
                        <div className="lg:w-44 xl:w-48 shrink-0 rounded-xl bg-gray-50/80 border border-gray-100 p-3">
                          <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-2 font-semibold">
                            Kontrol peralatan
                          </div>
                          <ActuatorControls
                            compact
                            screenhouseId={sh.id}
                            fan_status={sensor?.fan_status}
                            irrigation_status={sensor?.irrigation_status}
                            lamp_status={sensor?.lamp_status}
                            autoAlerts={shAlerts}
                            disabled={!sensor}
                            onUpdated={handleActuatorUpdated}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
              </div>
            )}
          </div>
            </>
          )}
        </PullToRefresh>
      </div>
    </div>
  );
}

export default PetaniDashboard;
