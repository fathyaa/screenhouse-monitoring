import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Map,
  Radio,
  Leaf,
  Wifi,
  CheckCircle,
  Bell,
  LogOut,
  User,
  SlidersHorizontal,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAlerts } from "../context/AlertContext";
import { disconnectSocket } from "../lib/socket";

const API = "http://localhost:8000";

function Sidebar({ isOpen, screenhouses = [], role = "operator", user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeCount } = useAlerts();
  const [footerStats, setFooterStats] = useState({ screenhouseCount: 0, deviceCount: 0 });

  const menusByRole = {
    operator: [
      { icon: <LayoutDashboard size={17} />, label: "Dashboard", path: "/operator" },
      { icon: <Map size={17} />, label: "Approval Petani", path: "/operator/approval" },
    ],
    petani: [
      { icon: <LayoutDashboard size={17} />, label: "Dashboard", path: "/petani" },
      { icon: <Bell size={17} />, label: "Notifikasi", path: "/petani/notifikasi", badge: activeCount },
    ],
    super_admin: [
      { icon: <User size={17} />, label: "Kelola User", path: "/admin/kelola-user" },
      { icon: <Leaf size={17} />, label: "Kelola Screenhouse", path: "/admin/kelola-screenhouse" },
      { icon: <SlidersHorizontal size={17} />, label: "Kelola Threshold", path: "/admin/kelola-threshold" },
      { icon: <Radio size={17} />, label: "Konfigurasi", path: "/admin/konfigurasi" },
      { icon: <LayoutDashboard size={17} />, label: "Dashboard Operator", path: "/operator" },
      { icon: <Map size={17} />, label: "Approval Petani", path: "/operator/approval" },
    ],
  };

  const menus = menusByRole[role] || menusByRole.operator;

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    if (role === "operator" || role === "super_admin") {
      fetch(`${API}/screenhouses/operator-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setFooterStats({
              screenhouseCount: data.screenhouse_count ?? 0,
              deviceCount: data.device_count ?? 0,
            });
          }
        })
        .catch(console.error);
      return;
    }

    if (role === "petani") {
      fetch(`${API}/screenhouses/my-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setFooterStats({
              screenhouseCount: data.screenhouse_count ?? screenhouses.length,
              deviceCount: data.active_nodes ?? 0,
            });
          }
        })
        .catch(console.error);
    }
  }, [role, screenhouses.length]);

  const screenhouseCount =
    role === "operator" || role === "super_admin"
      ? footerStats.screenhouseCount
      : screenhouses.length || footerStats.screenhouseCount;

  const deviceCount =
    role === "operator" || role === "super_admin"
      ? footerStats.deviceCount
      : footerStats.deviceCount;

  const handleLogout = () => {
    disconnectSocket();
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth-changed"));
    navigate("/login");
  };

  return (
    <aside className={`h-full flex flex-col bg-[#0f2d18] text-white transition-all duration-300 overflow-hidden shrink-0 text-left ${isOpen ? "w-[280px]" : "w-0"}`}>

      {/* BRAND */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-white/10 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-[#1e4d2b] flex items-center justify-center text-lg shrink-0">🌾</div>
        <div className="whitespace-nowrap text-left">
          <div className="text-sm font-semibold">Screenhouse</div>
          <div className="text-xs text-[#6aab7a]">Monitoring System</div>
        </div>
      </div>

      {/* PROFILE */}
      <div className="p-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left">
          <div className="text-sm font-semibold">{user?.name || "Unknown User"}</div>
          <div className="text-xs text-white/50 mt-1 capitalize">{role?.replace("_", " ")}</div>
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
              onClick={() => navigate(path)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition w-full text-left ${active ? "bg-[#1e4d2b] text-white" : "text-white/55 hover:bg-white/5 hover:text-white"}`}
            >
              {icon}
              {label}
              {badge > 0 && (
                <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* STATUS */}
      {role !== "petani" && (
        <>
          <div className="mx-4 border-t border-white/10 mt-4" />
          <div className="p-3 flex flex-col gap-0.5 text-left shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-white/30 font-medium px-3 py-2">Status</p>
            <div className="flex items-center gap-3 px-3 py-2 text-sm text-white/55">
              <CheckCircle size={17} className="text-green-400 shrink-0" />Realtime aktif
            </div>
            <div className="flex items-center gap-3 px-3 py-2 text-sm text-white/55">
              <Wifi size={17} className="text-green-400 shrink-0" />MQTT terhubung
            </div>
          </div>
        </>
      )}

      {/* FOOTER */}
      <div className="mt-auto p-4 border-t border-white/10 text-left shrink-0">
        {role !== "petani" && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white/5 rounded-xl p-3 text-left">
              <div className="text-xs text-white/40">Screenhouse</div>
              <div className="text-2xl font-semibold mt-1">{screenhouseCount}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-left">
              <div className="text-xs text-white/40">Device</div>
              <div className="text-2xl font-semibold mt-1">{deviceCount}</div>
            </div>
          </div>
        )}
        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 text-sm font-medium text-white/70 hover:text-red-200 transition">
          <LogOut size={16} />Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
