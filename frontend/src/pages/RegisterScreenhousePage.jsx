import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Leaf, MapPin, ArrowLeft } from "lucide-react";
import LocationPickerMap from "../components/LocationPickerMap";

const API = "http://localhost:8000";
const PENDING_KEY = "pendingRegister";

function RegisterScreenhousePage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);

  const [screenhouse, setScreenhouse] = useState({
    name: "",
    address_detail: "",
    latitude: null,
    longitude: null,
  });

  const [wilayah, setWilayah] = useState(null);
  const [wilayahError, setWilayahError] = useState("");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) {
        navigate("/register", { replace: true });
        return;
      }
      setAccount(JSON.parse(raw));
    } catch {
      navigate("/register", { replace: true });
    }
  }, [navigate]);

  const resolveWilayah = async (lat, lng) => {
    setResolving(true);
    setWilayahError("");
    try {
      const res = await fetch(
        `${API}/wilayah/resolve?latitude=${lat}&longitude=${lng}`
      );
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
      alert("Nama screenhouse wajib diisi");
      return;
    }

    if (screenhouse.latitude == null || screenhouse.longitude == null) {
      alert("Pilih lokasi screenhouse di peta");
      return;
    }

    if (!wilayah?.province_id) {
      alert(wilayahError || "Wilayah belum terdeteksi. Coba pilih titik lain di peta.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...account,
          screenhouse: {
            name: screenhouse.name.trim(),
            address_detail: screenhouse.address_detail.trim(),
            province_id: wilayah.province_id,
            regency_id: wilayah.regency_id,
            district_id: wilayah.district_id,
            village_id: wilayah.village_id,
            latitude: screenhouse.latitude,
            longitude: screenhouse.longitude,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Pendaftaran gagal");
        return;
      }

      sessionStorage.removeItem(PENDING_KEY);
      alert("Pendaftaran berhasil. Menunggu persetujuan operator.");
      navigate("/login");
    } catch (err) {
      console.error(err);
      alert("Pendaftaran gagal");
    } finally {
      setLoading(false);
    }
  };

  if (!account) return null;

  return (
    <div className="fixed inset-0 flex">

      {/* KIRI */}
      <div className="flex-1 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?q=80&w=1974&auto=format&fit=crop"
          alt="Sawah"
          className="absolute inset-0 w-full h-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#0f2d18]/85 via-[#0f2d18]/50 to-[#0a2312]/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a2312]/80 via-transparent to-transparent" />

        <div className="absolute bottom-0 left-0 p-10 max-w-4xl text-left">
          <div className="text-5xl font-bold text-white leading-snug mb-3">
            Monitoring Screenhouse<br />
            Pembibitan Padi UPTD Mektan
          </div>

          <div className="text-2xl text-white/60 leading-relaxed">
            Pantau kondisi NPK, kelembaban, dan suhu langsung dari genggaman tangan.
          </div>
        </div>
      </div>

      {/* KANAN */}
      <div className="w-[410px] shrink-0 bg-white flex flex-col justify-center px-8 py-10 overflow-y-auto text-left">

        <button
          type="button"
          onClick={() => navigate("/register")}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-4"
        >
          <ArrowLeft size={14} />
          Kembali ke data akun
        </button>

        <div className="text-lg font-semibold text-gray-800">
          Daftar screenhouse
        </div>

        <div className="text-xs text-gray-400 mt-1 mb-5">
          Lengkapi lokasi screenhouse untuk {account.name}
        </div>

        <div className="space-y-3">

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Nama screenhouse
            </label>
            <div className="flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50">
              <Leaf size={14} className="text-gray-400 shrink-0" />
              <input
                type="text"
                value={screenhouse.name}
                onChange={(e) =>
                  setScreenhouse({ ...screenhouse, name: e.target.value })
                }
                placeholder="Contoh: Screenhouse Sukabumi 01"
                className="flex-1 bg-transparent outline-none text-sm text-gray-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Detail alamat (opsional)
            </label>
            <div className="flex items-start gap-2 min-h-10 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
              <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
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

          <LocationPickerMap
            latitude={screenhouse.latitude}
            longitude={screenhouse.longitude}
            onChange={handleMapPick}
            className="h-48 w-full rounded-lg overflow-hidden border border-gray-200 z-0"
          />

          {screenhouse.latitude != null && (
            <p className="text-[11px] text-gray-500">
              Koordinat: {screenhouse.latitude}, {screenhouse.longitude}
            </p>
          )}

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5">
            <div className="text-xs font-medium text-gray-600">Wilayah (otomatis dari peta)</div>
            {resolving && (
              <p className="text-xs text-gray-400">Membaca wilayah...</p>
            )}
            {!resolving && wilayah && (
              <>
                <p className="text-xs text-gray-700">
                  {[wilayah.village, wilayah.district, wilayah.regency, wilayah.province]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {wilayah.display_name && (
                  <p className="text-[11px] text-gray-400">{wilayah.display_name}</p>
                )}
              </>
            )}
            {!resolving && !wilayah && wilayahError && (
              <p className="text-xs text-amber-700">{wilayahError}</p>
            )}
            {!resolving && !wilayah && !wilayahError && (
              <p className="text-xs text-gray-400">Pilih titik di peta untuk mengisi wilayah</p>
            )}
          </div>

        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || resolving}
          className="w-full h-10 rounded-lg bg-[#1e4d2b] hover:bg-[#2d6e3e] text-white text-sm font-medium transition mt-5 mb-3 disabled:opacity-50"
        >
          {loading ? "Mengirim pendaftaran..." : "Kirim pendaftaran"}
        </button>

        <p className="text-center text-xs text-gray-400 mb-4 leading-relaxed">
          Data akun dan screenhouse akan diverifikasi operator sebelum akun aktif
        </p>

        <div className="text-center text-xs text-gray-400">
          Sudah punya akun?{" "}
          <button
            onClick={() => navigate("/login")}
            className="text-[#1e4d2b] font-medium hover:underline"
          >
            Masuk di sini
          </button>
        </div>

      </div>
    </div>
  );
}

export default RegisterScreenhousePage;
