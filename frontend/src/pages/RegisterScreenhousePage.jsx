import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Leaf, MapPin, ArrowLeft, Layers } from "lucide-react";
import { LoadingSpinner } from "../components/LoadingUI";
import LocationPickerMap from "../components/LocationPickerMap";
import VarietasSelect from "../components/VarietasSelect";

import { API_URL } from "../config/api";
import { validateIndonesianPhone } from "../utils/phoneNumber";
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
    tray_count: 1,
    varietas_id: "",
  });

  const [wilayah, setWilayah] = useState(null);
  const [wilayahError, setWilayahError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) {
        navigate("/register", { replace: true });
        return;
      }
      const data = JSON.parse(raw);
      setAccount({
        name: data.name,
        phone_number: data.phone_number,
        password: data.password,
      });

      if (data.screenhouseDraft) {
        const draft = data.screenhouseDraft;
        setScreenhouse({
          name: draft.name || "",
          address_detail: draft.address_detail || "",
          latitude: draft.latitude ?? null,
          longitude: draft.longitude ?? null,
          tray_count: draft.tray_count ?? 1,
          varietas_id: draft.varietas_id ?? "",
        });
        if (draft.wilayah) setWilayah(draft.wilayah);
      }
    } catch {
      navigate("/register", { replace: true });
    } finally {
      setHydrated(true);
    }
  }, [navigate]);

  useEffect(() => {
    if (!hydrated || !account) return;

    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      data.screenhouseDraft = { ...screenhouse, wilayah };
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(data));
    } catch {
      // abaikan
    }
  }, [hydrated, account, screenhouse, wilayah]);

  const resolveWilayah = async (lat, lng) => {
    setResolving(true);
    setWilayahError("");
    try {
      const res = await fetch(
        `${API_URL}/wilayah/resolve?latitude=${lat}&longitude=${lng}`
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

    const trayCount = Number(screenhouse.tray_count);
    if (!Number.isInteger(trayCount) || trayCount < 1 || trayCount > 20) {
      alert("Jumlah tray harus antara 1 dan 20");
      return;
    }

    if (!screenhouse.varietas_id) {
      alert("Pilih varietas bibit terlebih dahulu");
      return;
    }

    const phoneResult = validateIndonesianPhone(account.phone_number);
    if (!phoneResult.ok) {
      alert(phoneResult.message);
      navigate("/register", { replace: true });
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...account,
          phone_number: phoneResult.normalized,
          screenhouse: {
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10 overflow-y-auto">
      <div className="w-full max-w-xl">

        <button
          type="button"
          onClick={() => navigate("/register")}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-600 mb-8"
        >
          <ArrowLeft size={16} />
          Kembali ke data akun
        </button>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-10 sm:px-10 sm:py-12">

          <div className="text-center mb-10">
            <div className="text-2xl font-semibold text-gray-800">
              Daftar screenhouse
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Lengkapi lokasi screenhouse untuk {account.name}
            </p>
          </div>

          <div className="space-y-6">

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Nama screenhouse
              </label>
              <div className="flex items-center gap-3 h-12 px-4 border border-gray-200 rounded-xl bg-gray-50">
                <Leaf size={16} className="text-gray-600 shrink-0" />
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
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Detail alamat (opsional)
              </label>
              <div className="flex items-start gap-3 min-h-12 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50">
                <MapPin size={16} className="text-gray-600 shrink-0 mt-0.5" />
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
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Jumlah tray terpasang
              </label>
              <div className="flex items-center gap-3 h-12 px-4 border border-gray-200 rounded-xl bg-gray-50">
                <Layers size={16} className="text-gray-600 shrink-0" />
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
              <p className="text-xs text-gray-600 mt-2">
                Satu tray = satu sensor node. Operator dapat menyesuaikan saat verifikasi.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Varietas bibit
              </label>
              <VarietasSelect
                value={screenhouse.varietas_id}
                onChange={(id) => setScreenhouse({ ...screenhouse, varietas_id: id })}
                required
              />
              <p className="text-xs text-gray-600 mt-2">
                Threshold sensor akan disesuaikan otomatis dengan standar varietas yang dipilih.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Lokasi di peta
              </label>
              <LocationPickerMap
                latitude={screenhouse.latitude}
                longitude={screenhouse.longitude}
                onChange={handleMapPick}
                className="h-56 w-full rounded-xl overflow-hidden border border-gray-200 z-0"
              />
              {screenhouse.latitude != null && (
                <p className="text-xs text-gray-600 font-medium mt-2">
                  Koordinat: {screenhouse.latitude}, {screenhouse.longitude}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
              <div className="text-sm font-medium text-gray-600">Wilayah (otomatis dari peta)</div>
              {resolving && (
                <p className="text-sm text-gray-600">Membaca wilayah...</p>
              )}
              {!resolving && wilayah && (
                <>
                  <p className="text-sm text-gray-700">
                    {[wilayah.village, wilayah.district, wilayah.regency, wilayah.province]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {wilayah.display_name && (
                    <p className="text-xs text-gray-600">{wilayah.display_name}</p>
                  )}
                </>
              )}
              {!resolving && !wilayah && wilayahError && (
                <p className="text-sm text-amber-700">{wilayahError}</p>
              )}
              {!resolving && !wilayah && !wilayahError && (
                <p className="text-sm text-gray-600">Pilih titik di peta untuk mengisi wilayah</p>
              )}
            </div>

          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || resolving}
            className="w-full h-12 rounded-xl btn-bl text-sm mt-10 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <LoadingSpinner size={16} className="text-white" />}
            {loading ? "Mengirim pendaftaran..." : "Kirim pendaftaran"}
          </button>

          <p className="text-center text-xs text-gray-600 mt-5 leading-relaxed">
            Data akun dan screenhouse akan diverifikasi operator sebelum akun aktif
          </p>

          <div className="text-center text-xs text-gray-600 mt-6">
            Sudah punya akun?{" "}
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="link-bl"
            >
              Masuk di sini
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default RegisterScreenhousePage;
