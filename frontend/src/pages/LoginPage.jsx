import { useState } from "react";
import { Phone, Lock, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config/api";
import { unlockAlertSound } from "../utils/alertSound";
import AuthHero from "../components/AuthHero";
import BrandBar from "../components/BrandBar";
import { LoadingSpinner } from "../components/LoadingUI";

function LoginPage() {
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const [phone_number, setPhone] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async () => {
        const trimmedPhone = phone_number.trim();

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone_number: trimmedPhone,
                    password,
                }),
            });

            let data = {};
            try {
                data = await response.json();
            } catch {
                console.error("[login] Respons bukan JSON", { status: response.status });
            }

            if (!response.ok) {
                console.error("[login] Gagal", {
                    status: response.status,
                    message: data.message,
                    phone_number: trimmedPhone,
                });
                alert(data.message || `Login gagal (HTTP ${response.status})`);
                return;
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("role", data.user.role);
            localStorage.setItem("user", JSON.stringify(data.user));
            window.dispatchEvent(new Event("auth-changed"));

            if (data.user.role === "petani") {
                unlockAlertSound();
            }

            const routes = {
                petani: "/petani",
                operator: "/operator",
                super_admin: "/admin/kelola-user",
            };

            const path = routes[data.user.role];
            if (path) {
                navigate(path);
            } else {
                console.warn("[login] Role tidak dikenali:", data.user.role);
                alert(`Role "${data.user.role}" belum memiliki halaman dashboard`);
            }
        } catch (err) {
            console.error("[login] Network error", err);
            alert("Tidak dapat terhubung ke server. Pastikan app-service (VITE_API_URL) berjalan.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-shell fixed inset-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
            <AuthHero />

            <BrandBar subtitle="Pembibitan padi · Jawa Barat" />

            <div className="w-full lg:w-[360px] shrink-0 bg-white flex flex-col justify-center px-6 sm:px-8 py-8 lg:py-10 overflow-y-auto flex-1 lg:flex-none">
                <div className="text-lg font-semibold text-gray-800">Masuk ke BibitLive</div>
                <div className="text-xs text-gray-400 mt-1 mb-6">Gunakan nomor HP dan kata sandi yang terdaftar</div>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Nomor HP (WhatsApp)</label>
                        <div className="input-bl flex items-center gap-2 h-10 px-3">
                            <Phone size={14} className="text-gray-400 shrink-0" />
                            <input
                                value={phone_number}
                                onChange={(e) => setPhone(e.target.value)}
                                type="tel" placeholder="081234567890"
                                className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-300" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Kata sandi</label>
                        <div className="input-bl flex items-center gap-2 h-10 px-3">
                            <Lock size={14} className="text-gray-400 shrink-0" />
                            <input
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                type={showPassword ? "text" : "password"}
                                placeholder="Masukkan kata sandi"
                                className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-300"
                            />
                            <button onClick={() => setShowPassword(!showPassword)} className="text-gray-300 hover:text-gray-500 transition">
                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="btn-bl w-full h-10 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                        {loading && <LoadingSpinner size={16} className="text-white" />}
                        {loading ? "Memproses masuk..." : "Masuk"}
                    </button>
                </div>

                <div className="text-center mt-6 text-xs text-gray-400">
                    Belum punya akun?{" "}
                    <button
                        onClick={() => navigate("/register")}
                        className="link-bl">Daftar di sini</button>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
