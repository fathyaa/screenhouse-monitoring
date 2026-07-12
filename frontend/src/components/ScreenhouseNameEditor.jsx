import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "../config/api";

export default function ScreenhouseNameEditor({
  screenhouseId,
  name,
  canEdit = false,
  onRenamed,
  className = "text-sm font-semibold text-gray-800",
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name ?? "");
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(name ?? "");
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(name ?? "");
    setEditing(false);
  };

  const save = async () => {
    const trimmed = draft.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      toast.error("Nama screenhouse harus 2–100 karakter");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/screenhouses/${screenhouseId}/profile`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Gagal menyimpan nama");
      }
      onRenamed?.(data);
      setEditing(false);
      toast.success("Nama screenhouse disimpan");
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan nama screenhouse");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={100}
          autoFocus
          disabled={saving}
          placeholder="Nama screenhouse"
          className="flex-1 min-w-0 h-8 px-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100"
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancelEdit();
          }}
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          aria-label="Simpan nama"
          className="p-1.5 rounded-lg bg-bl-primary text-white hover:bg-bl-primary-hover disabled:opacity-50"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          disabled={saving}
          aria-label="Batal"
          className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className={`${className} truncate`}>{name}</span>
      {canEdit && (
        <button
          type="button"
          onClick={startEdit}
          aria-label="Ubah nama screenhouse"
          className="shrink-0 p-1 rounded-md text-gray-500 hover:text-bl-primary hover:bg-gray-100 transition"
        >
          <Pencil size={13} />
        </button>
      )}
    </div>
  );
}
