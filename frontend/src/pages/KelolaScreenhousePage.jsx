import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Search, Leaf, ExternalLink, Trash2 } from "lucide-react";
import AdminPageShell from "../components/AdminPageShell";
import WilayahFilter, { buildWilayahQuery } from "../components/WilayahFilter";
import { TableRowsSkeleton, ListPanelSkeleton } from "../components/LoadingUI";
import Pagination from "../components/Pagination";
import { usePagination } from "../hooks/usePagination";

import { API_URL } from "../config/api";

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "active", label: "Aktif" },
  { value: "pending", label: "Pending" },
  { value: "inactive", label: "Nonaktif" },
];

function statusBadge(status) {
  const styles = {
    active: "bg-bl-surface-muted text-bl-primary border-bl-accent/20",
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

const STATUS_LABELS = { active: "Aktif", pending: "Pending", inactive: "Nonaktif" };

function StatusConfirmDialog({ change, busy, onCancel, onConfirm }) {
  if (!change) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-confirm-title"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm p-5 text-left">
        <div id="status-confirm-title" className="text-sm font-semibold text-gray-800">
          Ubah status screenhouse?
        </div>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Status "{change.row.name}" akan diubah dari{" "}
          <span className="font-semibold">{STATUS_LABELS[change.row.status] || change.row.status}</span> menjadi{" "}
          <span className="font-semibold">{STATUS_LABELS[change.newStatus] || change.newStatus}</span>.
          {change.newStatus === "inactive" && (
            <span className="block mt-1.5 text-amber-700">
              Monitoring untuk screenhouse ini akan berhenti dan petani tidak lagi menerima peringatan.
            </span>
          )}
        </p>
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-bl-primary hover:bg-bl-primary-hover text-white disabled:opacity-50"
          >
            {busy ? "Menyimpan..." : "Ya, ubah status"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmDialog({ target, busy, onCancel, onConfirm }) {
  if (!target) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm p-5 text-left">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Trash2 size={18} />
          </span>
          <div id="delete-confirm-title" className="text-sm font-semibold text-gray-800">
            Hapus screenhouse permanen?
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-3 leading-relaxed">
          Screenhouse <span className="font-semibold">"{target.name}"</span> beserta{" "}
          <span className="font-semibold">seluruh data sensor, riwayat siklus, dan peringatannya</span>{" "}
          akan dihapus permanen dari sistem. Tindakan ini <span className="font-semibold">tidak bisa dibatalkan</span>.
        </p>
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          >
            {busy ? "Menghapus..." : "Ya, hapus permanen"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KelolaScreenhousePage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wilayah, setWilayah] = useState({ regency_id: "", district_id: "", village_id: "" });
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [pendingChange, setPendingChange] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(buildWilayahQuery(wilayah));
      if (status) params.set("status", status);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`${API_URL}/admin/screenhouses?${params}`, { headers: authHeaders });
      const data = res.ok ? await res.json() : [];
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat screenhouse");
    } finally {
      setLoading(false);
    }
  }, [wilayah, status, search, authHeaders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const requestStatusChange = (row, newStatus) => {
    if (newStatus === row.status) return;
    setPendingChange({ row, newStatus });
  };

  const confirmStatusChange = async () => {
    if (!pendingChange) return;
    await handleStatusChange(pendingChange.row.id, pendingChange.newStatus);
    setPendingChange(null);
  };

  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`${API_URL}/admin/screenhouses/${id}/status`, {
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

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/admin/screenhouses/${deleteTarget.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menghapus screenhouse");
        return;
      }
      toast.success("Screenhouse dihapus");
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Gagal menghapus screenhouse");
    } finally {
      setDeleting(false);
    }
  };

  const {
    page,
    setPage,
    pageItems: pagedItems,
    pageCount,
    total,
    pageSize,
    startIndex,
  } = usePagination(items, 10, `${wilayah.regency_id}|${wilayah.district_id}|${wilayah.village_id}|${status}|${search}`);

  return (
    <AdminPageShell
      title="Kelola Screenhouse"
      subtitle="Lihat dan kelola status screenhouse seluruh wilayah"
    >
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <WilayahFilter value={wilayah} onChange={setWilayah} />
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={16} className="text-gray-600 shrink-0" />
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
          <Leaf size={18} className="text-bl-primary" />
          <span className="text-sm font-semibold text-gray-800">Daftar Screenhouse</span>
          <span className="text-xs text-gray-600 ml-auto">{items.length} screenhouse</span>
        </div>

        {loading ? (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-table-head">
                    <th className="px-4 py-3 font-medium">No</th>
                    <th className="px-4 py-3 font-medium">Nama</th>
                    <th className="px-4 py-3 font-medium">Pemilik</th>
                    <th className="px-4 py-3 font-medium">No HP</th>
                    <th className="px-4 py-3 font-medium">Wilayah</th>
                    <th className="px-4 py-3 font-medium text-center">Alat pengukur</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <TableRowsSkeleton rows={6} />
                </tbody>
              </table>
            </div>
            <div className="sm:hidden p-4">
              <ListPanelSkeleton count={5} />
            </div>
          </>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-600">Tidak ada screenhouse</div>
        ) : (
          <>
            {/* Tabel — layar sm ke atas */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-table-head">
                    <th className="px-4 py-3 font-medium">No</th>
                    <th className="px-4 py-3 font-medium">Nama</th>
                    <th className="px-4 py-3 font-medium">Pemilik</th>
                    <th className="px-4 py-3 font-medium">No HP</th>
                    <th className="px-4 py-3 font-medium">Wilayah</th>
                    <th className="px-4 py-3 font-medium text-center">Alat pengukur</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedItems.map((row, i) => (
                    <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-gray-600">{startIndex + i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{row.name}</td>
                      <td className="px-4 py-3 text-gray-600">{row.owner_name}</td>
                      <td className="px-4 py-3 text-gray-600">{row.owner_phone}</td>
                      <td className="px-4 py-3 text-gray-600 font-medium text-xs max-w-[200px]">{formatWilayah(row)}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{row.node_count ?? 0}</td>
                      <td className="px-4 py-3">{statusBadge(row.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <select
                            value={row.status}
                            disabled={updatingId === row.id}
                            onChange={(e) => requestStatusChange(row, e.target.value)}
                            className="h-8 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:ring-1 focus:ring-green-300 disabled:opacity-50"
                          >
                            <option value="active">Aktif</option>
                            <option value="pending">Pending</option>
                            <option value="inactive">Nonaktif</option>
                          </select>
                          {row.status === "active" && (
                            <button
                              onClick={() => navigate(`/operator/screenhouse/${row.id}`)}
                              className="p-1.5 rounded-lg hover:bg-bl-surface-muted text-bl-primary transition"
                              title="Lihat detail"
                            >
                              <ExternalLink size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget(row)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition"
                            title="Hapus screenhouse"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Kartu — layar sempit di bawah sm */}
            <div className="sm:hidden divide-y divide-gray-100">
              {pagedItems.map((row) => (
                <div key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{row.name}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{row.owner_name} · {row.owner_phone}</div>
                      <div className="text-[11px] text-gray-500 mt-1">{formatWilayah(row)}</div>
                      <div className="text-[11px] text-gray-500 mt-1">{row.node_count ?? 0} alat pengukur</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {row.status === "active" && (
                        <button
                          onClick={() => navigate(`/operator/screenhouse/${row.id}`)}
                          className="p-1.5 rounded-lg hover:bg-bl-surface-muted text-bl-primary transition"
                          title="Lihat detail"
                        >
                          <ExternalLink size={15} />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(row)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition"
                        title="Hapus screenhouse"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    {statusBadge(row.status)}
                    <select
                      value={row.status}
                      disabled={updatingId === row.id}
                      onChange={(e) => requestStatusChange(row, e.target.value)}
                      className="h-8 px-2 rounded-lg border border-gray-200 text-xs outline-none focus:ring-1 focus:ring-green-300 disabled:opacity-50 ml-auto"
                    >
                      <option value="active">Aktif</option>
                      <option value="pending">Pending</option>
                      <option value="inactive">Nonaktif</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <Pagination
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
              itemLabel="screenhouse"
              className="border-t border-gray-100"
            />
          </>
        )}
      </div>

      <StatusConfirmDialog
        change={pendingChange}
        busy={updatingId != null}
        onCancel={() => setPendingChange(null)}
        onConfirm={confirmStatusChange}
      />

      <DeleteConfirmDialog
        target={deleteTarget}
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </AdminPageShell>
  );
}
