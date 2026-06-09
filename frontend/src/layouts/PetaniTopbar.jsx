import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Menu } from "lucide-react";
import { useAlerts } from "../context/AlertContext";

export default function PetaniTopbar({ onToggleSidebar, title, subtitle }) {
    const navigate = useNavigate();
    const { activeCount } = useAlerts();
    const [soundEnabled, setSoundEnabled] = useState(
        sessionStorage.getItem("sound_enabled") === "true"
    );
    const audioRef = useRef(null);

    useEffect(() => {
        if (soundEnabled) {
            const audio = getAudio();
            window.__playAlertSound = () => {
                audio.currentTime = 0;
                audio.play().catch(() => { });
            };
        }
    }, []);

    function getAudio() {
        if (!audioRef.current) {
            audioRef.current = new Audio("/sounds/notification.mp3");
            audioRef.current.volume = 0.7;
        }
        return audioRef.current;
    }

    function unlockAudioPlayback(audio) {
        const prevVolume = audio.volume;
        audio.volume = 0;
        return audio
            .play()
            .then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = prevVolume;
            })
            .catch(() => {
                audio.volume = prevVolume;
            });
    }

    function toggleSound() {
        const audio = getAudio();
        if (!soundEnabled) {
            unlockAudioPlayback(audio).finally(() => {
                setSoundEnabled(true);
                sessionStorage.setItem("sound_enabled", "true");
                window.__playAlertSound = () => {
                    audio.currentTime = 0;
                    audio.play().catch(() => { });
                };
            });
        } else {
            setSoundEnabled(false);
            sessionStorage.setItem("sound_enabled", "false");
            window.__playAlertSound = null;
        }
    }

    return (
        <header className="app-topbar h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between z-10">
            <div className="flex items-center gap-3 min-w-0">
                <button
                    onClick={onToggleSidebar}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition shrink-0"
                    aria-label="Toggle sidebar"
                >
                    <Menu size={20} className="text-gray-500" />
                </button>
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">{title}</div>
                    <div className="text-xs text-gray-400 truncate hidden sm:block">{subtitle}</div>
                </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                    onClick={toggleSound}
                    title={soundEnabled ? "Matikan suara peringatan" : "Aktifkan suara peringatan"}
                    className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs font-medium border transition ${soundEnabled
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600"
                        }`}
                >
                    <span className="sm:hidden">{soundEnabled ? "🔔" : "🔇"}</span>
                    <span className="hidden sm:inline">{soundEnabled ? "🔔 Suara aktif" : "🔇 Suara mati"}</span>
                </button>

                <button
                    onClick={() => navigate("/petani/peringatan")}
                    title="Peringatan screenhouse"
                    className="relative p-2 rounded-xl hover:bg-gray-100 transition"
                >
                    <Bell size={18} className="text-gray-600" />
                    {activeCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {activeCount > 9 ? "9+" : activeCount}
                        </span>
                    )}
                </button>

                <div className="hidden sm:flex items-center gap-2 bg-green-50 text-green-800 text-xs font-medium px-3 py-1.5 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Online
                </div>
            </div>
        </header>
    );
}
