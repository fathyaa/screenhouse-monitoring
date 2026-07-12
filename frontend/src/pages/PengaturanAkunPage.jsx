import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import Sidebar from "../layouts/Sidebar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import PetaniTopbar from "../layouts/PetaniTopbar";
import PetaniBottomNav from "../layouts/PetaniBottomNav";
import { API_URL } from "../config/api";

function persistUser(updates) {
  const stored = JSON.parse(localStorage.getItem("user") || "{}");
  const next = { ...stored, ...updates };
  localStorage.setItem("user", JSON.stringify(next));
  window.dispatchEvent(new Event("auth-changed"));
  return next;
}

function homePathForRole(role) {
  if (role === "petani") return "/petani";
  if (role === "super_admin") return "/admin/kelola-user";
  return "/operator";
}

export default function PengaturanAkunPage() {
  const navigate = useNavigate();
  const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
  const storedUser = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
  const role = localStorage.getItem("role");

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "Content-Type": "application/json",
    }),
    []
  );

  const loadProfile = useCallback(() => {
    setLoading(true);
    return fetch(`${API_URL}/auth/me`, { headers })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Gagal memuat profil");
        setProfile(data);
        setNameDraft(data.name ?? "");
        persistUser({ name: data.name, role: data.role, status: data.status });
      })
      .catch((err) => toast.error(err.message || "Gagal memuat profil"))
      .finally(() => setLoading(false));
  }, [headers]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const saveName = async (e) => {
    e.preventDefault();
    const name = nameDraft.trim();
    if (name.length < 2 || name.length > 100) {
      toast.error("Nama harus 2–100 karakter");
      return;
    }

    setSavingName(true);
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Gagal menyimpan nama");
      setProfile(data);
      persistUser({ name: data.name });
      toast.success("Nama berhasil disimpan");
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan nama");
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error("Isi kata sandi lama dan kata sandi baru");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Kata sandi baru minimal 6 karakter");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi kata sandi tidak cocok");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch(`${API_URL}/auth/me/password`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Gagal mengubah kata sandi");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Kata sandi berhasil diubah");
    } catch (err) {
      toast.error(err.message || "Gagal mengubah kata sandi");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="app-shell fixed inset-0 flex bg-bl-surface overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        screenhouses={[]}
        role={role}
        user={storedUser}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 text-left">
        <PetaniTopbar
          onToggleSidebar={toggleSidebar}
          title="Pengaturan akun"
          subtitle="Ubah nama dan kata sandi"
          onBack={() => {
            if (window.history.state?.idx > 0) navigate(-1);
            else navigate(homePathForRole(role));
          }}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 max-w-lg">
          {loading ? (
            <div className="space-y-3">
              <div className="h-28 rounded-2xl bg-white border border-gray-200 animate-pulse" />
              <div className="h-44 rounded-2xl bg-white border border-gray-200 animate-pulse" />
            </div>
          ) : (
            <>
              <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-bl-surface-muted flex items-center justify-center">
                    <UserRound size={18} className="text-bl-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-800">Profil</h2>
                    <p className="text-xs text-gray-600">Nama tampil di aplikasi</p>
                  </div>
                </div>

                <form onSubmit={saveName} className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Nama</label>
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      maxLength={100}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Nomor HP</label>
                    <input
                      type="text"
                      value={profile?.phone_number ?? ""}
                      readOnly
                      className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingName || nameDraft.trim() === (profile?.name ?? "")}
                    className="w-full py-2.5 rounded-xl bg-bl-primary text-white text-sm font-medium disabled:opacity-50"
                  >
                    {savingName ? "Menyimpan..." : "Simpan nama"}
                  </button>
                </form>
              </section>

              <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                    <KeyRound size={18} className="text-amber-700" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-800">Kata sandi</h2>
                    <p className="text-xs text-gray-600">Ganti kata sandi login</p>
                  </div>
                </div>

                <form onSubmit={savePassword} className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Kata sandi lama</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Kata sandi baru</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Ulangi kata sandi baru</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {savingPassword ? "Menyimpan..." : "Ubah kata sandi"}
                  </button>
                </form>
              </section>
            </>
          )}
        </div>
        {role === "petani" && <PetaniBottomNav />}
      </div>
    </div>
  );
}
