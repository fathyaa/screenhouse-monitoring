import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Search, Leaf, ExternalLink } from "lucide-react";
import AdminPageShell from "../components/AdminPageShell";
import WilayahFilter, { buildWilayahQuery } from "../components/WilayahFilter";

const API = "http://localhost:8000";

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "active", label: "Aktif" },
  { value: "pending", label: "Pending" },
  { value: "inactive", label: "Nonaktif" },
];

function statusBadge(status) {
  const styles = {
    active: "bg-green-50 text-green-700 border-green-100",
    pending: "bg-amber-50 text-amber-700 border-amber-100",
    inactive: "bg-gray-50 text-gray-600 border-gray-100",
  };
  const labels = { active: "Aktif", pending: "Pending", inactive: "Nonaktif" };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] || ""}`}>
      {labels[status] || status}
    </span>
  );
}

function formatWilayah(row) {
  return [row.village, row.district, row.regency].filter(Boolean).join(", ");
}

export default function KelolaScreenhousePage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wilayah, setWilayah] = useState({ regency_id: "", district_id: "", village_id: "" });
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(buildWilayahQuery(wilayah));
      if (status) params.set("status", status);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`${API}/admin/screenhouses?${params}`, { headers: authHeaders });
      const data = res.ok ? await res.json() : [];
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat screenhouse");
    } finally {
      setLoading(false);
    }
  }, [wilayah, status, search, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`${API}/admin/screenhouses/${id}/status`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal mengubah status");
        return;
      }
      toast.success("Status screenhouse diperbarui");
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengubah status");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AdminPageShell
      title="Kelola Screenhouse"
      subtitle="Lihat dan kelola status screenhouse seluruh wilayah"
    >
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <WilayahFilter value={wilayah} onChange={setWilayah} />
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Cari nama screenhouse, pemilik, atau HP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-1 focus:ring-green-300"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-1 focus:ring-green-300"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value || "all"} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Leaf size={18} className="text-green-700" />
          <span className="text-sm font-semibold text-gray-800">Daftar Screenhouse</span>
          <span className="text-xs text-gray-400 ml-auto">{items.length} screenhouse</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">No</th>
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Pemilik</th>
                <th className="px-4 py-3 font-medium">No HP</th>
                <th className="px-4 py-3 font-medium">Wilayah</th>
                <th className="px-4 py-3 font-medium text-center">Node</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Tidak ada screenhouse</td></tr>
              ) : (
                items.map((row, i) => (
                  <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{row.name}</td>
                    <td className="px-4 py-3 text-gray-600">{row.owner_name}</td>
                    <td className="px-4 py-3 text-gray-600">{row.owner_phone}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px]">{formatWilayah(row)}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{row.node_count ?? 0}</td>
                    <td className="px-4 py-3">{statusBadge(row.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <select
                          value={row.status}
                          disabled={updatingId === row.id}
                          onChange={(e) => handleStatusChange(row.id, e.target.value)}
                          className="h-8 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:ring-1 focus:ring-green-300 disabled:opacity-50"
                        >
                          <option value="active">Aktif</option>
                          <option value="pending">Pending</option>
                          <option value="inactive">Nonaktif</option>
                        </select>
                        {row.status === "active" && (
                          <button
                            onClick={() => navigate(`/operator/screenhouse/${row.id}`)}
                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-700 transition"
                            title="Lihat detail"
                          >
                            <ExternalLink size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageShell>
  );
}
