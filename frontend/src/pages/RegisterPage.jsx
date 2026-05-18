import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Phone, Lock } from "lucide-react";

function RegisterPage() {

    const navigate = useNavigate();

    const [form, setForm] = useState({
        name: "",
        phone_number: "",
        password: "",
    });

    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    };

    const handleRegister = async () => {

        try {

            setLoading(true);

            const response = await fetch(
                "http://localhost:8000/auth/register",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(form),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.message);
                return;
            }

            alert("Pendaftaran berhasil");

            navigate("/login");

        } catch (err) {

            console.log(err);

            alert("Register gagal");

        } finally {

            setLoading(false);

        }
    };

    return (
        <div className="fixed inset-0 flex">

            {/* KIRI */}
            <div className="flex-1 relative overflow-hidden">
                <img
                    src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?q=80&w=1974&auto=format&fit=crop"
                    alt="Sawah"
                    className="absolute inset-0 w-full h-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-r from-[#0f2d18]/85 via-[#0f2d18]/50 to-[#0a2312]/15" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a2312]/80 via-transparent to-transparent" />

                <div className="absolute bottom-0 left-0 p-10 max-w-4xl text-left">
                    <div className="text-5xl font-bold text-white leading-snug mb-3">
                        Monitoring Screenhouse<br />
                        Pembibitan Padi UPTD Mektan
                    </div>

                    <div className="text-2xl text-white/60 leading-relaxed">
                        Pantau kondisi NPK, kelembaban, dan suhu langsung dari genggaman tangan.
                    </div>
                </div>
            </div>

            {/* KANAN */}
            <div className="w-[410px] shrink-0 bg-white flex flex-col justify-center px-8 py-10 overflow-y-auto">

                <div className="text-lg font-semibold text-gray-800">
                    Daftar akun petani
                </div>

                <div className="text-xs text-gray-400 mt-1 mb-5">
                    Isi data diri untuk mendaftar ke sistem UPTD Mektan
                </div>

                <div className="space-y-3">

                    {/* NAMA */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">
                            Nama lengkap
                        </label>

                        <div className="flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50">
                            <User size={14} className="text-gray-400 shrink-0" />

                            <input
                                type="text"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                placeholder="Contoh: Budi Santoso"
                                className="flex-1 bg-transparent outline-none text-sm text-gray-800"
                            />
                        </div>
                    </div>

                    {/* HP */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">
                            Nomor HP
                        </label>

                        <div className="flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50">
                            <Phone size={14} className="text-gray-400 shrink-0" />

                            <input
                                type="tel"
                                name="phone_number"
                                value={form.phone_number}
                                onChange={handleChange}
                                placeholder="081234567890"
                                className="flex-1 bg-transparent outline-none text-sm text-gray-800"
                            />
                        </div>
                    </div>

                    {/* PASSWORD */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">
                            Password
                        </label>

                        <div className="flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50">
                            <Lock size={14} className="text-gray-400 shrink-0" />

                            <input
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                placeholder="Minimal 6 karakter"
                                className="flex-1 bg-transparent outline-none text-sm text-gray-800"
                            />
                        </div>
                    </div>

                </div>

                <button
                    onClick={handleRegister}
                    disabled={loading}
                    className="w-full h-10 rounded-lg bg-[#1e4d2b] hover:bg-[#2d6e3e] text-white text-sm font-medium transition mt-5 mb-3 disabled:opacity-50"
                >
                    {loading ? "Mendaftarkan..." : "Daftar sekarang"}
                </button>

                <p className="text-center text-xs text-gray-400 mb-4 leading-relaxed">
                    Pendaftaran akan diverifikasi oleh Operator UPTD Mektan sebelum akun aktif
                </p>

                <div className="text-center text-xs text-gray-400">
                    Sudah punya akun?{" "}
                    <button
                        onClick={() => navigate("/login")}
                        className="text-[#1e4d2b] font-medium hover:underline"
                    >
                        Masuk di sini
                    </button>
                </div>

            </div>
        </div>
    );
}

export default RegisterPage;