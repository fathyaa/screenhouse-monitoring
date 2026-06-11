import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Phone, Lock } from "lucide-react";
import AuthHero from "../components/AuthHero";
import BrandBar from "../components/BrandBar";

function RegisterPage() {

    const navigate = useNavigate();

    const [form, setForm] = useState({
        name: "",
        phone_number: "",
        password: "",
    });

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    };

    const handleContinue = () => {
        if (!form.name.trim() || !form.phone_number.trim() || !form.password) {
            alert("Lengkapi semua data akun terlebih dahulu");
            return;
        }

        if (form.password.length < 6) {
            alert("Password minimal 6 karakter");
            return;
        }

        sessionStorage.setItem("pendingRegister", JSON.stringify({
            name: form.name.trim(),
            phone_number: form.phone_number.trim(),
            password: form.password,
        }));

        navigate("/register/screenhouse");
    };

    return (
        <div className="app-shell fixed inset-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">

            <AuthHero
                title={
                    <>
                        Daftar ke BibitLive
                        <br />
                        Pembibitan Padi
                    </>
                }
            />

            <BrandBar title="Daftar Petani" subtitle="BibitLive · Pembibitan padi" />

            <div className="w-full lg:w-[410px] shrink-0 bg-white flex flex-col justify-center px-6 sm:px-8 py-8 lg:py-10 overflow-y-auto flex-1 lg:flex-none">

                <div className="text-lg font-semibold text-gray-800">
                    Daftar akun petani
                </div>

                <div className="text-xs text-gray-400 mt-1 mb-5">
                    Isi data diri untuk mendaftar ke BibitLive
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
                    onClick={handleContinue}
                    className="btn-bl w-full h-10 rounded-lg text-sm mt-5 mb-3"
                >
                    Daftar sekarang → isi screenhouse
                </button>

                <p className="text-center text-xs text-gray-400 mb-4 leading-relaxed">
                    Setelah data akun, lanjut isi lokasi screenhouse. Keduanya dikirim ke server di langkah terakhir.
                </p>

                <div className="text-center text-xs text-gray-400">
                    Sudah punya akun?{" "}
                    <button
                        onClick={() => navigate("/login")}
                        className="link-bl"
                    >
                        Masuk di sini
                    </button>
                </div>

            </div>
        </div>
    );
}

export default RegisterPage;