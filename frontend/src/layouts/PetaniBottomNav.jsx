import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Bell, History, User } from "lucide-react";
import { useAlerts } from "../context/AlertContext";

// Tab utama petani untuk bottom navigation (mobile). Ditaruh di zona jempol —
// hamburger drawer di kiri-atas terlalu jauh untuk app standalone di HP.
const TABS = [
  {
    label: "Beranda",
    icon: LayoutDashboard,
    path: "/petani",
    isActive: (p) => p === "/petani" || p.startsWith("/petani/screenhouse"),
  },
  {
    label: "Peringatan",
    icon: Bell,
    path: "/petani/peringatan",
    badge: true,
    isActive: (p) => p.startsWith("/petani/peringatan"),
  },
  {
    label: "Riwayat",
    icon: History,
    path: "/petani/riwayat-semai",
    isActive: (p) => p.startsWith("/petani/riwayat-semai"),
  },
  {
    label: "Akun",
    icon: User,
    path: "/petani/pengaturan",
    isActive: (p) => p.startsWith("/petani/pengaturan"),
  },
];

export default function PetaniBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useAlerts();

  return (
    <nav
      className="lg:hidden shrink-0 bg-white border-t border-gray-200 flex text-left"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigasi utama"
    >
      {TABS.map(({ label, icon: Icon, path, badge, isActive }) => {
        const active = isActive(location.pathname);
        return (
          <button
            key={path}
            type="button"
            onClick={() => {
              if (location.pathname !== path) navigate(path);
            }}
            aria-current={active ? "page" : undefined}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-1.5 transition ${
              active ? "text-bl-primary" : "text-gray-500"
            }`}
          >
            <span className="relative">
              <Icon size={23} strokeWidth={active ? 2.4 : 1.9} />
              {badge && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </span>
            <span className={`text-[11px] ${active ? "font-semibold" : "font-medium"}`}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
