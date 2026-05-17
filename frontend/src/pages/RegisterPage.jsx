import { Leaf, User, Phone, CreditCard, MapPin, Warehouse } from "lucide-react";

function RegisterPage() {
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
            <div className="w-[410px] shrink-0 bg-white flex flex-col justify-center px-8 py-10 overflow-y-auto">

                <div className="text-lg font-semibold text-gray-800">Daftar akun petani</div>
                <div className="text-xs text-gray-400 mt-1 mb-5">Isi data diri untuk mendaftar ke sistem UPTD Mektan</div>

                {/* Form */}
                <div className="grid grid-cols-2 gap-3">

                    {/* Nama — full width */}
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Nama lengkap</label>
                        <div className="flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50 focus-within:border-[#1e4d2b] transition">
                            <User size={14} className="text-gray-400 shrink-0" />
                            <input type="text" placeholder="Contoh: Budi Santoso" className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-300" />
                        </div>
                    </div>

                    {/* HP */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Nomor HP (WhatsApp)</label>
                        <div className="flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50 focus-within:border-[#1e4d2b] transition">
                            <Phone size={14} className="text-gray-400 shrink-0" />
                            <input type="tel" placeholder="081234567890" className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-300" />
                        </div>
                    </div>

                    {/* KTP */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Nomor KTP</label>
                        <div className="flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50 focus-within:border-[#1e4d2b] transition">
                            <CreditCard size={14} className="text-gray-400 shrink-0" />
                            <input type="text" placeholder="3201010101800001" className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-300" />
                        </div>
                    </div>

                    {/* Alamat — full width */}
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Alamat</label>
                        <div className="flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50 focus-within:border-[#1e4d2b] transition">
                            <MapPin size={14} className="text-gray-400 shrink-0" />
                            <input type="text" placeholder="Desa, Kecamatan, Kabupaten" className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-300" />
                        </div>
                    </div>

                    {/* Screenhouse — full width */}
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Nama screenhouse</label>
                        <div className="flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50 focus-within:border-[#1e4d2b] transition">
                            <Warehouse size={14} className="text-gray-400 shrink-0" />
                            <input type="text" placeholder="Contoh: Screenhouse Sawah Utara A1" className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-300" />
                        </div>
                    </div>

                </div>

                <button className="w-full h-10 rounded-lg bg-[#1e4d2b] hover:bg-[#2d6e3e] text-white text-sm font-medium transition mt-5 mb-3">
                    Daftar sekarang
                </button>

                <p className="text-center text-xs text-gray-400 mb-4 leading-relaxed">
                    Pendaftaran akan diverifikasi oleh Operator MCtan sebelum akun aktif
                </p>

                <div className="text-center text-xs text-gray-400">
                    Sudah punya akun?{" "}
                    <button className="text-[#1e4d2b] font-medium hover:underline">Masuk di sini</button>
                </div>
            </div>

        </div>
    );
}

export default RegisterPage;