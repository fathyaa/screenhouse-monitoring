import { useRef, useState, useEffect } from "react";
import { Menu } from "lucide-react";

export default function PetaniTopbar({ onToggleSidebar, title, subtitle, activeAlerts = 0 }) {
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
            // Buka izin autoplay browser tanpa memutar suara notifikasi
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
        <header className="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-5 z-10">
            <div className="flex items-center gap-3">
                <button
                    onClick={onToggleSidebar}
                    className="relative p-1.5 rounded-lg hover:bg-gray-100 transition"
                >
                    <Menu size={20} className="text-gray-500" />
                    {activeAlerts > 0 && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    )}
                </button>
                <div>
                    <div className="text-sm font-semibold text-gray-800">{title}</div>
                    <div className="text-xs text-gray-400">{subtitle}</div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Tombol suara */}
                <button
                    onClick={toggleSound}
                    title={soundEnabled ? "Matikan suara notifikasi" : "Aktifkan suara notifikasi"}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${soundEnabled
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600"
                        }`}
                >
                    {soundEnabled ? "🔔 Suara aktif" : "🔇 Suara mati"}
                </button>

                {/* Badge online */}
                <div className="flex items-center gap-2 bg-green-50 text-green-800 text-xs font-medium px-3 py-1.5 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Online
                </div>
            </div>
        </header>
    );
}