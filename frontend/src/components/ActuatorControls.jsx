import { useState } from "react";
import toast from "react-hot-toast";
import { Droplets, Lightbulb, Wind } from "lucide-react";
import { API_URL } from "../config/api";

const ACTUATORS = [
  { key: "fan", field: "fan_status", label: "Kipas", icon: Wind },
  { key: "irrigation", field: "irrigation_status", label: "Irigasi", icon: Droplets },
  { key: "lamp", field: "lamp_status", label: "Lampu", icon: Lightbulb },
];

function isOn(value) {
  return value === true || value === 1 || value === "on";
}

function ActuatorSwitch({ label, icon: Icon, value, onChange, disabled, loading, compact, readOnly }) {
  const on = isOn(value);
  const hasValue = value !== null && value !== undefined;

  if (readOnly) {
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border p-2.5 ${
          on ? "bg-bl-surface-muted border-bl-accent/30" : "bg-gray-50 border-gray-100"
        }`}
      >
        <Icon size={16} className={on ? "text-bl-primary" : "text-gray-400"} />
        <div className="text-left min-w-0">
          <div className="text-xs font-medium text-gray-700">{label}</div>
          <div className={`text-[10px] ${on ? "text-bl-primary" : "text-gray-400"}`}>
            {!hasValue ? "Belum diketahui" : on ? "Nyala" : "Mati"}
          </div>
        </div>
      </div>
    );
  }

  const trackClass = compact ? "h-5 w-9" : "h-6 w-11";
  const thumbClass = compact ? "h-4 w-4" : "h-5 w-5";

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-xl border transition ${
        compact ? "p-2" : "p-2.5"
      } ${on ? "bg-bl-surface-muted border-bl-accent/30" : "bg-gray-50 border-gray-100"} ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={compact ? 14 : 16} className={on ? "text-bl-primary" : "text-gray-400"} />
        <div className="text-left min-w-0">
          <div className={`font-medium text-gray-700 ${compact ? "text-[10px]" : "text-xs"}`}>
            {label}
          </div>
          {!compact && (
            <div className={`text-[10px] ${on ? "text-bl-primary" : "text-gray-400"}`}>
              {!hasValue ? "Belum diketahui" : on ? "Nyala" : "Mati"}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${label} ${on ? "nyala" : "mati"}`}
        disabled={disabled || loading || !hasValue}
        onClick={() => onChange(!on)}
        className={`${trackClass} shrink-0 rounded-full p-0.5 flex items-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-300 ${
          on ? "justify-end bg-green-600" : "justify-start bg-gray-300"
        } ${disabled || loading ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={`${thumbClass} rounded-full bg-white shadow shrink-0 block`} />
      </button>
    </div>
  );
}

export default function ActuatorControls({
  screenhouseId,
  fan_status,
  irrigation_status,
  lamp_status,
  disabled = false,
  compact = false,
  readOnly = false,
  onUpdated,
  className = "",
}) {
  const [loadingKey, setLoadingKey] = useState(null);

  const values = {
    fan_status,
    irrigation_status,
    lamp_status,
  };

  const handleToggle = async (actuatorKey, nextOn) => {
    if (readOnly) return;
    if (!screenhouseId) {
      toast.error("Screenhouse belum tersedia");
      return;
    }

    const token = localStorage.getItem("token");
    setLoadingKey(actuatorKey);

    try {
      const res = await fetch(
        `${API_URL}/sensor-data/screenhouse/${screenhouseId}/actuators`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            [actuatorKey]: nextOn,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Gagal mengubah aktuator");
      }

      if (data.unchanged) {
        toast("Aktuator sudah dalam kondisi tersebut", { icon: "ℹ️" });
      } else if (data.source === "auto") {
        toast.success(`Aktuator diatur otomatis (${actuatorKey})`);
      } else {
        toast.success(
          `${ACTUATORS.find((a) => a.key === actuatorKey)?.label ?? "Aktuator"} ${nextOn ? "dinyalakan" : "dimatikan"}`
        );
      }

      onUpdated?.(data);
    } catch (err) {
      toast.error(err.message || "Gagal mengubah aktuator");
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className={className}>
      {!compact && (
        <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
          {readOnly ? "Status aktuator" : "Kontrol aktuator"}
        </div>
      )}
      <div className={`grid gap-1.5 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"}`}>
        {ACTUATORS.map(({ key, field, label, icon }) => (
          <ActuatorSwitch
            key={key}
            label={label}
            icon={icon}
            value={values[field]}
            compact={compact}
            readOnly={readOnly}
            loading={loadingKey === key}
            disabled={disabled}
            onChange={(next) => handleToggle(key, next)}
          />
        ))}
      </div>
      {!compact && !readOnly && (
        <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
          Geser tombol untuk kontrol manual. Saat alert terpicu, aktuator yang relevan dapat
          dinyalakan otomatis oleh sistem.
        </p>
      )}
    </div>
  );
}
