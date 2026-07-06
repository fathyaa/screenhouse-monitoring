import { ChevronDown } from "lucide-react";

const SELECT_CLASS =
  "w-full appearance-none pl-3.5 pr-9 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 outline-none transition hover:border-gray-300 focus:border-emerald-600/40 focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:border-gray-200";

export default function FilterSelect({
  label,
  value,
  onChange,
  disabled = false,
  children,
}) {
  return (
    <label className="block text-left">
      <span className="text-xs text-gray-600 font-medium mb-1.5 block">{label}</span>
      <div className={`relative ${disabled ? "opacity-70" : ""}`}>
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={SELECT_CLASS}
        >
          {children}
        </select>
        <ChevronDown
          size={15}
          strokeWidth={2}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          aria-hidden
        />
      </div>
    </label>
  );
}
