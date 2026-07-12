import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { RefreshCw, Phone, MessageCircle, AlertTriangle, User, MapPin, Lightbulb, CheckCircle2, ChevronDown, ArrowUp, ArrowDown, X, Search } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import OperatorTopbar from "../layouts/OperatorTopbar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import { useScreenhouseStats } from "../context/ScreenhouseStatsContext";
import { API_URL } from "../config/api";
import { getSocket } from "../lib/socket";
import { formatRackName } from "../utils/rackNames";
import { THRESHOLD_METRICS } from "../constants/thresholdMetrics";
import {
  getStatusMeta,
  timeAgo,
  STATUS_ORDER,
  SCREENHOUSE_STATUS,
} from "../constants/screenhouseStatus";
import { MapLoadingOverlay } from "../components/LoadingUI";
import WilayahFilter from "../components/WilayahFilter";
import { whatsAppUrl, telUrl } from "../constants/farmerLabels";

const EMPTY_WILAYAH = { regency_id: "", district_id: "", village_id: "" };

function matchesWilayah(sh, w) {
  if (w.village_id) return String(sh.village_id) === String(w.village_id);
  if (w.district_id) return String(sh.district_id) === String(w.district_id);
  if (w.regency_id) return String(sh.regency_id) === String(w.regency_id);
  return true;
}

const METRIC_UNIT = Object.fromEntries(
  THRESHOLD_METRICS.map((m) => [m.key, m.unit])
);

/** Cadangan polling — offline baru terdeteksi setelah ~15 menit. */
const MAP_SUMMARY_POLL_MS = 5 * 60 * 1000;
/** Debounce refetch saat ada event realtime. */
const MAP_SUMMARY_DEBOUNCE_MS = 10 * 1000;

// Cache divIcon per warna agar tidak dibuat ulang tiap render.
const ICON_CACHE = {};
function statusIcon(status) {
  const { color } = getStatusMeta(status);
  if (ICON_CACHE[status]) return ICON_CACHE[status];

  const pulse =
    status === "critical"
      ? `<span style="position:absolute;top:2px;left:5px;width:18px;height:18px;border-radius:50%;background:${color};opacity:0.45;animation:shPulse 1.4s ease-out infinite;"></span>`
      : "";

  const icon = L.divIcon({
    className: "sh-status-marker",
    html: `
      <div style="position:relative;width:28px;height:40px;">
        ${pulse}
        <svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 26 14 26s14-16.5 14-26C28 6.27 21.73 0 14 0z" fill="${color}"/>
          <circle cx="14" cy="14" r="5.5" fill="#ffffff"/>
        </svg>
      </div>
    `,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36],
  });

  ICON_CACHE[status] = icon;
  return icon;
}

const PRIORITY_RANK = { critical: 4, warning: 3, offline: 2, healthy: 1 };
const PRIORITY_VISIBLE_LIMIT = 12;

/** @returns {{ all: object[], visible: object[] }} — `all` dipakai untuk hitung total asli & insight, `visible` yang dirender. */
function buildPriorityList(screenhouses, mapSummary) {
  const all = screenhouses
    .map((sh) => {
      const summary = mapSummary[sh.id];
      const status = summary?.status ?? "offline";
      return {
        ...sh,
        status,
        meta: getStatusMeta(status),
        summary,
        rank: PRIORITY_RANK[status] ?? 0,
        activeAlerts: summary?.active_alerts ?? 0,
      };
    })
    .filter((row) => row.rank >= PRIORITY_RANK.warning || row.activeAlerts > 0)
    .sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      if (b.activeAlerts !== a.activeAlerts) return b.activeAlerts - a.activeAlerts;
      return a.name.localeCompare(b.name, "id");
    });
  return { all, visible: all.slice(0, PRIORITY_VISIBLE_LIMIT) };
}

