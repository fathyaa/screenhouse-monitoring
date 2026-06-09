import { Droplets, Lightbulb, Wind } from "lucide-react";

function StatusBadge({ value, label, icon: Icon }) {
  const isOn = value === true || value === 1 || value === "on";
  const hasValue = value !== null && value !== undefined;

  return (
    <div className="bg-gray-50 rounded-xl p-2.5 flex items-start justify-between text-left">
      <div className="text-left min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">
          {label}
        </div>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            !hasValue
              ? "bg-gray-100 text-gray-400"
              : isOn
              ? "bg-green-50 text-green-800"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {!hasValue ? "—" : isOn ? "Nyala" : "Mati"}
        </span>
      </div>
      <Icon size={18} className="text-gray-300 shrink-0" />
    </div>
  );
}

export default function ActuatorStatusBadges({
  fan_status,
  irrigation_status,
  lamp_status,
  className = "",
}) {
  return (
    <div className={className}>
      <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
        Status aktuator
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <StatusBadge value={fan_status} label="Fan" icon={Wind} />
        <StatusBadge value={irrigation_status} label="Irigasi" icon={Droplets} />
        <StatusBadge value={lamp_status} label="Lampu" icon={Lightbulb} />
      </div>
    </div>
  );
}
