import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { RotateCcw, Save, Search, SlidersHorizontal } from "lucide-react";
import AdminPageShell from "../components/AdminPageShell";
import WilayahFilter, { buildWilayahQuery } from "../components/WilayahFilter";
import { THRESHOLD_METRICS, DEFAULT_THRESHOLD } from "../constants/thresholdMetrics";

const API = "http://localhost:8000";

function rowToForm(row) {
  const form = {};
  THRESHOLD_METRICS.forEach((m) => {
    form[m.minCol] = row?.[m.minCol] ?? DEFAULT_THRESHOLD[m.minCol];
    form[m.maxCol] = row?.[m.maxCol] ?? DEFAULT_THRESHOLD[m.maxCol];
  });
  return form;
}

export default function ThresholdPage() {
  const token = localStorage.getItem("token");
  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [wilayah, setWilayah] = useState({ regency_id: "", district_id: "", village_id: "" });
  const [search, setSearch] = useState("");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(rowToForm(null));
  const [saving, setSaving] = useState(false);

  const selected = list.find((r) => r.screenhouse_id === selectedId);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(buildWilayahQuery(wilayah));
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`${API}/thresholds?${params}`, { headers: authHeaders });
      const data = res.ok ? await res.json() : [];
      const rows = Array.isArray(data) ? data : [];
      setList(rows);

      if (rows.length === 0) {
        setSelectedId(null);
        setForm(rowToForm(null));
      } else if (!rows.some((r) => r.screenhouse_id === selectedId)) {
        setSelectedId(rows[0].screenhouse_id);
        setForm(rowToForm(rows[0]));
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat daftar screenhouse");
    } finally {
      setLoading(false);
    }
  }, [wilayah, search, token]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    const row = list.find((r) => r.screenhouse_id === selectedId);
    if (row) setForm(rowToForm(row));
  }, [selectedId, list]);

  const updateField = (col, value) => {
    setForm((prev) => ({ ...prev, [col]: value === "" ? "" : Number(value) }));
  };

  const handleSelect = (row) => {
    setSelectedId(row.screenhouse_id);
    setForm(rowToForm(row));
  };

  const handleReset = () => setForm(rowToForm(null));

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/thresholds/${selectedId}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menyimpan threshold");
        return;
      }
      toast.success("Threshold berhasil disimpan");
      loadList();
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan threshold");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageShell
      title="Kelola Threshold"
      subtitle="Atur batas min/maks per screenhouse — alert dikirim jika nilai melewati batas"
    >
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <WilayahFilter value={wilayah} onChange={setWilayah} />
        <div className="flex items-center gap-2">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Cari nama screenhouse atau pemilik..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-1 focus:ring-green-300"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 min-h-0">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-220px)]">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
            <SlidersHorizontal size={16} className="text-green-700" />
            <span className="text-sm font-semibold text-gray-800">Pilih Screenhouse</span>
            <span className="text-xs text-gray-400 ml-auto">{list.length}</span>
          </div>
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-6 text-center text-sm text-gray-400">Memuat...</div>
            ) : list.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">Tidak ada screenhouse aktif</div>
            ) : (
              list.map((row) => {
                const active = row.screenhouse_id === selectedId;
                const hasThreshold = Boolean(row.threshold_id);
                return (
                  <button
                    key={row.screenhouse_id}
                    onClick={() => handleSelect(row)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 transition ${active ? "bg-green-50" : "hover:bg-gray-50"}`}
                  >
                    <div className="text-sm font-medium text-gray-800">{row.screenhouse_name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{row.owner_name}</div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      {[row.village, row.district, row.regency].filter(Boolean).join(", ")}
                    </div>
                    {!hasThreshold && (
                      <span className="inline-block mt-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        Belum diset
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-3 min-w-0">
          {selected ? (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3 text-left">
                <div className="text-sm font-semibold text-gray-800">{selected.screenhouse_name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {selected.owner_name} · {[selected.village, selected.district, selected.regency].filter(Boolean).join(", ")}
                </div>
              </div>

              {THRESHOLD_METRICS.map((m) => (
                <div key={m.key} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-semibold text-gray-800">{m.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Satuan: {m.unit}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col gap-1">
                      <div className="text-[10px] uppercase tracking-wide text-gray-400">Min</div>
                      <input
                        type="number"
                        step="any"
                        value={form[m.minCol]}
                        onChange={(e) => updateField(m.minCol, e.target.value)}
                        className="w-20 h-8 rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm font-semibold text-gray-800 outline-none focus:ring-1 focus:ring-green-300 text-center"
                      />
                    </div>
                    <div className="text-gray-300 text-sm mt-4">—</div>
                    <div className="flex flex-col gap-1">
                      <div className="text-[10px] uppercase tracking-wide text-gray-400">Maks</div>
                      <input
                        type="number"
                        step="any"
                        value={form[m.maxCol]}
                        onChange={(e) => updateField(m.maxCol, e.target.value)}
                        className="w-20 h-8 rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm font-semibold text-gray-800 outline-none focus:ring-1 focus:ring-green-300 text-center"
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-4">{m.unit}</div>
                  </div>
                </div>
              ))}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium transition"
                >
                  <RotateCcw size={15} />Reset default
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1e4d2b] hover:bg-[#2d6e3e] text-white text-sm font-medium transition disabled:opacity-50"
                >
                  <Save size={15} />{saving ? "Menyimpan..." : "Simpan perubahan"}
                </button>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-400">
              Pilih screenhouse dari daftar di sebelah kiri
            </div>
          )}
        </div>
      </div>
    </AdminPageShell>
  );
}
