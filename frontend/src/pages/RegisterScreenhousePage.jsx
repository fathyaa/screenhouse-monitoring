import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { LoadingSpinner } from "../components/LoadingUI";
import ScreenhouseFormFields from "../components/ScreenhouseFormFields";
import { useScreenhouseFormFields } from "../hooks/useScreenhouseFormFields";

import { API_URL } from "../config/api";
import { validateIndonesianPhone } from "../utils/phoneNumber";
const PENDING_KEY = "pendingRegister";

function RegisterScreenhousePage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const {
    screenhouse,
    setScreenhouse,
    wilayah,
    setWilayah,
    wilayahError,
    resolving,
    handleMapPick,
    validate,
    buildPayload,
  } = useScreenhouseFormFields();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const phoneResult = validateIndonesianPhone(account.phone_number);
    if (!phoneResult.ok) {
      toast.error(phoneResult.message);
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
          screenhouse: buildPayload(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Pendaftaran gagal");
        return;
      }

      sessionStorage.removeItem(PENDING_KEY);
      toast.success("Pendaftaran berhasil. Menunggu persetujuan operator.");
      navigate("/login");
    } catch (err) {
      console.error(err);
      toast.error("Pendaftaran gagal");
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
            <ScreenhouseFormFields
              screenhouse={screenhouse}
              setScreenhouse={setScreenhouse}
              wilayah={wilayah}
              wilayahError={wilayahError}
              resolving={resolving}
              handleMapPick={handleMapPick}
            />
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
