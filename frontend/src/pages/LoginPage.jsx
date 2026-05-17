import { useState } from "react";
import { Leaf, Phone, Lock, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

function LoginPage() {
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const [phone_number, setPhone] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async () => {
        try {
            const response = await fetch(
                "http://localhost:3004/auth/login",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        phone_number,
                        password,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) { alert(data.message); return; }

            localStorage.setItem("token", data.token);
            localStorage.setItem("role", data.user.role);
            localStorage.setItem("user", JSON.stringify(data.user));

            if (data.user.role === "petani") {
                navigate("/petani");
            }

            if (data.user.role === "operator") {
                navigate("/operator");
            }

            if (data.user.role === "admin") {
                navigate("/admin/approval");
            }

        } catch (err) {
            console.log(err);
            alert("Login gagal");
        }
    };

    return (
        <div className="fixed inset-0 flex">

            {/* KIRI — foto + gradasi */}
            <div className="flex-1 relative overflow-hidden">
                <img
                    src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?q=80&w=1974&auto=format&fit=crop"
                    alt="Sawah"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Gradasi dari kiri (nyambung ke form) + gelap di bawah untuk teks */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#0f2d18]/85 via-[#0f2d18]/50 to-[#0a2312]/15" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a2312]/80 via-transparent to-transparent" />

                {/* Teks di kanan bawah */}
                <div className="absolute bottom-0 left-0 p-10 max-w-4xl text-left">
                    <div className="text-5xl font-bold text-white leading-snug mb-3">
                        Monitoring Screenhouse<br />Pembibitan Padi UPTD Mektan
                    </div>
                    <div className="text-2xl text-white/60 leading-relaxed">
                        Pantau kondisi NPK, kelembaban, dan suhu langsung dari genggaman tangan.
                    </div>
                </div>
            </div>

            {/* KANAN — form */}
            <div className="w-[360px] shrink-0 bg-white flex flex-col justify-center px-8 py-10 overflow-y-auto">

                <div className="text-lg font-semibold text-gray-800">Masuk ke akun</div>
                <div className="text-xs text-gray-400 mt-1 mb-6">Gunakan nomor HP dan kata sandi yang terdaftar</div>

                {/* Form */}
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Nomor HP (WhatsApp)</label>
                        <div className="flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50 focus-within:border-[#1e4d2b] transition">
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
                        <div className="flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50 focus-within:border-[#1e4d2b] transition">
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
                        className="w-full h-10 rounded-lg bg-[#1e4d2b] hover:bg-[#2d6e3e] text-white text-sm font-medium transition">
                        Masuk
                    </button>
                </div>

                {/* Demo */}
                <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-400 whitespace-nowrap">Demo — masuk cepat sebagai</span>
                    <div className="flex-1 h-px bg-gray-100" />
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {["Petani", "Operator", "Admin"].map((role) => (
                        <button key={role} className="h-9 rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 transition">
                            {role}
                        </button>
                    ))}
                </div>

                <div className="text-center mt-6 text-xs text-gray-400">
                    Belum punya akun?{" "}
                    <button
                        onClick={() => navigate("/register")}
                        className="text-[#1e4d2b] font-medium hover:underline">Daftar di sini</button>
                </div>
            </div>

        </div>
    );
}

export default LoginPage;