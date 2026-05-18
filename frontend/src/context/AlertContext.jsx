import { createContext, useContext, useState, useEffect, useRef } from "react";
import socket from "../lib/socket";
import toast from "react-hot-toast";
import { TriangleAlert } from "lucide-react";

const AlertContext = createContext(null);
const TOAST_ID = "alert-notif";

export function AlertProvider({ children }) {
    const [alerts, setAlerts] = useState([]);
    const [activeCount, setActiveCount] = useState(0);
    const fetched = useRef(false);
    const token = localStorage.getItem("token");

    // Fetch awal — sekali saja
    useEffect(() => {
        if (fetched.current || !token) return;
        fetched.current = true;

        fetch("http://localhost:8000/alerts", {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => {
                if (!Array.isArray(data)) return;
                setAlerts(data);
                setActiveCount(data.filter((a) => a.status === "active").length);
            })
            .catch(console.error);
    }, [token]);

    // Socket listener 
    useEffect(() => {
        const handleAlert = async (newAlert) => {
            // Play sound kalau sudah diaktifkan user
            if (typeof window.__playAlertSound === "function") {
                window.__playAlertSound();
            }

            // Kalau alert dari socket sudah lengkap (ada actual_*), langsung pakai
            // Kalau belum lengkap (alert lama), fetch ulang semua dari DB
            const isEnriched = newAlert.actual_nitrogen !== undefined
                || newAlert.actual_moisture !== undefined
                || newAlert.actual_phosphorus !== undefined
                || newAlert.actual_potassium !== undefined

            if (isEnriched) {
                // Data sudah lengkap dari backend — langsung tambah ke state
                setAlerts((prev) => {
                    // Hindari duplikat
                    const exists = prev.find((a) => a.id === newAlert.id)
                    if (exists) return prev
                    return [newAlert, ...prev]
                })
                setActiveCount((prev) => prev + 1)
            } else {
                // Data tidak lengkap — fetch ulang semua dari DB
                const token = localStorage.getItem("token")
                if (token) {
                    fetch("http://localhost:8000/alerts", {
                        headers: { Authorization: `Bearer ${token}` },
                    })
                        .then((res) => res.json())
                        .then((data) => {
                            if (!Array.isArray(data)) return
                            setAlerts(data)
                            setActiveCount(data.filter((a) => a.status === "active").length)
                        })
                        .catch(console.error)
                }
            }

            // Toast selalu muncul
            toast.dismiss(TOAST_ID)
            toast.custom(
                (t) => (
                    <div className={`bg-white border border-red-100 shadow-xl rounded-2xl px-4 py-3 w-[320px] transition-all duration-300 ${t.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                                <TriangleAlert size={18} className="text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-gray-800">Alert Baru</div>
                                <div className="text-xs text-gray-500 mt-1 truncate">{newAlert.message}</div>
                                <div className="text-xs text-gray-400 mt-0.5">{newAlert.screenhouse_name}</div>
                            </div>
                            <button onClick={() => toast.dismiss(TOAST_ID)} className="text-gray-300 hover:text-gray-500 text-lg leading-none shrink-0">×</button>
                        </div>
                    </div>
                ),
                { id: TOAST_ID, duration: 5000, position: "bottom-right" }
            )
        }

        socket.on("alert-update", handleAlert);
        return () => socket.off("alert-update", handleAlert);
    }, []);

    const resolveAlert = async (alertId) => {
        try {
            await fetch(`http://localhost:8000/alerts/${alertId}/resolve`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            });
            setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, status: "resolved", resolved_at: new Date().toISOString() } : a));
            setActiveCount((prev) => Math.max(0, prev - 1));
        } catch {
            toast.error("Gagal resolve alert");
        }
    };

    return (
        <AlertContext.Provider value={{ alerts, activeCount, resolveAlert }}>
            {children}
        </AlertContext.Provider>
    );
}

export function useAlerts() {
    return useContext(AlertContext);
}

function parseAlertParam(message) {
    // "Nitrogen melebihi batas maksimum" → "nitrogen"
    // "Kelembapan di bawah batas minimum" → "moisture"
    const map = {
        "nitrogen": "nitrogen",
        "phosphorus": "phosphorus",
        "potassium": "potassium",
        "kelembapan": "moisture",
        "moisture": "moisture",
    }
    const lower = message.toLowerCase()
    for (const [key, field] of Object.entries(map)) {
        if (lower.includes(key)) return field
    }
    return null
}

function getAlertDetail(alert) {
    const param = parseAlertParam(alert.message)
    const isMax = alert.message.toLowerCase().includes("maksimum")
    const isMin = alert.message.toLowerCase().includes("minimum")

    if (!param) return null

    const actualKey = `actual_${param}`
    const minKey = `min_${param}`
    const maxKey = `max_${param}`

    const actual = alert[actualKey]
    const min = alert[minKey]
    const max = alert[maxKey]
    const threshold = isMax ? max : min

    return { param, actual, min, max, threshold, isMax, isMin }
}

export { getAlertDetail }