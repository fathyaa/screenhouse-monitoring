import { useEffect, useState } from "react";
import { Sprout } from "lucide-react";
import { API_URL } from "../config/api";

export default function VarietasSelect({
  value,
  onChange,
  disabled = false,
  required = false,
  className = "",
  token = null,
  compact = false,
}) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(`${API_URL}/varietas-bibit`, { headers })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setList(Array.isArray(data) ? data : []);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const selected = list.find((v) => String(v.id) === String(value));

  return (
    <div className={className}>
      <div
        className={`flex items-center gap-2 border border-gray-200 rounded-xl bg-gray-50 ${
          compact ? "h-10 px-3 rounded-lg" : "h-12 px-4"
        }`}
      >
        <Sprout size={compact ? 14 : 16} className="text-gray-600 shrink-0" />
        <select
          value={value ?? ""}
          required={required}
          disabled={disabled || loading}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
          className={`flex-1 bg-transparent outline-none text-gray-800 min-w-0 ${
            compact ? "text-sm" : "text-sm"
          }`}
        >
          <option value="">{loading ? "Memuat varietas..." : "Pilih varietas bibit"}</option>
          {list.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nama}
              {v.durasi_pembibitan_hari ? ` · ~${v.durasi_pembibitan_hari} hari` : ""}
            </option>
          ))}
        </select>
      </div>
      {selected?.deskripsi && (
        <p className={`text-gray-600 mt-1.5 leading-relaxed ${compact ? "text-[11px]" : "text-xs"}`}>
          {selected.deskripsi}
        </p>
      )}
    </div>
  );
}
