import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { RotateCcw, Save, Search, SlidersHorizontal } from "lucide-react";
import AdminPageShell from "../components/AdminPageShell";
import WilayahFilter, { buildWilayahQuery } from "../components/WilayahFilter";
import { THRESHOLD_METRICS, DEFAULT_THRESHOLD } from "../constants/thresholdMetrics";
import { formatVarietasSourceLabel } from "../constants/varietasThresholdHints";
import { ListPanelSkeleton } from "../components/LoadingUI";

import { API_URL } from "../config/api";

/** Penjelasan singkat per parameter — form ini sebelumnya cuma kolom angka kosong. */
const METRIC_HINTS = {
  nitrogen: "Nutrisi utama untuk pertumbuhan daun.",
  phosphorus: "Mendukung perkembangan akar.",
  potassium: "Mendukung kekuatan batang & ketahanan bibit.",
  soil_moisture: "Kadar air dalam tanah — menentukan kebutuhan penyiraman.",
  soil_temperature: "Suhu di sekitar akar — memengaruhi penyerapan hara.",
  soil_ph: "Tingkat keasaman tanah — memengaruhi penyerapan nutrisi.",
  conductivity: "Kepekatan larutan pupuk/garam di dalam tanah.",
  air_temperature: "Suhu udara di dalam screenhouse.",
  air_humidity: "Kelembapan udara — memengaruhi penguapan & risiko jamur.",
  light_intensity: "Intensitas cahaya yang diterima bibit.",
};

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
  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  const [wilayah, setWilayah] = useState({ regency_id: "", district_id: "", village_id: "" });
  const [search, setSearch] = useState("");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [form, setForm] = useState(rowToForm(null));
  const [saving, setSaving] = useState(false);

  const hasInvalidRange = THRESHOLD_METRICS.some((m) => {
    const minVal = form[m.minCol];
    const maxVal = form[m.maxCol];
    return minVal !== "" && maxVal !== "" && Number(minVal) >= Number(maxVal);
  });

  const selected = list.find((r) => r.screenhouse_id === selectedId);
  const allChecked = list.length > 0 && list.every((r) => checkedIds.has(r.screenhouse_id));
  const someChecked = list.some((r) => checkedIds.has(r.screenhouse_id));
  const saveTargets =
    checkedIds.size > 0 ? [...checkedIds] : selectedId ? [selectedId] : [];

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(buildWilayahQuery(wilayah));
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`${API_URL}/thresholds?${params}`, { headers: authHeaders });
      const data = res.ok ? await res.json() : [];
      const rows = Array.isArray(data) ? data : [];
      setList(rows);

      if (rows.length === 0) {
        setSelectedId(null);
        setCheckedIds(new Set());
        setForm(rowToForm(null));
      } else {
        const validIds = new Set(rows.map((r) => r.screenhouse_id));
        setCheckedIds((prev) => new Set([...prev].filter((id) => validIds.has(id))));
        setSelectedId((currentId) => {
          if (rows.some((r) => r.screenhouse_id === currentId)) {
            return currentId;
          }
          setForm(rowToForm(rows[0]));
          return rows[0].screenhouse_id;
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat daftar screenhouse");
    } finally {
      setLoading(false);
    }
  }, [wilayah, search, authHeaders]);

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

  const toggleChecked = (screenhouseId) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(screenhouseId)) next.delete(screenhouseId);
      else next.add(screenhouseId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allChecked) {
      setCheckedIds(new Set());
      return;
    }
    setCheckedIds(new Set(list.map((r) => r.screenhouse_id)));
  };

  const handleReset = () => setForm(rowToForm(null));

  const handleSave = async () => {
    if (!saveTargets.length) {
      toast.error("Centang screenhouse yang akan disamakan batas amannya");
      return;
    }
    if (hasInvalidRange) {
      toast.error("Perbaiki dulu rentang yang nilai minimumnya tidak lebih kecil dari maksimum");
      return;
    }
    setSaving(true);
    try {
      const isBulk = saveTargets.length > 1;
      const res = await fetch(
        isBulk ? `${API_URL}/thresholds/bulk` : `${API_URL}/thresholds/${saveTargets[0]}`,
        {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify(
            isBulk ? { screenhouse_ids: saveTargets, ...form } : form
          ),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menyimpan batas aman");
        return;
      }
      toast.success(
        isBulk
          ? `Batas aman disamakan ke ${data.updated_count ?? saveTargets.length} screenhouse`
          : "Batas aman berhasil disimpan"
      );
      loadList();
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan batas aman");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageShell
      title="Kelola batas aman"
      subtitle="Atur batas minimum dan maksimum. Centang beberapa screenhouse untuk menyamakan sekaligus (misalnya satu kecamatan)."
    >
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <WilayahFilter value={wilayah} onChange={setWilayah} />
        <div className="flex items-center gap-2">
          <Search size={16} className="text-gray-600 shrink-0" />
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
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100dvh-220px)]">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
            <SlidersHorizontal size={16} className="text-bl-primary" />
            <span className="text-sm font-semibold text-gray-800">Screenhouse</span>
            <span className="text-xs text-gray-600 ml-auto">{checkedIds.size}/{list.length}</span>
          </div>
          {list.length > 0 && (
            <label className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-100 bg-gray-50/80 cursor-pointer text-left">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked && !allChecked;
                }}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-bl-primary focus:ring-green-300"
              />
              <span className="text-xs font-medium text-gray-700">
                Pilih semua ({list.length})
              </span>
            </label>
          )}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <ListPanelSkeleton count={8} />
            ) : list.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-600">Tidak ada screenhouse aktif</div>
            ) : (
              list.map((row) => {
                const active = row.screenhouse_id === selectedId;
                const checked = checkedIds.has(row.screenhouse_id);
                const hasThreshold = Boolean(row.threshold_id);
                return (
                  <div
                    key={row.screenhouse_id}
                    className={`flex items-start gap-2.5 px-3 py-3 border-b border-gray-50 transition ${active ? "bg-bl-surface-muted" : checked ? "bg-amber-50/40" : "hover:bg-gray-50"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleChecked(row.screenhouse_id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 w-4 h-4 shrink-0 rounded border-gray-300 text-bl-primary focus:ring-green-300"
                      aria-label={`Pilih ${row.screenhouse_name}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleSelect(row)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="text-sm font-medium text-gray-800">{row.screenhouse_name}</div>
                      <div className="text-xs text-gray-600 font-medium mt-0.5">{row.owner_name}</div>
                      <div className="text-[11px] text-gray-600 font-medium mt-1">
                        {[row.village, row.district, row.regency].filter(Boolean).join(", ")}
                      </div>
                      {!hasThreshold && (
                        <span className="inline-block mt-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                          Belum diset
                        </span>
                      )}
                    </button>
                  </div>
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
                <div className="text-xs text-gray-600 font-medium mt-0.5">
                  {selected.owner_name} · {[selected.village, selected.district, selected.regency].filter(Boolean).join(", ")}
                </div>
                {formatVarietasSourceLabel(
                  selected.varietas_nama,
                  selected.varietas_sumber,
                  selected.manual_override
                ) && (
                  <p className="text-xs text-bl-primary mt-2 font-medium">
                    {formatVarietasSourceLabel(
                      selected.varietas_nama,
                      selected.varietas_sumber,
                      selected.manual_override
                    )}
                  </p>
                )}
              </div>

              {THRESHOLD_METRICS.map((m) => {
                const minVal = form[m.minCol];
                const maxVal = form[m.maxCol];
                const invalidRange =
                  minVal !== "" && maxVal !== "" && Number(minVal) >= Number(maxVal);
                return (
                <div key={m.key} className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-semibold text-gray-800">{m.label}</div>
                      {METRIC_HINTS[m.key] && (
                        <div className="text-xs text-gray-600 mt-0.5">{METRIC_HINTS[m.key]}</div>
                      )}
                      <div className="text-[11px] text-gray-500 mt-1">
                        Rentang standar: {DEFAULT_THRESHOLD[m.minCol]}–{DEFAULT_THRESHOLD[m.maxCol]} {m.unit}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col gap-1">
                        <div className="text-[10px] uppercase tracking-wide text-gray-600">Min</div>
                        <input
                          type="number"
                          step="any"
                          value={minVal}
                          onChange={(e) => updateField(m.minCol, e.target.value)}
                          className={`w-20 h-8 rounded-lg border bg-gray-50 px-2 text-sm font-semibold text-gray-800 outline-none focus:ring-1 focus:ring-green-300 text-center ${
                            invalidRange ? "border-red-300" : "border-gray-200"
                          }`}
                        />
                      </div>
                      <div className="text-gray-600 text-xs mt-4 font-medium">s/d</div>
                      <div className="flex flex-col gap-1">
                        <div className="text-[10px] uppercase tracking-wide text-gray-600">Maks</div>
                        <input
                          type="number"
                          step="any"
                          value={maxVal}
                          onChange={(e) => updateField(m.maxCol, e.target.value)}
                          className={`w-20 h-8 rounded-lg border bg-gray-50 px-2 text-sm font-semibold text-gray-800 outline-none focus:ring-1 focus:ring-green-300 text-center ${
                            invalidRange ? "border-red-300" : "border-gray-200"
                          }`}
                        />
                      </div>
                      <div className="text-xs text-gray-600 mt-4">{m.unit}</div>
                    </div>
                  </div>
                  {invalidRange && (
                    <p className="text-[11px] text-red-600 mt-2">
                      Nilai minimum harus lebih kecil dari maksimum.
                    </p>
                  )}
                </div>
                );
              })}

              {checkedIds.size > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 text-xs text-amber-900">
                  Nilai di bawah akan disamakan ke <span className="font-semibold">{checkedIds.size} screenhouse</span> yang dicentang.
                  {checkedIds.size > 1 && " Filter kecamatan lalu centang semua untuk update massal."}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                <div className="text-xs text-gray-600">
                  {saveTargets.length > 0
                    ? `Akan disimpan ke ${saveTargets.length} screenhouse`
                    : "Centang screenhouse di daftar kiri"}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium transition"
                  >
                    <RotateCcw size={15} />Reset default
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || saveTargets.length === 0 || hasInvalidRange}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bl-primary hover:bg-bl-primary-hover text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    <Save size={15} />
                    {saving
                      ? "Menyimpan..."
                      : saveTargets.length > 1
                      ? `Simpan ke ${saveTargets.length} screenhouse`
                      : "Simpan perubahan"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-600">
              Pilih screenhouse dari daftar di sebelah kiri
            </div>
          )}
        </div>
      </div>
    </AdminPageShell>
  );
}
