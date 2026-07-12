import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Sidebar from "../layouts/Sidebar";
import PetaniTopbar from "../layouts/PetaniTopbar";
import PetaniBottomNav from "../layouts/PetaniBottomNav";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import ScreenhouseFormFields from "../components/ScreenhouseFormFields";
import { useScreenhouseFormFields } from "../hooks/useScreenhouseFormFields";
import { LoadingSpinner } from "../components/LoadingUI";
import { API_URL } from "../config/api";

function PetaniAjukanScreenhousePage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const token = localStorage.getItem("token");
  const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
  const [loading, setLoading] = useState(false);

  const {
    screenhouse,
    setScreenhouse,
    wilayah,
    wilayahError,
    resolving,
    handleMapPick,
    validate,
    buildPayload,
  } = useScreenhouseFormFields();

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/screenhouses/mine`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal mengajukan screenhouse");
        return;
      }
      toast.success(data.message || "Pengajuan terkirim");
      navigate("/petani");
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengajukan screenhouse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell fixed inset-0 flex bg-bl-surface overflow-hidden text-left">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        screenhouses={[]}
        role={user?.role}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 text-left">
        <PetaniTopbar
          onToggleSidebar={toggleSidebar}
          onBack={() => navigate("/petani")}
          title="Ajukan screenhouse"
          subtitle="Screenhouse baru perlu disetujui operator"
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="max-w-lg mx-auto bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-4">
            <div>
              <div className="text-base font-semibold text-gray-800">Data screenhouse baru</div>
              <p className="text-xs text-gray-600 mt-1">
                Isi nama dan lokasi. Setelah dikirim, operator akan memverifikasi sebelum screenhouse aktif.
              </p>
            </div>

            <ScreenhouseFormFields
              screenhouse={screenhouse}
              setScreenhouse={setScreenhouse}
              wilayah={wilayah}
              wilayahError={wilayahError}
              resolving={resolving}
              handleMapPick={handleMapPick}
              compact
              token={token}
            />

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || resolving}
              className="w-full h-10 rounded-xl bg-bl-primary hover:bg-bl-primary-hover text-white text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <LoadingSpinner size={16} className="text-white" />}
              {loading ? "Mengirim pengajuan..." : "Kirim pengajuan"}
            </button>
          </div>
        </div>
        <PetaniBottomNav />
      </div>
    </div>
  );
}

export default PetaniAjukanScreenhousePage;
