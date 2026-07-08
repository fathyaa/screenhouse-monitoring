import { useCallback, useEffect, useMemo, useState } from "react";
import { useScreenhouseStats } from "../context/ScreenhouseStatsContext";
import {
  LayoutDashboard,
  Map,
  Radio,
  Leaf,
  Plus,
  Wifi,
  CheckCircle,
  LogOut,
  User,
  Users,
  SlidersHorizontal,
  FileBarChart,
  Bell,
  RefreshCw,
  Settings,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { disconnectSocket } from "../lib/socket";
import { useAlerts } from "../context/AlertContext";
import { usePushNotifications } from "../context/PushNotificationContext";
import { FARMER_LABELS } from "../constants/farmerLabels";

import { API_URL } from "../config/api";

const MENUS_BY_ROLE = {
  operator: [
    { icon: <LayoutDashboard size={17} />, label: "Dashboard", path: "/operator" },
    { icon: <FileBarChart size={17} />, label: "Laporan Wilayah", path: "/operator/laporan" },
    { icon: <Map size={17} />, label: "Approval Petani", path: "/operator/approval" },
    { icon: <Users size={17} />, label: "Daftar Petani", path: "/operator/petani" },
  ],
  petani: [
    { icon: <LayoutDashboard size={17} />, label: "Dashboard", path: "/petani" },
    { icon: <Bell size={17} />, label: "Peringatan", path: "/petani/peringatan", alertBadge: true },
    { icon: <Plus size={17} />, label: "Ajukan Screenhouse", path: "/petani/ajukan-screenhouse" },
    { icon: <FileBarChart size={17} />, label: "Riwayat Semai", path: "/petani/riwayat-semai" },
  ],
  super_admin: [
    { icon: <User size={17} />, label: "Kelola User", path: "/admin/kelola-user" },
    { icon: <Leaf size={17} />, label: "Kelola Screenhouse", path: "/admin/kelola-screenhouse" },
    { icon: <SlidersHorizontal size={17} />, label: "Kelola batas aman", path: "/admin/kelola-threshold" },
    { icon: <Radio size={17} />, label: "Konfigurasi", path: "/admin/konfigurasi" },
    { icon: <LayoutDashboard size={17} />, label: "Dashboard Operator", path: "/operator" },
    { icon: <FileBarChart size={17} />, label: "Laporan Wilayah", path: "/operator/laporan" },
    { icon: <Map size={17} />, label: "Approval Petani", path: "/operator/approval" },
    { icon: <Users size={17} />, label: "Daftar Petani", path: "/operator/petani" },
  ],
};

function Sidebar({ isOpen, onClose, screenhouses = [], role = "operator", user: userProp }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileUser, setProfileUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });
  const user = profileUser ?? userProp;
  const { unreadCount } = useAlerts();
  const { muted: notifMuted, loading: pushLoading, toggle: togglePush, supported: pushSupported, getUnsupportedMessage } = usePushNotifications();
  const notifEnabled = !notifMuted;
  const { footerStats, footerStatsLoading, refetch: fetchFooterStats } = useScreenhouseStats();
  const [pendingApprovals, setPendingApprovals] = useState(0);

  const fetchPendingApprovals = useCallback(() => {
    if (role !== "operator" && role !== "super_admin") {
      setPendingApprovals(0);
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch(`${API_URL}/auth/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setPendingApprovals(data.pending ?? 0);
      })
      .catch(console.error);
  }, [role]);

  const menus = useMemo(() => {
    const base = MENUS_BY_ROLE[role] || MENUS_BY_ROLE.operator;
    return base.map((item) => {
      if (item.path === "/operator/approval") {
        return { ...item, badge: pendingApprovals };
      }
      if (item.alertBadge) {
        return { ...item, badge: unreadCount };
      }
      return item;
    });
  }, [role, pendingApprovals, unreadCount]);

  const activePath = menus
    .map((m) => m.path)
    .filter(
      (path) =>
        location.pathname === path || location.pathname.startsWith(`${path}/`)
    )
    .sort((a, b) => b.length - a.length)[0];

  const isActive = (path) => path === activePath;

  const settingsPath =
    role === "petani"
      ? "/petani/pengaturan"
      : role === "super_admin"
      ? "/admin/pengaturan"
      : "/operator/pengaturan";

  useEffect(() => {
    const syncUser = () => {
      try {
        setProfileUser(JSON.parse(localStorage.getItem("user") || "null"));
      } catch {
        setProfileUser(null);
      }
    };
    window.addEventListener("auth-changed", syncUser);
    return () => window.removeEventListener("auth-changed", syncUser);
  }, []);

  useEffect(() => {
    fetchPendingApprovals();
    window.addEventListener("approval-changed", fetchPendingApprovals);
    const interval = setInterval(fetchPendingApprovals, 60000);
    return () => {
      window.removeEventListener("approval-changed", fetchPendingApprovals);
      clearInterval(interval);
    };
  }, [fetchPendingApprovals]);

  const screenhouseCount =
    role === "operator" || role === "super_admin"
      ? footerStats.screenhouseCount
      : screenhouses.length || footerStats.screenhouseCount;

  const handleNavigate = (path) => {
    navigate(path);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      onClose?.();
    }
  };

  const handleLogout = () => {
    disconnectSocket();
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    localStorage.removeItem("push_subscribed");
    localStorage.removeItem("push_muted");
    window.dispatchEvent(new Event("auth-changed"));
    navigate("/login");
    onClose?.();
  };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Tutup menu"
          className="fixed inset-0 z-[990] bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-[1000] lg:z-auto
          h-full w-[min(280px,85vw)]
          flex flex-col bg-bl-forest text-white shrink-0 text-left
          transition-[width,transform] duration-300 ease-in-out
          overflow-hidden
          ${isOpen ? "translate-x-0 lg:w-[280px]" : "-translate-x-full lg:translate-x-0 lg:w-0 lg:min-w-0"}
        `}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >

      {/* BRAND */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-white/10 shrink-0">
        <img
          src="/logo-bibitlive.png"
          alt=""
          className="w-9 h-9 rounded-xl object-cover shrink-0 ring-1 ring-white/15"
        />
        <div className="whitespace-nowrap text-left">
          <div className="text-sm font-semibold tracking-tight">BibitLive</div>
          <div className="text-xs text-bl-mint">Pantau bibit langsung</div>
        </div>
      </div>

      {/* PROFILE */}
      <div className="p-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left space-y-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{user?.name || "Unknown User"}</div>
            <div className="text-xs text-white/50 mt-1 capitalize">{role?.replace("_", " ")}</div>
          </div>

          {role === "petani" && (
            <div className="pt-3 border-t border-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-white/80">{FARMER_LABELS.phoneNotifications}</div>
                  <div className="text-[10px] text-white/40 mt-0.5 leading-snug">
                    {notifEnabled
                      ? "Aktif — bunyi & peringatan menyala di semua perangkat"
                      : "Nonaktif — bunyi & peringatan dimatikan di semua perangkat"}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifEnabled}
                  onClick={togglePush}
                  disabled={pushLoading}
                  title={
                    notifEnabled
                      ? "Matikan notifikasi"
                      : !pushSupported
                        ? getUnsupportedMessage()
                        : "Aktifkan notifikasi"
                  }
                  aria-label={notifEnabled ? "Matikan notifikasi" : "Aktifkan notifikasi"}
                  className={`relative shrink-0 w-11 h-6 rounded-full transition disabled:opacity-50 ${
                    notifEnabled ? "bg-bl-primary" : "bg-white/15"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      notifEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => handleNavigate(settingsPath)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-white/10 text-xs font-medium text-white/80 hover:bg-white/5 hover:text-white transition"
          >
            <Settings size={14} />
            Pengaturan akun
          </button>
        </div>
      </div>

      {/* MENU */}
      <div className="px-3 flex flex-col gap-0.5 overflow-y-auto flex-1">
        <p className="text-[10px] uppercase tracking-widest text-white/30 font-medium px-3 py-2 whitespace-nowrap text-left">Menu</p>
        {menus.map(({ icon, label, badge, path }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => handleNavigate(path)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition w-full text-left ${active ? "bg-bl-primary text-white shadow-sm shadow-black/10" : "text-white/55 hover:bg-white/5 hover:text-white"}`}
            >
              {icon}
              {label}
              {badge > 0 && (
                <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-bl-live text-white text-[10px] font-bold flex items-center justify-center">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* STATUS */}
      {role === "petani" ? (
        <>
          <div className="mx-4 border-t border-white/10 mt-4" />
          <div className="p-3 flex flex-col gap-0.5 text-left shrink-0">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-white/30 font-medium">Status screenhouse</p>
              <button
                type="button"
                onClick={() => fetchFooterStats()}
                disabled={footerStatsLoading}
                title="Perbarui status"
                aria-label="Perbarui status screenhouse"
                className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition disabled:opacity-50"
              >
                <RefreshCw size={14} className={footerStatsLoading ? "animate-spin" : ""} />
              </button>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 text-sm text-white/55">
              <CheckCircle size={17} className="text-bl-mint shrink-0" />
              {footerStats.screenhouseCount > 0
                ? `${footerStats.screenhouseCount} screenhouse aktif`
                : "Belum ada screenhouse aktif"}
            </div>
            <div className="flex items-center gap-3 px-3 py-2 text-sm text-white/55">
              <Wifi size={17} className="text-bl-mint shrink-0" />
              {footerStats.sinkNodeCount > 0
                ? `${footerStats.onlineSinkCount}/${footerStats.sinkNodeCount} alat terhubung`
                : `Ketuk ${FARMER_LABELS.refresh.toLowerCase()} untuk cek alat`}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mx-4 border-t border-white/10 mt-4" />
          <div className="p-3 flex flex-col gap-0.5 text-left shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-white/30 font-medium px-3 py-2">Status sistem</p>
            <div className="flex items-center gap-3 px-3 py-2 text-sm text-white/55">
              <CheckCircle size={17} className="text-bl-mint shrink-0" />
              {footerStats.screenhouseCount > 0
                ? `${footerStats.onlineSinkCount}/${footerStats.sinkNodeCount} screenhouse kirim data`
                : "Menunggu data screenhouse"}
            </div>
            <div className="flex items-center gap-3 px-3 py-2 text-sm text-white/55">
              <Wifi size={17} className="text-bl-mint shrink-0" />
              Pembaruan otomatis aktif
            </div>
          </div>
        </>
      )}

      {/* FOOTER */}
      <div className="mt-auto p-4 border-t border-white/10 text-left shrink-0">
        {role !== "petani" && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white/5 rounded-xl p-3 text-left">
              <div className="text-xs text-white/40">Screenhouse aktif</div>
              <div className="text-2xl font-semibold mt-1">{screenhouseCount}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-left">
              <div className="text-xs text-white/40">Kirim data 24 jam</div>
              <div className="text-2xl font-semibold mt-1">{footerStats.onlineSinkCount}</div>
            </div>
          </div>
        )}
        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 text-sm font-medium text-white/70 hover:text-red-200 transition">
          <LogOut size={16} />Logout
        </button>
      </div>
      </aside>
    </>
  );
}

export default Sidebar;
