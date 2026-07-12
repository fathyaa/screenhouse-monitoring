import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "../config/api";
import { formatRackName } from "../utils/rackNames";

export default function RackNameEditor({
  node,
  canEdit = false,
  onRenamed,
  className = "text-sm font-semibold text-gray-800",
}) {
  const displayName = formatRackName(node?.node_name);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(formatRackName(node?.node_name));
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(displayName);
    setEditing(false);
  };

  const save = async () => {
    const name = draft.trim();
    if (name.length < 1 || name.length > 50) {
      toast.error("Nama rak bibit harus 1–50 karakter");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/sensor-data/sensor-nodes/${node.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ node_name: name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Gagal menyimpan nama");
      }
      onRenamed?.(data);
      setEditing(false);
      toast.success("Nama rak bibit disimpan");
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan nama rak bibit");
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
          maxLength={50}
          autoFocus
          disabled={saving}
          placeholder="Nama rak bibit"
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
      <span className={`${className} truncate`}>{displayName}</span>
      {canEdit && (
        <button
          type="button"
          onClick={startEdit}
          aria-label="Ubah nama rak bibit"
          className="shrink-0 p-1 rounded-md text-gray-500 hover:text-bl-primary hover:bg-gray-100 transition"
        >
          <Pencil size={13} />
        </button>
      )}
    </div>
  );
}
