import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Leaf, MapPin, Layers } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import PetaniTopbar from "../layouts/PetaniTopbar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import LocationPickerMap from "../components/LocationPickerMap";
import VarietasSelect from "../components/VarietasSelect";
import { LoadingSpinner } from "../components/LoadingUI";
import { API_URL } from "../config/api";

function PetaniAjukanScreenhousePage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const token = localStorage.getItem("token");
  const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);

  const [screenhouse, setScreenhouse] = useState({
    name: "",
    address_detail: "",
    latitude: null,
    longitude: null,
    tray_count: 1,
    varietas_id: "",
  });
  const [wilayah, setWilayah] = useState(null);
  const [wilayahError, setWilayahError] = useState("");

  const resolveWilayah = async (lat, lng) => {
    setResolving(true);
    setWilayahError("");
    try {
      const res = await fetch(`${API_URL}/wilayah/resolve?latitude=${lat}&longitude=${lng}`);
      const data = await res.json();
      if (!res.ok) {
        setWilayah(null);
        setWilayahError(data.message || "Wilayah tidak dikenali");
        return;
      }
      setWilayah(data);
    } catch (err) {
      console.error(err);
      setWilayah(null);
      setWilayahError("Gagal membaca wilayah dari peta");
    } finally {
      setResolving(false);
    }
  };

  const handleMapPick = (lat, lng) => {
    const latitude = Number(lat.toFixed(6));
    const longitude = Number(lng.toFixed(6));
    setScreenhouse((prev) => ({ ...prev, latitude, longitude }));
    resolveWilayah(latitude, longitude);
  };

  const handleSubmit = async () => {
    if (!screenhouse.name.trim()) {
      toast.error("Nama screenhouse wajib diisi");
      return;
    }
    if (screenhouse.latitude == null || screenhouse.longitude == null) {
      toast.error("Pilih lokasi screenhouse di peta");
      return;
    }
    if (!wilayah?.province_id) {
      toast.error(wilayahError || "Wilayah belum terdeteksi. Coba pilih titik lain di peta.");
      return;
    }

    const trayCount = Number(screenhouse.tray_count);
    if (!Number.isInteger(trayCount) || trayCount < 1 || trayCount > 20) {
      toast.error("Jumlah tray harus antara 1 dan 20");
      return;
    }

    if (!screenhouse.varietas_id) {
      toast.error("Pilih varietas bibit terlebih dahulu");
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
        body: JSON.stringify({
          name: screenhouse.name.trim(),
          address_detail: screenhouse.address_detail.trim(),
          province_id: wilayah.province_id,
          regency_id: wilayah.regency_id,
          district_id: wilayah.district_id,
          village_id: wilayah.village_id,
          latitude: screenhouse.latitude,
          longitude: screenhouse.longitude,
          tray_count: trayCount,
          varietas_id: Number(screenhouse.varietas_id),
        }),
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

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Nama screenhouse
              </label>
              <div className="flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50">
                <Leaf size={14} className="text-gray-600 shrink-0" />
                <input
                  type="text"
                  value={screenhouse.name}
                  onChange={(e) => setScreenhouse({ ...screenhouse, name: e.target.value })}
                  placeholder="Contoh: Screenhouse Sukabumi 04"
                  className="flex-1 bg-transparent outline-none text-sm text-gray-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Detail alamat (opsional)
              </label>
              <div className="flex items-start gap-2 min-h-10 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                <MapPin size={14} className="text-gray-600 shrink-0 mt-0.5" />
                <textarea
                  value={screenhouse.address_detail}
                  onChange={(e) =>
                    setScreenhouse({ ...screenhouse, address_detail: e.target.value })
                  }
                  placeholder="Contoh: Dekat irigasi timur, blok A"
                  rows={2}
                  className="flex-1 bg-transparent outline-none text-sm text-gray-800 resize-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Jumlah tray terpasang
              </label>
              <div className="flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50">
                <Layers size={14} className="text-gray-600 shrink-0" />
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={screenhouse.tray_count}
                  onChange={(e) =>
                    setScreenhouse({ ...screenhouse, tray_count: e.target.value })
                  }
                  className="flex-1 bg-transparent outline-none text-sm text-gray-800"
                />
              </div>
              <p className="text-[11px] text-gray-600 mt-1">
                Satu tray = satu sensor node. Operator dapat menyesuaikan saat verifikasi.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Varietas bibit
              </label>
              <VarietasSelect
                compact
                token={token}
                value={screenhouse.varietas_id}
                onChange={(id) => setScreenhouse({ ...screenhouse, varietas_id: id })}
                required
              />
              <p className="text-[11px] text-gray-600 mt-1">
                Batas sensor akan mengikuti standar varietas yang dipilih.
              </p>
            </div>

            <LocationPickerMap
              latitude={screenhouse.latitude}
              longitude={screenhouse.longitude}
              onChange={handleMapPick}
              className="h-52 w-full rounded-xl overflow-hidden border border-gray-200 z-0"
            />

            {screenhouse.latitude != null && (
              <p className="text-[11px] text-gray-600 font-medium">
                Koordinat: {screenhouse.latitude}, {screenhouse.longitude}
              </p>
            )}

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5">
              <div className="text-xs font-medium text-gray-600">Wilayah (otomatis dari peta)</div>
              {resolving && <p className="text-xs text-gray-600">Membaca wilayah...</p>}
              {!resolving && wilayah && (
                <p className="text-xs text-gray-700">
                  {[wilayah.village, wilayah.district, wilayah.regency, wilayah.province]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
              {!resolving && !wilayah && wilayahError && (
                <p className="text-xs text-amber-700">{wilayahError}</p>
              )}
              {!resolving && !wilayah && !wilayahError && (
                <p className="text-xs text-gray-600">Pilih titik di peta untuk mengisi wilayah</p>
              )}
            </div>

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
      </div>
    </div>
  );
}

export default PetaniAjukanScreenhousePage;
