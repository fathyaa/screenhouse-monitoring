import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, Layers, Plus, Trash2, X } from "lucide-react";
import { API_URL } from "../config/api";
import { formatRackName } from "../utils/rackNames";
import { isNodeOnline } from "../utils/nodeOnline";
import { ListPanelSkeleton } from "./LoadingUI";

function formatLastReading(value) {
  if (!value) return "Belum pernah kirim data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Belum pernah kirim data";
  return `Data terakhir ${date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function TrayRow({ tray, index, busy, confirming, onAskDelete, onCancelDelete, onDelete, canDelete }) {
  const online = isNodeOnline({ ...tray, last_seen: tray.last_reading_at });

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800 truncate">
              {formatRackName(tray.node_name) || `Rak bibit ${index + 1}`}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                online
                  ? "border-bl-accent/20 bg-bl-surface-muted text-bl-primary"
                  : "border-gray-100 bg-gray-50 text-gray-600"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-bl-primary" : "bg-gray-400"}`} />
              {online ? "Mengirim data" : "Tidak mengirim data"}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            Kode alat: <span className="font-mono">{tray.node_code}</span>
          </div>
          <div className="text-[11px] text-gray-500">{formatLastReading(tray.last_reading_at)}</div>
        </div>

        {canDelete ? (
          <button
            type="button"
            onClick={() => onAskDelete(tray.id)}
            disabled={busy}
            className="shrink-0 p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition disabled:opacity-50"
            title="Hapus rak bibit"
            aria-label={`Hapus ${formatRackName(tray.node_name)}`}
          >
            <Trash2 size={15} />
          </button>
        ) : (
          <span className="shrink-0 text-[11px] text-gray-500 max-w-[130px] text-right leading-snug">
            Rak terakhir, tidak bisa dihapus
          </span>
        )}
      </div>

      {confirming && (
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50/60 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-600" />
            <p className="text-xs text-red-800 leading-relaxed">
              Rak ini beserta <span className="font-semibold">seluruh riwayat pengukuran dan peringatannya</span>{" "}
              akan dihapus permanen. Petani tidak akan melihat rak ini lagi di aplikasinya.
            </p>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onCancelDelete}
              disabled={busy}
              className="flex-1 py-2 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => onDelete(tray)}
              disabled={busy}
              className="flex-1 py-2 rounded-lg bg-red-600 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? "Menghapus..." : "Ya, hapus rak ini"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Kelola rak bibit (alat pengukur) satu screenhouse untuk super admin.
 * Satu rak = satu sensor node di monitoring service, jadi menambah/menghapus rak
 * langsung mengubah perangkat yang dipantau — bukan sekadar angka di layar.
 */
export default function TrayManagerModal({ screenhouse, onClose, onChanged }) {
  const token = localStorage.getItem("token");
  const [trays, setTrays] = useState([]);
  const [maxTray, setMaxTray] = useState(20);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [dirty, setDirty] = useState(false);

  const screenhouseId = screenhouse?.id;

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const loadTrays = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/screenhouses/${screenhouseId}/trays`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Gagal memuat rak bibit");
      setTrays(Array.isArray(data.trays) ? data.trays : []);
      if (data.max_tray_count) setMaxTray(data.max_tray_count);
    } catch (err) {
      toast.error(err.message || "Gagal memuat rak bibit");
    } finally {
      setLoading(false);
    }
    // authHeaders sengaja tidak jadi dependency — token dibaca sekali saat render.
  }, [screenhouseId, token]);

  useEffect(() => {
    if (screenhouseId) loadTrays();
  }, [screenhouseId, loadTrays]);

  const close = () => {
    if (dirty) onChanged?.();
    onClose();
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (name.length > 50) {
      toast.error("Nama rak bibit maksimal 50 karakter");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/admin/screenhouses/${screenhouseId}/trays`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(name ? { node_name: name } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Gagal menambah rak bibit");

      setTrays((prev) => [...prev, data.tray]);
      setNewName("");
      setAdding(false);
      setDirty(true);
      toast.success("Rak bibit ditambahkan");
    } catch (err) {
      toast.error(err.message || "Gagal menambah rak bibit");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (tray) => {
    setBusy(true);
    try {
      const res = await fetch(
        `${API_URL}/admin/screenhouses/${screenhouseId}/trays/${tray.id}`,
        { method: "DELETE", headers: authHeaders }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Gagal menghapus rak bibit");

      setTrays((prev) => prev.filter((t) => t.id !== tray.id));
      setConfirmId(null);
      setDirty(true);
      toast.success("Rak bibit dihapus");
    } catch (err) {
      toast.error(err.message || "Gagal menghapus rak bibit");
    } finally {
      setBusy(false);
    }
  };

  const atMax = trays.length >= maxTray;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tray-modal-title"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bl-surface-muted text-bl-primary">
            <Layers size={18} />
          </span>
          <div className="min-w-0">
            <div id="tray-modal-title" className="text-sm font-semibold text-gray-800 truncate">
              Rak bibit — {screenhouse?.name}
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              1 rak bibit = 1 alat pengukur. Menambah rak berarti mendaftarkan alat baru di screenhouse ini.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="ml-auto shrink-0 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {loading ? (
            <div className="p-4">
              <ListPanelSkeleton count={3} />
            </div>
          ) : trays.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-600">
              Belum ada rak bibit di screenhouse ini.
            </div>
          ) : (
            trays.map((tray, i) => (
              <TrayRow
                key={tray.id}
                tray={tray}
                index={i}
                busy={busy}
                confirming={confirmId === tray.id}
                canDelete={trays.length > 1}
                onAskDelete={setConfirmId}
                onCancelDelete={() => setConfirmId(null)}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100">
          {adding ? (
            <div className="space-y-2">
              <label htmlFor="tray-name" className="block text-xs font-medium text-gray-700">
                Nama rak bibit <span className="font-normal text-gray-500">(opsional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="tray-name"
                  type="text"
                  value={newName}
                  maxLength={50}
                  autoFocus
                  disabled={busy}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                    if (e.key === "Escape") setAdding(false);
                  }}
                  placeholder={`Rak bibit ${trays.length + 1}`}
                  className="flex-1 min-w-0 h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-1 focus:ring-green-300 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={busy}
                  className="px-4 h-9 rounded-lg bg-bl-primary hover:bg-bl-primary-hover text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Menyimpan..." : "Simpan"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setNewName("");
                  }}
                  disabled={busy}
                  className="px-3 h-9 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Batal
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                Kosongkan untuk memakai nama otomatis. Kode alat pengukur dibuat sistem.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAdding(true)}
                disabled={loading || busy || atMax}
                className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-bl-primary hover:bg-bl-primary-hover text-sm font-medium text-white disabled:opacity-50"
              >
                <Plus size={15} />
                Tambah rak bibit
              </button>
              <span className="text-xs text-gray-600">
                {atMax
                  ? `Maksimal ${maxTray} rak bibit per screenhouse`
                  : `${trays.length} rak bibit terpasang`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
