import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import Sidebar from "../layouts/Sidebar";
import OperatorTopbar from "../layouts/OperatorTopbar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import { API_URL } from "../config/api";
import { THRESHOLD_METRICS } from "../constants/thresholdMetrics";
import {
  getStatusMeta,
  timeAgo,
  STATUS_ORDER,
  SCREENHOUSE_STATUS,
} from "../constants/screenhouseStatus";

const METRIC_UNIT = Object.fromEntries(
  THRESHOLD_METRICS.map((m) => [m.key, m.unit])
);

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

function OperatorDashboard() {
  const navigate = useNavigate();
  const [screenhouses, setScreenhouses] = useState([]);
  const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
  const user = JSON.parse(
    localStorage.getItem("user")
  );
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [mapSummary, setMapSummary] = useState({});
  const mapRef = useRef(null);
  const markerRefs = useRef({});

  useEffect(() => {
    const token =
      localStorage.getItem("token");

    fetch(`${API_URL}/screenhouses`, {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      }
    )
      .then((res) => res.json())
      .then(setScreenhouses);
  }, []);

  useEffect(() => {
    let active = true;

    const loadSummary = async () => {
      try {
        const res = await fetch(`${API_URL}/sensor-data/map-summary`);
        const data = await res.json();
        if (!active || !Array.isArray(data)) return;
        setMapSummary(
          Object.fromEntries(data.map((item) => [item.screenhouse_id, item]))
        );
      } catch (err) {
        console.log(err);
      }
    };

    loadSummary();
    const interval = setInterval(loadSummary, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const statusCounts = useMemo(() => {
    const counts = { healthy: 0, warning: 0, critical: 0, offline: 0 };
    for (const sh of screenhouses) {
      const status = mapSummary[sh.id]?.status ?? "offline";
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }, [screenhouses, mapSummary]);

  const filteredScreenhouses = screenhouses.filter((sh) => {
    const keyword = search.toLowerCase();

    return (
      sh.name?.toLowerCase().includes(keyword) ||
      sh.owner_name?.toLowerCase().includes(keyword) ||
      sh.address_detail?.toLowerCase().includes(keyword) ||
      sh.village?.toLowerCase().includes(keyword) ||
      sh.district?.toLowerCase().includes(keyword) ||
      sh.province?.toLowerCase().includes(keyword)
    );
  });

  const focusScreenhouse = (screenhouse) => {
    setSelectedId(screenhouse.id);

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
          subtitle="Monitoring realtime · peta screenhouse"
        />

        <div className="flex flex-1 flex-col lg:flex-row overflow-hidden min-h-0">
          <div className="dashboard-map flex-1 relative overflow-hidden min-h-[45dvh] lg:min-h-0 isolate z-0">
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
              {filteredScreenhouses.map((sh) => {
                const summary = mapSummary[sh.id];
                const status = summary?.status ?? "offline";
                const meta = getStatusMeta(status);
                const abnormal = summary?.abnormal ?? [];

                return (
                  <Marker
                    key={sh.id}
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

                        {sh.owner_name && (
                          <p className="text-xs text-slate-500 mt-1">
                            👤 {sh.owner_name}
                          </p>
                        )}

                        <p className="text-xs text-slate-500 mt-1">
                          📍{" "}
                          {[sh.address_detail, sh.village, sh.district]
                            .filter(Boolean)
                            .join(", ")}
                        </p>

                        {/* INSIGHT */}
                        <div className="mt-3 space-y-2">
                          {!summary && (
                            <div className="text-xs text-slate-400">
                              Memuat status...
                            </div>
                          )}

                          {summary && (
                            <>
                              <div
                                className={`rounded-lg px-3 py-2 text-xs font-medium ${meta.badgeClass}`}
                              >
                                {summary.insight}
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span className="flex items-center gap-1">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`}
                                  />
                                  {status === "offline"
                                    ? `Offline · ${timeAgo(summary.last_seen)}`
                                    : `Update ${timeAgo(summary.last_seen)}`}
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

                              {abnormal.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {abnormal.map((a) => (
                                    <span
                                      key={a.key}
                                      className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 text-[10px] text-slate-600"
                                    >
                                      <span
                                        className={
                                          a.direction === "high"
                                            ? "text-red-500"
                                            : "text-amber-500"
                                        }
                                      >
                                        {a.direction === "high" ? "▲" : "▼"}
                                      </span>
                                      {a.label}: {a.value}
                                      {METRIC_UNIT[a.key] || ""}
                                      <span className="text-slate-400">
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
                                  <p className="text-[11px] text-bl-primary">
                                    ✓ Semua parameter dalam batas normal
                                  </p>
                                )
                              )}

                              {summary.node_name && (
                                <p className="text-[10px] text-slate-400">
                                  Node: {summary.node_name}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            {/* LEGEND */}
            <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-[500] bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 px-3 py-2.5 max-w-[calc(100%-1.5rem)]">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5">
                Status screenhouse
              </div>
              <div className="space-y-1">
                {STATUS_ORDER.map((key) => {
                  const meta = SCREENHOUSE_STATUS[key];
                  return (
                    <div key={key} className="flex items-center gap-2 text-xs text-gray-600">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="flex-1">{meta.label}</span>
                      <span className="tabular-nums font-medium text-gray-500">
                        {statusCounts[key]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* LIST PANEL KANAN */}
          <div className="w-full lg:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white flex flex-col overflow-hidden max-h-[45dvh] lg:max-h-none">
            <div className="px-4 py-4 border-b border-gray-100">
              <div className="text-xs uppercase tracking-widest text-gray-400 font-medium mb-3">
                Daftar screenhouse
              </div>
              <input
                type="text"
                placeholder="Cari nama, owner, alamat..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100 focus:border-green-300"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredScreenhouses.map((sh, i) => {
                const status = mapSummary[sh.id]?.status ?? "offline";
                const meta = getStatusMeta(status);
                return (
                  <div
                    key={sh.id}
                    onClick={() => focusScreenhouse(sh)}
                    className={`
                      flex items-center gap-3 p-3 rounded-xl cursor-pointer mb-1
                      border transition
                      ${selectedId === sh.id
                        ? "bg-bl-surface-muted border-bl-accent/30"
                        : "border-transparent hover:bg-gray-50"
                      }
                    `}
                  >
                    <div className="relative w-7 h-7 rounded-lg bg-bl-primary text-white text-xs font-medium flex items-center justify-center shrink-0">
                      {i + 1}
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
                        style={{ backgroundColor: meta.color }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">
                        {sh.name}
                      </div>
                      <div className="text-xs text-gray-400 truncate mt-0.5">
                        {[sh.village, sh.district].filter(Boolean).join(", ")}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${meta.badgeClass}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OperatorDashboard;
