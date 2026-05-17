import { useState } from "react";
import { SlidersHorizontal, RotateCcw, Save, Menu } from "lucide-react";
import Sidebar from "../layouts/Sidebar";

const DEFAULT_THRESHOLDS = [
    { label: "Nitrogen (N)", unit: "mg/kg", min: 20, max: 45, progress: 78 },
    { label: "Phosphorus (P)", unit: "mg/kg", min: 10, max: 30, progress: 84 },
    { label: "Potassium (K)", unit: "mg/kg", min: 15, max: 50, progress: 86 },
    { label: "Kelembaban tanah", unit: "%", min: 50, max: 80, progress: 68 },
    { label: "pH Tanah", unit: "pH", min: 5, max: 7, progress: 55 },
    { label: "Suhu", unit: "°C", min: 24, max: 32, progress: 72 },
];

function ThresholdPage() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
    const user = { name: "Admin MCtan", role: "admin" };

    const updateValue = (index, field, value) => {
        const updated = [...thresholds];
        updated[index][field] = Number(value);
        setThresholds(updated);
    };

    const handleReset = () => setThresholds(DEFAULT_THRESHOLDS);

    const getBarStyle = (min, max, unit) => {
        // Tentukan range maksimal yang wajar per parameter
        const ranges = {
            "mg/kg": { absMin: 0, absMax: 100 },
            "%": { absMin: 0, absMax: 100 },
            "pH": { absMin: 0, absMax: 14 },
            "°C": { absMin: 0, absMax: 50 },
        };

        const { absMin, absMax } = ranges[unit] ?? { absMin: 0, absMax: 100 };
        const totalRange = absMax - absMin;
        const chosenRange = max - min;

        // Seberapa lebar rentang dibanding maksimal yang wajar (0–1)
        const ratio = Math.min(chosenRange / totalRange, 1);

        // Bar tumbuh dari tengah ke kiri-kanan
        const widthPct = Math.round(ratio * 100);

        // Warna: semakin jauh → semakin hijau pekat
        // ratio 0   → #d1fae5 (hijau pucat)
        // ratio 0.5 → #34d399
        // ratio 1   → #065f46 (hijau pekat)
        const r = Math.round(6 + (1 - ratio) * (209 - 6));
        const g = Math.round(95 + (1 - ratio) * (250 - 95));
        const b = Math.round(70 + (1 - ratio) * (229 - 70));
        const color = `rgb(${r},${g},${b})`;

        return { widthPct, color, ratio };
    };

    return (
        <div className="fixed inset-0 flex bg-slate-100 overflow-hidden">
            <Sidebar isOpen={sidebarOpen} screenhouses={[]} role={user.role} user={user} />

            <div className="flex-1 flex flex-col overflow-hidden min-w-0">

                {/* TOPBAR */}
                <header className="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-5 z-10">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
                            <Menu size={20} className="text-gray-500" />
                        </button>
                        <div>
                            <div className="text-sm font-semibold text-gray-800">Pengaturan threshold sensor</div>
                            <div className="text-xs text-gray-400">Atur batas min/maks — alert dikirim jika nilai melewati batas</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-green-50 text-green-800 text-xs font-medium px-3 py-1.5 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Online
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-5 space-y-2">

                    {/* THRESHOLD LIST */}
                    {thresholds.map((item, index) => (
                        <div key={item.label} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4">

                            {/* LABEL + BAR */}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-gray-800">{item.label}</div>
                                <div className="text-xs text-gray-400 mt-0.5">Satuan: {item.unit}</div>

                                {/* Bar tumbuh dari tengah */}
                                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden relative">
                                    {(() => {
                                        const { widthPct, color } = getBarStyle(item.min, item.max, item.unit);
                                        return (
                                            <div
                                                className="absolute top-0 h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${widthPct}%`,
                                                    left: `${(100 - widthPct) / 2}%`,
                                                    background: color,
                                                }}
                                            />
                                        );
                                    })()}
                                </div>

                                {/* Label rentang */}
                                <div className="flex justify-between mt-1">
                                    <span className="text-[10px] text-gray-300">{item.min} {item.unit}</span>
                                    <span className="text-[10px] text-gray-400 font-medium">
                                        rentang: {item.max - item.min} {item.unit}
                                    </span>
                                    <span className="text-[10px] text-gray-300">{item.max} {item.unit}</span>
                                </div>
                            </div>

                            {/* INPUTS */}
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="flex flex-col gap-1">
                                    <div className="text-[10px] uppercase tracking-wide text-gray-400">Min</div>
                                    <input
                                        type="number"
                                        value={item.min}
                                        onChange={(e) => updateValue(index, "min", e.target.value)}
                                        className="w-16 h-8 rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm font-semibold text-gray-800 outline-none focus:ring-1 focus:ring-green-300 text-center"
                                    />
                                </div>
                                <div className="text-gray-300 text-sm mt-4">—</div>
                                <div className="flex flex-col gap-1">
                                    <div className="text-[10px] uppercase tracking-wide text-gray-400">Maks</div>
                                    <input
                                        type="number"
                                        value={item.max}
                                        onChange={(e) => updateValue(index, "max", e.target.value)}
                                        className="w-16 h-8 rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm font-semibold text-gray-800 outline-none focus:ring-1 focus:ring-green-300 text-center"
                                    />
                                </div>
                                <div className="text-xs text-gray-400 mt-4">{item.unit}</div>
                            </div>

                        </div>
                    ))}

                    {/* ACTIONS */}
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium transition"
                        >
                            <RotateCcw size={15} />Reset default
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1e4d2b] hover:bg-[#2d6e3e] text-white text-sm font-medium transition">
                            <Save size={15} />Simpan perubahan
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default ThresholdPage;