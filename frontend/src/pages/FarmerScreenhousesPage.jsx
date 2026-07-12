import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, ChevronRight, Leaf, MapPin, Menu, Phone, User } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";

import { API_URL } from "../config/api";
import { BannerSkeleton, ScreenhouseCardsSkeleton } from "../components/LoadingUI";

function FarmerScreenhousesPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
  const [loading, setLoading] = useState(true);
  const [farmer, setFarmer] = useState(null);
  const [screenhouses, setScreenhouses] = useState([]);
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetch(`${API_URL}/auth/farmers/${userId}/screenhouses`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setFarmer(data.farmer);
        setScreenhouses(Array.isArray(data.screenhouses) ? data.screenhouses : []);
      })
      .catch(() => {
        toast.error("Gagal memuat data petani");
        navigate("/operator/petani");
      })
      .finally(() => setLoading(false));
  }, [userId, token, navigate]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const statusLabel = (status) => {
    if (status === "active") return { text: "Aktif", className: "bg-bl-surface-muted text-bl-primary" };
    if (status === "pending") return { text: "Pending", className: "bg-amber-50 text-amber-700" };
    return { text: status || "-", className: "bg-gray-100 text-gray-600" };
  };

  return (
    <div className="app-shell fixed inset-0 flex bg-bl-surface overflow-hidden text-left">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} role={user?.role} user={user} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 text-left">
        <header className="app-topbar h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition shrink-0"
              aria-label="Toggle sidebar"
            >
              <Menu size={20} className="text-gray-600 font-medium" />
            </button>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-800 truncate">Screenhouse milik petani</div>
              <div className="text-xs text-gray-600 truncate">
                {farmer?.name ? `Daftar screenhouse ${farmer.name}` : "Memuat..."}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <button
            type="button"
            onClick={() => navigate("/operator/petani")}
            className="flex items-center gap-1.5 text-xs text-gray-600 font-medium hover:text-gray-800"
          >
            <ArrowLeft size={14} />
            Kembali ke daftar petani
          </button>

          {loading ? (
            <>
              <BannerSkeleton />
              <ScreenhouseCardsSkeleton count={3} />
            </>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap gap-4 items-center">
                <div className="w-10 h-10 rounded-xl bg-bl-surface-muted flex items-center justify-center">
                  <User size={18} className="text-bl-primary" />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <div className="text-sm font-semibold text-gray-800">{farmer.name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium mt-1">
                    <Phone size={12} />
                    {farmer.phone_number}
                  </div>
                </div>
                <div className="text-xs text-gray-600 font-medium">
                  Terdaftar {formatDate(farmer.created_at)}
                </div>
                <div className="text-xs font-medium text-gray-600">
                  {screenhouses.length} screenhouse
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {screenhouses.length === 0 ? (
                  <div className="p-6 text-sm text-gray-600">
                    Petani ini belum memiliki screenhouse aktif
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {screenhouses.map((sh) => {
                      const badge = statusLabel(sh.status);
                      return (
                        <button
                          key={sh.id}
                          type="button"
                          onClick={() => navigate(`/operator/screenhouse/${sh.id}`)}
                          className="w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition text-left"
                        >
                          <div className="w-9 h-9 rounded-xl bg-bl-surface-muted flex items-center justify-center shrink-0">
                            <Leaf size={16} className="text-bl-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-800">{sh.name}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.className}`}>
                                {badge.text}
                              </span>
                            </div>
                            {sh.address_detail && (
                              <div className="text-xs text-gray-600 font-medium mt-1">{sh.address_detail}</div>
                            )}
                            <div className="text-xs text-gray-600 font-medium mt-1">
                              {[sh.village, sh.district, sh.regency, sh.province].filter(Boolean).join(", ")}
                            </div>
                            {sh.latitude != null && sh.longitude != null && (
                              <div className="flex items-center gap-1 text-[11px] text-gray-600 mt-1">
                                <MapPin size={11} />
                                {Number(sh.latitude).toFixed(5)}, {Number(sh.longitude).toFixed(5)}
                              </div>
                            )}
                          </div>
                          <ChevronRight size={18} className="text-gray-500 shrink-0 mt-1" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default FarmerScreenhousesPage;
