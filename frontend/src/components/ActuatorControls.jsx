import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Bot, Droplets, Lightbulb, Wind } from "lucide-react";
import { API_URL } from "../config/api";
import { buildAutoActuatorLocks } from "../constants/actuatorRules";

const ACTUATORS = [
  { key: "fan", field: "fan_status", label: "Kipas", icon: Wind },
  { key: "irrigation", field: "irrigation_status", label: "Irigasi", icon: Droplets },
  { key: "lamp", field: "lamp_status", label: "Lampu", icon: Lightbulb },
];

const CONFIRM_MESSAGES = {
  fan: {
    on: "Nyalakan kipas untuk sirkulasi udara?",
    off: "Matikan kipas?",
  },
  irrigation: {
    on: "Nyalakan irigasi? Pastikan drainase screenhouse lancar.",
    off: "Matikan irigasi?",
  },
  lamp: {
    on: "Nyalakan lampu pemanas/penerangan?",
    off: "Matikan lampu?",
  },
};

const AUTO_LOCK_TOAST =
  "Peralatan sedang dikontrol otomatis oleh sistem. Tunggu kondisi normal sebelum mengubah manual.";

function isOn(value) {
  return value === true || value === 1 || value === "on";
}

function ActuatorSwitch({
  label,
  icon: Icon,
  value,
  onChange,
  disabled,
  loading,
  compact,
  showSubtext = !compact,
  readOnly,
  autoLocked = false,
}) {
  const on = isOn(value);
  const hasValue = value !== null && value !== undefined;

  if (readOnly) {
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border p-2.5 ${
          on ? "bg-bl-surface-muted border-bl-accent/30" : "bg-gray-50 border-gray-100"
        } ${autoLocked ? "opacity-70" : ""}`}
      >
        <Icon size={16} className={on ? "text-bl-primary" : "text-gray-600"} />
        <div className="text-left min-w-0">
          <div className="text-xs font-medium text-gray-700">{label}</div>
          <div className={`text-[10px] ${on ? "text-bl-primary" : "text-gray-600"}`}>
            {!hasValue ? "Belum diketahui" : on ? "Nyala" : "Mati"}
            {autoLocked && ", otomatis"}
          </div>
        </div>
      </div>
    );
  }

  const trackClass = compact ? "h-5 w-9" : "h-6 w-11";
  const thumbClass = compact ? "h-4 w-4" : "h-5 w-5";
  const switchDisabled = disabled || loading || !hasValue || autoLocked;

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-xl border transition ${
        compact ? "p-2" : "p-2.5"
      } ${on ? "bg-bl-surface-muted border-bl-accent/30" : "bg-gray-50 border-gray-100"} ${
        autoLocked ? "opacity-70" : disabled ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={compact ? 14 : 16} className={on ? "text-bl-primary" : "text-gray-600"} />
        <div className="text-left min-w-0">
          <div className={`font-medium text-gray-700 ${compact ? "text-[10px]" : "text-xs"}`}>
            {label}
          </div>
          {showSubtext && (
            <div className={`text-[10px] ${on ? "text-bl-primary" : "text-gray-600"}`}>
              {!hasValue ? "Belum diketahui" : on ? "Nyala" : "Mati"}
              {autoLocked && ", otomatis"}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-disabled={autoLocked || undefined}
        aria-label={`${label} ${on ? "nyala" : "mati"}${autoLocked ? ", dikontrol otomatis" : ""}`}
        disabled={switchDisabled}
        onClick={() => {
          if (autoLocked) {
            toast(AUTO_LOCK_TOAST, { icon: <Bot size={16} /> });
            return;
          }
          onChange(!on);
        }}
        className={`${trackClass} shrink-0 rounded-full p-0.5 flex items-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-300 ${
          on
            ? autoLocked
              ? "justify-end bg-green-600/45"
              : "justify-end bg-green-600"
            : autoLocked
            ? "justify-start bg-gray-300/70"
            : "justify-start bg-gray-300"
        } ${switchDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
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
  autoAlerts = [],
  disabled = false,
  compact = false,
  wide = false,
  readOnly = false,
  offline = false,
  onUpdated,
  className = "",
}) {
  const [loadingKey, setLoadingKey] = useState(null);
  const [pendingConfirm, setPendingConfirm] = useState(null);

  // Alert auto-handled lama bisa "nyangkut aktif" selamanya kalau screenhouse-nya
  // offline (tidak ada data baru yang membuktikan kondisi sudah normal). Kalau
  // offline, jangan klaim "sedang dikontrol otomatis" — tidak ada sistem yang
  // benar-benar mengontrol saat ini. Mirror ke backend: assertManualActuatorAllowed
  // di actuatorService.js.
  const autoLocks = useMemo(
    () =>
      offline
        ? {}
        : buildAutoActuatorLocks(autoAlerts, {
            screenhouseId: screenhouseId ?? undefined,
          }),
    [autoAlerts, screenhouseId, offline]
  );

  const autoBannerMessages = useMemo(
    () => [...new Set(Object.values(autoLocks).map((lock) => lock.message).filter(Boolean))],
    [autoLocks]
  );

  const values = {
    fan_status,
    irrigation_status,
    lamp_status,
  };

  const executeToggle = async (actuatorKey, nextOn) => {
    if (readOnly) return;
    if (autoLocks[actuatorKey]) {
      toast(AUTO_LOCK_TOAST, { icon: <Bot size={16} /> });
      return;
    }
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
        if (res.status === 409 && data.code === "AUTO_ACTUATOR_LOCKED") {
          toast(data.message || AUTO_LOCK_TOAST, { icon: <Bot size={16} /> });
          return;
        }
        throw new Error(data.message || "Gagal mengubah peralatan");
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
      toast.error(err.message || "Gagal mengubah peralatan");
    } finally {
      setLoadingKey(null);
      setPendingConfirm(null);
    }
  };

  const handleToggleRequest = (actuatorKey, nextOn) => {
    if (readOnly) return;
    if (autoLocks[actuatorKey]) {
      toast(AUTO_LOCK_TOAST, { icon: <Bot size={16} /> });
      return;
    }

    const actuator = ACTUATORS.find((a) => a.key === actuatorKey);
    if (!actuator) return;

    const msg =
      CONFIRM_MESSAGES[actuatorKey]?.[nextOn ? "on" : "off"] ??
      `${nextOn ? "Nyalakan" : "Matikan"} ${actuator.label.toLowerCase()}?`;

    setPendingConfirm({ actuatorKey, nextOn, label: actuator.label, message: msg });
  };

  return (
    <div className={className}>
      {!compact && (
        <div className="text-[10px] uppercase tracking-wide text-gray-600 mb-1.5">
          {readOnly ? "Status peralatan" : "Kontrol peralatan"}
        </div>
      )}

      {autoBannerMessages.length > 0 && (() => {
        const terse = compact && !wide;
        return (
          <div
            className={`flex items-start gap-2 rounded-xl bg-bl-surface-muted border border-bl-accent/25 mb-2 ${
              terse ? "px-2.5 py-2" : "gap-2.5 px-3 py-2.5 mb-2.5"
            }`}
          >
            <Bot
              size={terse ? 14 : 16}
              className="shrink-0 text-bl-primary mt-0.5"
              aria-hidden
            />
            <p
              className={`text-gray-800 leading-relaxed ${
                terse ? "text-[11px]" : "text-xs sm:text-sm"
              }`}
            >
              <span className="font-semibold text-bl-primary">Dikontrol otomatis:</span>{" "}
              {autoBannerMessages.join("; ")}
              {!terse && ". Tombol terkait dikunci sementara demi keamanan bibit."}
            </p>
          </div>
        );
      })()}

      <div
        className={`grid gap-1.5 ${
          compact ? (wide ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1") : "grid-cols-1 sm:grid-cols-3"
        }`}
      >
        {ACTUATORS.map(({ key, field, label, icon }) => {
          const lock = autoLocks[key];
          const rawValue = values[field];
          const displayValue =
            lock && (rawValue === null || rawValue === undefined)
              ? lock.expectedOn
              : rawValue;

          return (
            <ActuatorSwitch
              key={key}
              label={label}
              icon={icon}
              value={displayValue}
              compact={compact}
              showSubtext={!compact || wide}
              readOnly={readOnly}
              loading={loadingKey === key}
              disabled={disabled}
              autoLocked={Boolean(lock) && !readOnly}
              onChange={(next) => handleToggleRequest(key, next)}
            />
          );
        })}
      </div>
      {!compact && !readOnly && (
        <p className="text-[11px] text-gray-600 font-medium mt-2 leading-relaxed">
          Geser tombol untuk kontrol manual. Setiap perubahan meminta konfirmasi. Saat ada peringatan,
          peralatan terkait dikunci otomatis hingga kondisi normal.
        </p>
      )}

      {pendingConfirm && (
        <div
          className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="actuator-confirm-title"
        >
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm p-5 text-left">
            <div id="actuator-confirm-title" className="text-sm font-semibold text-gray-800">
              {pendingConfirm.nextOn ? "Nyalakan" : "Matikan"} {pendingConfirm.label}?
            </div>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">{pendingConfirm.message}</p>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => executeToggle(pendingConfirm.actuatorKey, pendingConfirm.nextOn)}
                disabled={loadingKey === pendingConfirm.actuatorKey}
                className="flex-1 py-2.5 rounded-xl bg-bl-primary hover:bg-bl-primary-hover text-white text-sm font-medium disabled:opacity-50"
              >
                {loadingKey === pendingConfirm.actuatorKey
                  ? "Memproses..."
                  : pendingConfirm.nextOn
                  ? "Ya, nyalakan"
                  : "Ya, matikan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
