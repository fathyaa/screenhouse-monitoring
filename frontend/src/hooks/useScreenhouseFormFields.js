import { useState } from "react";
import { API_URL } from "../config/api";

const DEFAULT_SCREENHOUSE = {
  name: "",
  address_detail: "",
  latitude: null,
  longitude: null,
  tray_count: 1,
  varietas_id: "",
};

/** State + validasi form data screenhouse, dipakai bersama oleh alur registrasi dan pengajuan tambahan. */
export function useScreenhouseFormFields(initial) {
  const [screenhouse, setScreenhouse] = useState({ ...DEFAULT_SCREENHOUSE, ...initial });
  const [wilayah, setWilayah] = useState(initial?.wilayah ?? null);
  const [wilayahError, setWilayahError] = useState("");
  const [resolving, setResolving] = useState(false);

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

  /** Kembalikan pesan error pertama yang ditemukan, atau null jika valid. */
  const validate = () => {
    if (!screenhouse.name.trim()) return "Nama screenhouse wajib diisi";
    if (screenhouse.latitude == null || screenhouse.longitude == null)
      return "Pilih lokasi screenhouse di peta";
    if (!wilayah?.province_id)
      return wilayahError || "Wilayah belum terdeteksi. Coba pilih titik lain di peta.";

    const trayCount = Number(screenhouse.tray_count);
    if (!Number.isInteger(trayCount) || trayCount < 1 || trayCount > 20)
      return "Jumlah rak bibit harus antara 1 dan 20";

    if (!screenhouse.varietas_id) return "Pilih varietas bibit terlebih dahulu";

    return null;
  };

  /** Payload siap kirim ke backend (dipakai setelah validate() lolos). */
  const buildPayload = () => ({
    name: screenhouse.name.trim(),
    address_detail: screenhouse.address_detail.trim(),
    province_id: wilayah.province_id,
    regency_id: wilayah.regency_id,
    district_id: wilayah.district_id,
    village_id: wilayah.village_id,
    latitude: screenhouse.latitude,
    longitude: screenhouse.longitude,
    tray_count: Number(screenhouse.tray_count),
    varietas_id: Number(screenhouse.varietas_id),
  });

  return {
    screenhouse,
    setScreenhouse,
    wilayah,
    setWilayah,
    wilayahError,
    resolving,
    handleMapPick,
    validate,
    buildPayload,
  };
}