/** Satu kalimat ringkas: berapa banyak yang perlu perhatian & penyebab terbanyak. */
function buildDashboardInsight(priorityAll, statusCounts) {
  const total = priorityAll.length;
  if (total === 0) return null;

  const causeCounts = {};
  priorityAll.forEach((sh) => {
    (sh.summary?.abnormal ?? []).forEach((a) => {
      causeCounts[a.label] = (causeCounts[a.label] ?? 0) + 1;
    });
  });
  const topCause = Object.entries(causeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  let text = `${total} screenhouse perlu perhatian`;
  if (statusCounts.critical > 0) text += ` (${statusCounts.critical} kritis)`;
  text += ".";
  if (topCause) text += ` Penyebab terbanyak: ${topCause.toLowerCase()}.`;
  return text;
}

function OperatorDashboard() {
  const navigate = useNavigate();
  const [screenhouses, setScreenhouses] = useState([]);
  const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
  const { footerStats } = useScreenhouseStats();
  const user = JSON.parse(
    localStorage.getItem("user")
  );
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [wilayah, setWilayah] = useState(EMPTY_WILAYAH);
  const [mobileView, setMobileView] = useState("map");
  const [mapSummary, setMapSummary] = useState({});
  const [summaryRefreshing, setSummaryRefreshing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mapSummaryLoading, setMapSummaryLoading] = useState(true);
  const [attentionDelta, setAttentionDelta] = useState(null);
  const mapRef = useRef(null);
  const markerRefs = useRef({});
  const clusterRef = useRef(null);
  const prevAttentionCountRef = useRef(null);

  const loadMapSummary = useCallback(async () => {
    try {
      setSummaryRefreshing(true);
      setMapSummaryLoading(true);
      const res = await fetch(`${API_URL}/sensor-data/map-summary`);
      const data = await res.json();
      if (!Array.isArray(data)) return;
      setMapSummary(
        Object.fromEntries(data.map((item) => [item.screenhouse_id, item]))
      );
    } catch (err) {
      console.log(err);
    } finally {
      setSummaryRefreshing(false);
      setMapSummaryLoading(false);
    }
  }, []);

  const loadScreenhouses = useCallback(async () => {
    const token = localStorage.getItem("token");
    setPageLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`${API_URL}/screenhouses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Backend bisa balas objek error (mis. 500) — jangan sampai .filter meng-crash halaman.
      setScreenhouses(Array.isArray(data) ? data : []);
      if (!Array.isArray(data)) setLoadError(true);
    } catch (err) {
      console.error("[operator-dashboard] gagal memuat screenhouse", err);
      setScreenhouses([]);
      setLoadError(true);
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScreenhouses();
  }, [loadScreenhouses]);

  useEffect(() => {
    let active = true;
    let pollTimer = null;
    let debounceTimer = null;

    const loadSummary = () => {
      if (!active) return;
      loadMapSummary();
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const startPolling = () => {
      stopPolling();
      pollTimer = setInterval(loadSummary, MAP_SUMMARY_POLL_MS);
    };

    const scheduleRefresh = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadSummary, MAP_SUMMARY_DEBOUNCE_MS);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadSummary();
        startPolling();
      } else {
        stopPolling();
        clearTimeout(debounceTimer);
      }
    };

    loadSummary();
    if (document.visibilityState === "visible") {
      startPolling();
    }

    const socket = getSocket();
    if (!socket) return;

    socket.on("sensor-update", scheduleRefresh);
    socket.on("alert-update", scheduleRefresh);
    socket.on("alert-resolved", scheduleRefresh);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      stopPolling();
      clearTimeout(debounceTimer);
      socket.off("sensor-update", scheduleRefresh);
      socket.off("alert-update", scheduleRefresh);
      socket.off("alert-resolved", scheduleRefresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadMapSummary]);

  const filteredScreenhouses = screenhouses.filter((sh) => {
    if (!matchesWilayah(sh, wilayah)) return false;
    if (statusFilter === "all") return true;
    const status = mapSummary[sh.id]?.status ?? "offline";
    return status === statusFilter;
  });

  const wilayahActive = Boolean(
    wilayah.regency_id || wilayah.district_id || wilayah.village_id
  );

  // Pencarian sebagai "locator": mencari dalam cakupan wilayah/status aktif.
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return filteredScreenhouses.filter(
      (sh) =>
        sh.name?.toLowerCase().includes(q) ||
        sh.owner_name?.toLowerCase().includes(q) ||
        sh.address_detail?.toLowerCase().includes(q) ||
        sh.village?.toLowerCase().includes(q) ||
        sh.district?.toLowerCase().includes(q) ||
        sh.province?.toLowerCase().includes(q)
    );
  }, [filteredScreenhouses, search]);

  const statusCounts = useMemo(() => {
    const counts = { healthy: 0, warning: 0, critical: 0, offline: 0 };
    for (const sh of screenhouses) {
      const status = mapSummary[sh.id]?.status ?? "offline";
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }, [screenhouses, mapSummary]);

  const priorityList = useMemo(
    () => buildPriorityList(screenhouses, mapSummary),
    [screenhouses, mapSummary]
  );

  const dashboardInsight = useMemo(
    () => buildDashboardInsight(priorityList.all, statusCounts),
    [priorityList, statusCounts]
  );

  useEffect(() => {
    const total = priorityList.all.length;
    if (prevAttentionCountRef.current != null && prevAttentionCountRef.current !== total) {
      setAttentionDelta(total - prevAttentionCountRef.current);
    }
    prevAttentionCountRef.current = total;
  }, [priorityList.all.length]);

  const focusScreenhouse = (screenhouse) => {
    setSelectedId(screenhouse.id);

    const marker = markerRefs.current[screenhouse.id];
    const cluster = clusterRef.current;
    // Kalau marker sedang berada di dalam cluster, buka clusternya dulu baru popup.
    if (marker && cluster && typeof cluster.zoomToShowLayer === "function") {
      cluster.zoomToShowLayer(marker, () => marker.openPopup());
      return;
    }

    if (mapRef.current) {
      mapRef.current.flyTo([screenhouse.latitude, screenhouse.longitude], 15, {
        duration: 1.5,
      });
    }

    setTimeout(() => {
      markerRefs.current[screenhouse.id]?.openPopup();
    }, 800);
  };

  return (
    // fixed inset-0 = fullscreen tanpa scroll, tidak terpengaruh elemen luar
    <div className="app-shell fixed inset-0 flex bg-bl-surface overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        screenhouses={screenhouses}
        role={user.role}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <OperatorTopbar
          onToggleSidebar={toggleSidebar}
          title="Dashboard operator"
          subtitle="Pantau langsung, peta screenhouse"
        />

        {/* Legend status — sekaligus filter cepat, di luar peta, di bawah topbar.
            Mobile: satu baris scroll horizontal supaya tidak wrap ke banyak baris. */}
        <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-2.5 flex items-center gap-2 sm:gap-3">
          <div className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold shrink-0 hidden sm:block">
            Status screenhouse
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto sm:flex-wrap flex-1 min-w-0 -mx-1 px-1">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition shrink-0 whitespace-nowrap ${
                statusFilter === "all" ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Semua
              <span className="tabular-nums">{screenhouses.length}</span>
            </button>
            {STATUS_ORDER.map((key) => {
              const meta = SCREENHOUSE_STATUS[key];
              const active = statusFilter === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setStatusFilter(active ? "all" : key)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition shrink-0 whitespace-nowrap ${
                    active ? "ring-1 ring-inset" : "hover:bg-gray-100"
                  }`}
                  style={active ? { backgroundColor: `${meta.color}1a`, color: meta.color } : undefined}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className={active ? "" : "text-gray-700"}>{meta.label}</span>
                  <span className={`tabular-nums font-semibold ${active ? "" : "text-gray-800"}`}>
                    {statusCounts[key]}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={loadMapSummary}
            disabled={summaryRefreshing}
            className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-50 shrink-0"
            aria-label="Refresh status peta"
            title="Refresh status peta"
          >
            <RefreshCw
              size={14}
              className={summaryRefreshing ? "animate-spin" : undefined}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Filter wilayah (kab/kota → kecamatan → desa) + pencarian, satu baris. */}
        <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-2.5 relative z-[500]">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold shrink-0 hidden sm:block">
              Wilayah
            </div>
            <WilayahFilter value={wilayah} onChange={setWilayah} />
            {wilayahActive && (
              <button
                type="button"
                onClick={() => setWilayah(EMPTY_WILAYAH)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 shrink-0"
              >
                <X size={13} />
                Reset
              </button>
            )}

            {/* Pencarian screenhouse — sejajar filter, hasil tampil di bawah kotak. */}
            <div className="relative flex-1 min-w-[180px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari screenhouse: nama, pemilik, alamat..."
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100 focus:border-green-300"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Hapus pencarian"
              >
                <X size={15} />
              </button>
            )}

            {search.trim() && (
              <div className="absolute left-0 right-0 top-full mt-1 z-[600] max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                {searchResults.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-gray-500 text-center">
                    Tidak ada screenhouse yang cocok
                    {wilayahActive ? " di wilayah ini" : ""}.
                  </div>
                ) : (
                  <>
                    <div className="px-3 py-1.5 text-[11px] text-gray-500 border-b border-gray-100">
                      {searchResults.length} hasil
                    </div>
                    {searchResults.map((sh) => {
                      const status = mapSummary[sh.id]?.status ?? "offline";
                      const meta = getStatusMeta(status);
                      return (
                        <button
                          key={`search-${sh.id}`}
                          type="button"
                          onClick={() => {
                            focusScreenhouse(sh);
                            setSearch("");
                            setMobileView("map");
                          }}
                          className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-b-0"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                            style={{ backgroundColor: meta.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 leading-snug break-words">
                              {sh.name}
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5 leading-relaxed break-words">
                              {[sh.owner_name, sh.village, sh.district].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
            </div>
          </div>
        </div>

        {dashboardInsight && (
          <div className="shrink-0 border-b border-gray-200 bg-amber-50/60 px-4 py-2 flex items-center gap-2">
            <Lightbulb size={14} className="text-amber-700 shrink-0" aria-hidden />
            <p className="text-xs text-amber-900 flex-1 min-w-0">
              {dashboardInsight}
              {attentionDelta != null && attentionDelta !== 0 && (
                <span
                  className={`ml-2 font-semibold ${attentionDelta > 0 ? "text-red-700" : "text-emerald-700"}`}
                >
                  {attentionDelta > 0 ? "+" : ""}
                  {attentionDelta} sejak refresh terakhir
                </span>
              )}
            </p>
          </div>
        )}

        {/* Segment Peta/Prioritas — HP saja, di lg: dua panel selalu tampil berdampingan */}
        <div className="lg:hidden shrink-0 border-b border-gray-200 bg-white px-4 py-2">
          <div className="flex bg-gray-100 rounded-xl p-1">
            {[
              { key: "map", label: "Peta" },
              { key: "list", label: "Prioritas" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMobileView(tab.key)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  mobileView === tab.key ? "bg-white text-emerald-800 shadow-sm" : "text-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col lg:flex-row overflow-hidden min-h-0">
          <div
            className={`dashboard-map relative overflow-hidden isolate z-0 min-h-0 ${
              mobileView === "map" ? "flex-1" : "hidden"
            } lg:block lg:flex-1`}
          >
            {(pageLoading || mapSummaryLoading) && (
              <MapLoadingOverlay
                message={pageLoading ? "Memuat screenhouse..." : "Memuat status peta..."}
              />
            )}
            <MapContainer
              center={[-6.9175, 106.9287]}
              zoom={10}
              className="h-full w-full"
              zoomControl={false}
              ref={mapRef}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MarkerClusterGroup
                ref={clusterRef}
                chunkedLoading
                maxClusterRadius={55}
                showCoverageOnHover={false}
                spiderfyOnMaxZoom
              >
              {filteredScreenhouses.map((sh) => {
                const summary = mapSummary[sh.id];
                const status = summary?.status ?? "offline";
                const meta = getStatusMeta(status);
                const abnormal = summary?.abnormal ?? [];

                return (
                  <Marker
                    key={`${sh.id}-${status}`}
                    position={[sh.latitude, sh.longitude]}
                    icon={statusIcon(status)}
                    ref={(ref) => {
                      markerRefs.current[sh.id] = ref;
                    }}
                  >
                    <Popup>
                      <div className="min-w-[240px]">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/operator/screenhouse/${sh.id}`)}
                            className="text-base font-bold text-bl-primary hover:text-bl-dark hover:underline text-left"
                          >
                            {sh.name}
                          </button>
                          <span
                            className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                        </div>

                        {/* Isu paling mendesak duluan */}
                        <div className="mt-2 space-y-1.5">
                          {!summary ? (
                            <div className="text-xs text-slate-600">Memuat status...</div>
                          ) : (
                            <>
                              <div
                                className={`rounded-lg px-3 py-2 text-xs font-medium ${meta.badgeClass}`}
                              >
                                {summary.insight}
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                                <span className="flex items-center gap-1">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`}
                                  />
                                  {status === "offline"
                                    ? `Tidak terhubung, ${timeAgo(summary.last_seen)}`
                                    : `Diperbarui ${timeAgo(summary.last_seen)}`}
                                </span>
                                {summary.active_alerts > 0 && (
                                  <span
                                    className={
                                      summary.alerts_pending_review
                                        ? "text-amber-600 font-semibold"
                                        : "text-red-600 font-semibold"
                                    }
                                  >
                                    {summary.active_alerts} alert aktif
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {sh.owner_phone && (
                          <div className="flex flex-wrap gap-2 mt-2.5">
                            <a
                              href={telUrl(sh.owner_phone)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-medium hover:bg-slate-200"
                            >
                              <Phone size={12} />
                              Telepon
                            </a>
                            {whatsAppUrl(sh.owner_phone) && (
                              <a
                                href={whatsAppUrl(sh.owner_phone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-800 text-[11px] font-medium hover:bg-green-100"
                              >
                                <MessageCircle size={12} />
                                WhatsApp
                              </a>
                            )}
                          </div>
                        )}

                        {/* Detail pendukung — alamat, pemilik, parameter lain */}
                        <details className="mt-2.5 group">
                          <summary className="text-[11px] font-medium text-slate-500 cursor-pointer list-none flex items-center gap-1">
                            Detail alamat &amp; parameter lain
                            <ChevronDown size={12} className="transition-transform group-open:rotate-180" aria-hidden />
                          </summary>
                          <div className="mt-1.5 space-y-1.5">
                            {sh.owner_name && (
                              <p className="text-xs text-slate-600 font-medium flex items-center gap-1">
                                <User size={11} className="shrink-0" />
                                {sh.owner_name}
                              </p>
                            )}
                            <p className="text-xs text-slate-600 font-medium flex items-start gap-1">
                              <MapPin size={11} className="shrink-0 mt-0.5" />
                              {[sh.address_detail, sh.village, sh.district]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                            {summary && (
                              <>
                                {abnormal.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {abnormal.map((a) => (
                                      <span
                                        key={a.key}
                                        className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 text-[10px] text-slate-600"
                                      >
                                        {a.direction === "high" ? (
                                          <ArrowUp size={10} className="text-red-500 shrink-0" aria-hidden />
                                        ) : (
                                          <ArrowDown size={10} className="text-amber-500 shrink-0" aria-hidden />
                                        )}
                                        {a.label}: {a.value}
                                        {METRIC_UNIT[a.key] || ""}
                                        <span className="text-slate-600">
                                          (≤{a.max}
                                          {METRIC_UNIT[a.key] || ""})
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                ) : summary.alerts_pending_review ? (
                                  <p className="text-[11px] text-amber-700">
                                    Sensor normal, alert menunggu ditinjau petani
                                  </p>
                                ) : (
                                  status !== "offline" &&
                                  summary.has_threshold && (
                                    <p className="text-[11px] text-bl-primary flex items-center gap-1">
                                      <CheckCircle2 size={12} className="shrink-0" aria-hidden />
                                      Semua parameter dalam batas normal
                                    </p>
                                  )
                                )}
                                {summary.node_name && (
                                  <p className="text-[10px] text-slate-600">
                                    {formatRackName(summary.node_name)}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </details>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
              </MarkerClusterGroup>
            </MapContainer>
          </div>

          {/* Panel kanan — dua section terpisah, masing-masing scroll sendiri */}
          <div
            className={`w-full lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white flex-col overflow-hidden min-h-0 ${
              mobileView === "list" ? "flex" : "hidden"
            } lg:flex lg:max-h-none`}
          >
            <div className="shrink-0 border-b border-gray-100 px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2">Status sistem</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-500">Screenhouse aktif</div>
                  <div className="text-2xl font-semibold text-gray-900 mt-1 tabular-nums">
                    {footerStats.screenhouseCount}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-500">Kirim data 24 jam</div>
                  <div className="text-2xl font-semibold text-gray-900 mt-1 tabular-nums">
                    {footerStats.onlineSinkCount}
                  </div>
                </div>
              </div>
            </div>

            {priorityList.all.length > 0 && (
              <section className="flex flex-col flex-1 min-h-0">
                <div className="px-4 py-3 border-b border-amber-100 bg-amber-50/50 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                    <AlertTriangle size={14} className="shrink-0" />
                    Perlu tindak lanjut ({priorityList.all.length})
                  </div>
                  <p className="text-xs text-amber-800/80 mt-1 leading-snug">
                  Hubungi petani melalui telepon atau WhatsApp untuk memberikan pengingat, melakukan evaluasi, atau menanyakan kendala yang dihadapi.
                  </p>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
                  <div className="space-y-2">
                    {priorityList.all.map((sh) => (
                      <button
                        key={`prio-${sh.id}`}
                        type="button"
                        onClick={() => focusScreenhouse(sh)}
                        className={`w-full text-left p-3 rounded-xl border transition ${
                          selectedId === sh.id
                            ? "bg-bl-surface-muted border-bl-accent/30"
                            : "border-amber-100 bg-amber-50/40 hover:bg-amber-50/70"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                            style={{ backgroundColor: sh.meta.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 leading-snug break-words">
                              {sh.name}
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                              {sh.meta.label}
                              {sh.activeAlerts > 0 ? `, ${sh.activeAlerts} peringatan` : ""}
                              {sh.owner_name ? ` · ${sh.owner_name}` : ""}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {loadError ? (
              <div className="shrink-0 px-4 py-6 text-center border-t border-gray-100">
                <AlertTriangle size={22} className="mx-auto text-amber-500" aria-hidden />
                <p className="text-sm text-gray-700 mt-2">Gagal memuat data screenhouse.</p>
                <p className="text-xs text-gray-500 mt-1">Periksa koneksi atau server, lalu coba lagi.</p>
                <button
                  type="button"
                  onClick={loadScreenhouses}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg btn-bl px-4 py-2 text-xs"
                >
                  <RefreshCw size={13} aria-hidden />
                  Coba lagi
                </button>
              </div>
            ) : (
              !pageLoading &&
              filteredScreenhouses.length === 0 && (
                <div className="shrink-0 px-4 py-6 text-center text-sm text-gray-500 border-t border-gray-100">
                  Tidak ada screenhouse aktif{wilayahActive ? " di wilayah ini" : ""}.
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OperatorDashboard;
