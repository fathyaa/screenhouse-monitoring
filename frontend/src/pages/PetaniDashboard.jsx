import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Clock3, Search, X, Radio, Bot, TriangleAlert } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import { useAlerts } from "../context/AlertContext";
import PetaniTopbar from "../layouts/PetaniTopbar";
import PetaniBottomNav from "../layouts/PetaniBottomNav";
import ActuatorControls from "../components/ActuatorControls";
import DashboardInsightPanel from "../components/DashboardInsightPanel";
import PendingOnboardingPanel from "../components/PendingOnboardingPanel";
import ScreenhouseDetailPage from "./ScreenhouseDetailPage";
import { isAutoHandledAlert } from "../constants/actuatorRules";
import { staleThresholdMs } from "../utils/nodeOnline";
import { formatRackName } from "../utils/rackNames";
import { isDeviceOfflineAlert } from "../utils/alertDisplay";

import { API_URL } from "../config/api";
import { getSocket } from "../lib/socket";
import {
  buildPetaniAlertUrl,
  isAttentionStatus,
  pickPrimaryAlert,
} from "../utils/petaniAlertNav";
import { screenhouseMatchesQuery } from "../utils/screenhouseSearch";
import { computeEstimasiTimeline } from "../utils/estimasiTanam";
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
  auto: "border-l-bl-accent",
};

function shortenScreenhouseName(name) {
  return String(name ?? "")
    .replace(/^Screenhouse\s+/i, "")
    .trim() || name;
}

/** Data terakhir kadaluarsa → node dianggap offline, sama dengan halaman detail
 *  (isScreenhouseMonitorOffline). Payload /sensor-data/latest tidak membawa
 *  send_interval, jadi pakai ambang default 30 menit. */
