import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Calendar, Sprout } from "lucide-react";
import VarietasSelect from "../VarietasSelect";
import { API_URL } from "../../config/api";

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function formatIdDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

export default function CycleStartModal({ open, onClose, onStarted, screenhouseId, token }) {
  const [varietasId, setVarietasId] = useState("");
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [varietasList, setVarietasList] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVarietasId("");
    setTanggalMulai(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }));
    fetch(`${API_URL}/varietas-bibit`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => setVarietasList(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [open, token]);

  const selectedVarietas = useMemo(
    () => varietasList.find((v) => String(v.id) === String(varietasId)),
    [varietasList, varietasId]
  );

  const estimasiSiap = useMemo(() => {
    if (!tanggalMulai || !selectedVarietas?.durasi_pembibitan_hari) return null;
    return addDays(tanggalMulai, selectedVarietas.durasi_pembibitan_hari);
  }, [tanggalMulai, selectedVarietas]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!varietasId) {
      toast.error("Pilih varietas bibit");
      return;
    }
    if (!tanggalMulai) {
      toast.error("Isi tanggal mulai semai");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/screenhouses/${screenhouseId}/cycles/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          varietas_id: Number(varietasId),
          tanggal_mulai: tanggalMulai,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal memulai siklus");
      toast.success("Siklus semai baru dimulai");
      onStarted?.(data);
      onClose?.();
    } catch (err) {
      toast.error(err.message || "Gagal memulai siklus");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-5 text-left">
        <div className="flex items-center gap-2 mb-1">
          <Sprout size={18} className="text-bl-primary" />
          <h2 className="text-base font-semibold text-gray-800">Mulai Siklus Baru</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          Pilih varietas dan tanggal mulai semai. Sistem akan menghitung estimasi siap tanam
          otomatis berdasarkan karakteristik varietas.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <VarietasSelect
            value={varietasId}
            onChange={setVarietasId}
            token={token}
            required
          />

          <label className="block">
            <span className="text-xs font-medium text-gray-600 mb-1 block">
              Tanggal mulai semai
            </span>
            <input
              type="date"
              value={tanggalMulai}
              onChange={(e) => setTanggalMulai(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100"
            />
          </label>

          {estimasiSiap && (
            <div className="flex items-start gap-2 rounded-xl bg-bl-surface-muted border border-bl-accent/20 px-3 py-2.5 text-sm text-gray-700">
              <Calendar size={16} className="shrink-0 text-bl-primary mt-0.5" />
              <div>
                <span className="font-medium">Estimasi siap tanam:</span>{" "}
                {formatIdDate(estimasiSiap)}
                <span className="block text-xs text-gray-600 mt-0.5">
                  Target standar {selectedVarietas?.durasi_pembibitan_hari} hari — dapat disesuaikan
                  oleh skor kondisi sensor selama siklus berjalan.
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-bl-primary hover:bg-bl-primary-hover text-white text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "Memproses..." : "Mulai siklus"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
