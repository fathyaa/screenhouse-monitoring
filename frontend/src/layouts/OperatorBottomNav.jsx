import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ClipboardCheck, FileBarChart, LayoutDashboard, Users } from "lucide-react";
import { API_URL } from "../config/api";

/**
 * Menu bar bawah untuk operator — HP saja (lg: sidebar sudah tampil).
 * Fitur inti: Dashboard peta, Laporan wilayah, Persetujuan (badge pending),
 * Daftar petani. Tren & pengaturan tetap lewat sidebar (hamburger).
 */
const NAV_ITEMS = [
  { path: "/operator", label: "Dashboard", icon: LayoutDashboard },
  { path: "/operator/laporan", label: "Laporan", icon: FileBarChart },
  { path: "/operator/approval", label: "Persetujuan", icon: ClipboardCheck, showPending: true },
  { path: "/operator/petani", label: "Petani", icon: Users },
];

function getRole() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null")?.role ?? null;
  } catch {
    return null;
  }
}

export default function OperatorBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState(0);
  const isOperator = getRole() === "operator";

  useEffect(() => {
    if (!isOperator) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/auth/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setPending(data.pending ?? 0);
      })
      .catch(() => {});
  }, [location.pathname, isOperator]);

  // Super admin punya struktur menu sendiri di sidebar — nav ini khusus operator.
  if (!isOperator) return null;

  // Path aktif = prefix terpanjang yang cocok (pola sama dengan Sidebar).
  const activePath = NAV_ITEMS.map((m) => m.path)
    .filter((p) => location.pathname === p || location.pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav
      className="lg:hidden shrink-0 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]"
      aria-label="Menu utama operator"
    >
      <div className="grid grid-cols-4">
        {NAV_ITEMS.map(({ path, label, icon: Icon, showPending }) => {
          const active = path === activePath;
          return (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                active ? "text-bl-primary" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span className="relative">
                <Icon size={19} strokeWidth={active ? 2.4 : 2} aria-hidden />
                {showPending && pending > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {pending > 99 ? "99+" : pending}
                  </span>
                )}
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