function isSensorStale(sensor) {
  const ts = sensor?.created_at;
  if (!ts) return true;
  const ageMs = Date.now() - new Date(ts).getTime();
  if (Number.isNaN(ageMs)) return true;
  return ageMs > staleThresholdMs(sensor.send_interval_seconds);
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

  // Offline (tidak ada data / data basi) menang atas status lain — konsisten dgn
  // halaman detail yg pakai `screenhouseOffline ? "offline" : rollupStatus`.
  // Sebelumnya kartu cek `!sensor` saja, jadi data basi (mis. 4 hari lalu) tetap
  // ditampilkan "Sehat" padahal detailnya "Tidak terhubung".
  if (isSensorStale(sensor)) {
    return {
      status: "offline",
      rank: CARD_STATUS_RANK.offline,
      chip: { label: FARMER_LABELS.offline, cls: "bg-slate-100 text-slate-600" },
      primaryAlert: null,
    };
  }

  if (screenhouseAlerts.length > 0) {
    const status = deriveScreenhouseStatus({
      activeAlertCount: screenhouseAlerts.length,
    });
    // Kalau semua alert aktif sudah ditangani otomatis, chip tidak perlu
    // berteriak "Perlu perhatian" — samakan dengan warna kotak pesan di bawahnya.
    const allAutoHandled = screenhouseAlerts.every((a) =>
      isAutoHandledAlert(a, sensor?.capabilities)
    );
    return {
      status,
      rank: CARD_STATUS_RANK[status],
      accentKey: allAutoHandled ? "auto" : status,
      chip: allAutoHandled
        ? { label: "Ditangani otomatis", cls: "bg-bl-surface-muted text-bl-primary" }
        : {
            label: "Perlu perhatian",
            cls:
              status === "critical"
                ? "bg-red-50 text-red-700"
                : "bg-amber-50 text-amber-700",
          },
      primaryAlert: pickPrimaryAlert(screenhouseAlerts),
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
  const { alerts, refetchAlerts } = useAlerts();

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

  const pendingCount = useMemo(
    () => screenhouses.filter((sh) => sh.status === "pending").length,
    [screenhouses]
  );
  // Petani baru: semua screenhouse masih pending (belum ada yang aktif). Rail kiri
  // jadi kosong karena insight & progress panel return null — ganti dengan onboarding.
  const showOnboarding =
    screenhouses.length > 0 && !screenhouses.some((sh) => sh.status === "active");

  // Urutan kartu: yang sedang dipakai kerja dulu.
  // 0 = siklus semai berjalan + alat nyala, 1 = siklus berjalan + alat mati,
  // 2 = tidak ada siklus. Dalam grup yang sama, yang perlu perhatian di atas.
  const cycleGroupRank = useCallback(
    (sh) => {
      const hasCycle = Boolean(sh.tanggal_semai ?? sh.seedling_start_date);
      if (!hasCycle) return 2;
      return isSensorStale(latestSensorData[sh.id]) ? 1 : 0;
    },
    [latestSensorData]
  );

  const sortedScreenhouses = useMemo(
    () =>
      [...screenhouses].sort((a, b) => {
        const groupA = cycleGroupRank(a);
        const groupB = cycleGroupRank(b);
        if (groupA !== groupB) return groupA - groupB;

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
    [screenhouses, latestSensorData, alertsByScreenhouse, cycleGroupRank]
  );

  const filteredScreenhouses = useMemo(() => {
    if (!searchQuery.trim()) return sortedScreenhouses;
    return sortedScreenhouses.filter((sh) => screenhouseMatchesQuery(sh, searchQuery));
  }, [sortedScreenhouses, searchQuery]);

  const dashboardInsight = useMemo(() => {
    const active = sortedScreenhouses.filter((sh) => sh.status !== "pending");
    const total = active.length;
    if (!total) return null;

    let healthyCount = 0;
    let attentionCount = 0;
    let autoHandledCount = 0;
    let offlineCount = 0;

    active.forEach((sh) => {
      const meta = getScreenhouseCardMeta(
        latestSensorData[sh.id],
        alertsByScreenhouse[sh.id],
        sh.status
      );
      if (meta.status === "offline") {
        offlineCount += 1;
      } else if (meta.accentKey === "auto") {
        autoHandledCount += 1;
      } else if (isAttentionStatus(meta.status)) {
        attentionCount += 1;
      } else {
        healthyCount += 1;
      }
    });

    let nearestReady = null;
    active.forEach((sh) => {
      const est = estimasiTanam[sh.id];
      if (est?.sisa_hari == null || est.sisa_hari <= 0) return;
      if (nearestReady == null || est.sisa_hari < nearestReady.sisaHari) {
        nearestReady = { name: shortenScreenhouseName(sh.name), sisaHari: est.sisa_hari };
      }
    });

    // Tips perawatan berdasar fase umur bibit — informasi yang belum ada di
    // tempat lain: kartu menunjukkan "hari ke-X", tapi tidak menerjemahkannya
    // jadi tindakan. Fase dari proporsi umur terhadap durasi varietas.
    const phaseGroups = { awal: [], tengah: [], akhir: [] };
    active.forEach((sh) => {
      const timeline = computeEstimasiTimeline(
        estimasiTanam[sh.id],
        sh.tanggal_semai ?? sh.seedling_start_date,
        sh.durasi_pembibitan_hari
      );
      if (!timeline?.totalDays) return;
      const ratio = timeline.hariKe / timeline.totalDays;
      const phase = ratio < 1 / 3 ? "awal" : ratio < 2 / 3 ? "tengah" : "akhir";
      phaseGroups[phase].push(shortenScreenhouseName(sh.name));
    });
    const phaseTips = [
      phaseGroups.awal.length && {
        key: "awal",
        names: phaseGroups.awal,
        label: "baru semai",
        tip: "Jaga media selalu lembap dan lindungi dari terik & hujan deras.",
      },
      phaseGroups.tengah.length && {
        key: "tengah",
        names: phaseGroups.tengah,
        label: "pertumbuhan daun",
        tip: "Siram rutin pagi hari dan perhatikan status pupuk di kartu.",
      },
      phaseGroups.akhir.length && {
        key: "akhir",
        names: phaseGroups.akhir,
        label: "menjelang tanam",
        tip: "Kurangi penyiraman bertahap dan mulai siapkan lahan tanam.",
      },
    ].filter(Boolean);

    return {
      total,
      healthyCount,
      attentionCount,
      autoHandledCount,
      offlineCount,
      nearestReady,
      phaseTips,
    };
  }, [sortedScreenhouses, latestSensorData, alertsByScreenhouse, estimasiTanam]);

  // Petani dengan tepat satu screenhouse (dan sudah aktif): tidak ada gunanya
  // menampilkan list satu-kartu + rail insight yang cuma merangkum screenhouse itu.
  // Langsung jadikan dashboard = halaman detail penuh (pola conditional-by-count
  // yang sama dengan search >10 & selektor tren >1).
  const soleActiveScreenhouse =
    screenhouses.length === 1 && screenhouses[0]?.status === "active"
      ? screenhouses[0]
      : null;

  if (!pageLoading && soleActiveScreenhouse) {
    return (
      <ScreenhouseDetailPage
        screenhouseId={soleActiveScreenhouse.id}
        basePath="/petani"
        single
      />
    );
  }

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
            <div className="lg:flex lg:items-start lg:gap-4">
              <Skeleton className="h-40 rounded-2xl lg:w-72 xl:w-80 shrink-0" />
              <div className="flex-1 min-w-0 space-y-3 mt-4 lg:mt-0">
                <Skeleton className="h-4 w-36" />
                <ScreenhouseCardsSkeleton count={4} />
              </div>
            </div>
          ) : (
            <div className="lg:flex lg:items-start lg:gap-4">
              <div className="lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-4 space-y-4">
                {showOnboarding && (
                  <PendingOnboardingPanel
                    pendingCount={pendingCount}
                    onAjukan={() => navigate("/petani/ajukan-screenhouse")}
                  />
                )}
                <DashboardInsightPanel insight={dashboardInsight} />
              </div>
          <div className="flex-1 min-w-0 text-left space-y-3 mt-4 lg:mt-0">
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

              const primaryAutoHandled =
                primaryAlert && isAutoHandledAlert(primaryAlert, sensor?.capabilities);

              // Sebutkan rak asal alert kalau tahu node-nya. Alert offline
              // dikecualikan — pesannya sudah menyebut rak sendiri.
              const primaryAlertRack =
                primaryAlert?.sensor_node_name && !isDeviceOfflineAlert(primaryAlert)
                  ? formatRackName(primaryAlert.sensor_node_name)
                  : null;

              return (
                <div
                  key={sh.id}
                  className={`bg-white rounded-2xl border border-gray-200 border-l-4 text-left overflow-hidden ${
                    CARD_ACCENT[cardMeta.accentKey ?? status] ?? CARD_ACCENT.healthy
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
                      {!needsAttention && (
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${statusChip.cls}`}
                        >
                          {statusChip.label}
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
                        className={`mt-1 w-full flex items-center gap-1.5 text-left text-xs font-medium transition hover:underline ${
                          primaryAutoHandled ? "text-bl-primary" : "text-red-700"
                        }`}
                      >
                        {primaryAutoHandled ? (
                          <Bot size={13} className="shrink-0" aria-hidden />
                        ) : (
                          <TriangleAlert size={13} className="shrink-0" aria-hidden />
                        )}
                        <span className="truncate min-w-0">
                          {primaryAlert.message}
                          {primaryAlertRack && (
                            <span className="font-normal opacity-70">
                              {" · "}
                              {primaryAlertRack}
                            </span>
                          )}
                        </span>
                      </button>
                    )}

                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 text-xs text-gray-600 font-medium">
                        <MapPin size={11} className="shrink-0" />
                        {sh.village}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 text-xs text-gray-600 font-medium"
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
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 text-xs text-gray-600 font-medium">
                          <Radio size={11} className="shrink-0" />
                          {FARMER_LABELS.nodeCount(sh.node_count)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="px-4 pb-4">
                    {isPending ? (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        Pengajuan screenhouse menunggu persetujuan operator. Monitoring akan aktif setelah disetujui.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-4">
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
                        <div className="w-full shrink-0 rounded-xl bg-gray-50/80 border border-gray-100 p-3">
                          <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-2 font-semibold">
                            Kontrol peralatan
                          </div>
                          <ActuatorControls
                            compact
                            wide
                            screenhouseId={sh.id}
                            fan_status={sensor?.fan_status}
                            irrigation_status={sensor?.irrigation_status}
                            lamp_status={sensor?.lamp_status}
                            capabilities={sensor?.capabilities}
                            autoAlerts={shAlerts}
                            disabled={!sensor}
                            offline={status === "offline"}
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
            </div>
          )}
        </PullToRefresh>
        <PetaniBottomNav />
      </div>
    </div>
  );
}

export default PetaniDashboard;
