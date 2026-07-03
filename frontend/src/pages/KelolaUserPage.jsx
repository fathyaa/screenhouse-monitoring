import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Search, Pencil, KeyRound, Users } from "lucide-react";
import AdminPageShell from "../components/AdminPageShell";
import { TableRowsSkeleton } from "../components/LoadingUI";

import { API_URL } from "../config/api";

const ROLE_OPTIONS = [
  { value: "petani", label: "Petani" },
  { value: "operator", label: "Operator" },
  { value: "super_admin", label: "Super Admin" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Disetujui" },
  { value: "rejected", label: "Ditolak" },
];

function roleLabel(role) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
}

function statusBadge(status) {
  const styles = {
    pending: "bg-amber-50 text-amber-700 border-amber-100",
    approved: "bg-bl-surface-muted text-bl-primary border-bl-accent/20",
    rejected: "bg-red-50 text-red-700 border-red-100",
  };
  const labels = {
    pending: "Pending",
    approved: "Disetujui",
    rejected: "Ditolak",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] || "bg-gray-50 text-gray-600"}`}>
      {labels[status] || status}
    </span>
  );
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function KelolaUserPage() {
  const token = localStorage.getItem("token");
  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ role: "", status: "", search: "" });
  const [editUser, setEditUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.role) params.set("role", filters.role);
      if (filters.status) params.set("status", filters.status);
      if (filters.search.trim()) params.set("search", filters.search.trim());

      const res = await fetch(`${API_URL}/admin/users?${params}`, { headers: authHeaders });
      const data = res.ok ? await res.json() : [];
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat data user");
    } finally {
      setLoading(false);
    }
  }, [filters.role, filters.status, filters.search, authHeaders]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSaveUser = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${editUser.id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          name: editUser.name,
          role: editUser.role,
          status: editUser.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal memperbarui user");
        return;
      }
      toast.success("User berhasil diperbarui");
      setEditUser(null);
      loadUsers();
    } catch (err) {
      console.error(err);
      toast.error("Gagal memperbarui user");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser || newPassword.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${resetUser.id}/password`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal reset password");
        return;
      }
      toast.success("Password berhasil diperbarui");
      setResetUser(null);
      setNewPassword("");
    } catch (err) {
      console.error(err);
      toast.error("Gagal reset password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageShell
      title="Kelola User"
      subtitle="Ubah role, status, dan reset password pengguna"
    >
      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Cari nama atau nomor HP..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="flex-1 h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-1 focus:ring-green-300"
          />
        </div>
        <select
          value={filters.role}
          onChange={(e) => setFilters({ ...filters, role: e.target.value })}
          className="h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-1 focus:ring-green-300"
        >
          <option value="">Semua role</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-1 focus:ring-green-300"
        >
          <option value="">Semua status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users size={18} className="text-bl-primary" />
          <span className="text-sm font-semibold text-gray-800">Daftar User</span>
          <span className="text-xs text-gray-400 ml-auto">{users.length} user</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">No</th>
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">No HP</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-center">Screenhouse</th>
                <th className="px-4 py-3 font-medium">Terdaftar</th>
                <th className="px-4 py-3 font-medium text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowsSkeleton rows={6} />
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">Tidak ada user</td>
                </tr>
              ) : (
                users.map((u, i) => (
                  <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.phone_number}</td>
                    <td className="px-4 py-3 text-gray-600">{roleLabel(u.role)}</td>
                    <td className="px-4 py-3">{statusBadge(u.status)}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{u.screenhouse_count ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditUser({ ...u })}
                          className="p-1.5 rounded-lg hover:bg-bl-surface-muted text-bl-primary transition"
                          title="Edit user"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => { setResetUser(u); setNewPassword(""); }}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-700 transition"
                          title="Reset password"
                        >
                          <KeyRound size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 text-left">
            <h3 className="text-base font-semibold text-gray-800">Edit User</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Nama</label>
                <input
                  value={editUser.name}
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                  className="mt-1 w-full h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-1 focus:ring-green-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Role</label>
                <select
                  value={editUser.role}
                  onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                  className="mt-1 w-full h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-1 focus:ring-green-300"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Status</label>
                <select
                  value={editUser.status}
                  onChange={(e) => setEditUser({ ...editUser, status: e.target.value })}
                  className="mt-1 w-full h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-1 focus:ring-green-300"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditUser(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">Batal</button>
              <button
                onClick={handleSaveUser}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-bl-primary text-white text-sm disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 text-left">
            <h3 className="text-base font-semibold text-gray-800">Reset Password</h3>
            <p className="text-sm text-gray-500">
              Set password baru untuk <span className="font-medium text-gray-800">{resetUser.name}</span>
            </p>
            <input
              type="password"
              placeholder="Password baru (min. 6 karakter)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-1 focus:ring-green-300"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setResetUser(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">Batal</button>
              <button
                onClick={handleResetPassword}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-bl-primary text-white text-sm disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
