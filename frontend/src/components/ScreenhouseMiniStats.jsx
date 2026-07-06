import { Droplets, Leaf } from "lucide-react";
import { evaluateParam } from "../constants/paramHealth";

const PARAM_CHIPS = [
  {
    key: "soil_moisture",
    icon: Droplets,
    format: (v) => `${Math.round(Number(v))}%`,
    suffix: "air tanah",
    chipClass: "bg-blue-50/80 border-blue-100 text-blue-900",
    iconClass: "text-blue-600",
    suffixClass: "text-blue-600/70",
    overLabel: "Basah",
  },
  {
    key: "nitrogen",
    icon: Leaf,
    format: (v) => `${Math.round(Number(v))}`,
    suffix: "N (mg/kg)",
    chipClass: "bg-green-50/80 border-green-100 text-green-900",
    iconClass: "text-green-600",
    suffixClass: "text-green-600/70",
    overLabel: "Berlebih",
  },
];

function thresholdFromSensor(sensor) {
  if (!sensor) return null;
  return {
    min_nitrogen: sensor.min_nitrogen,
    max_nitrogen: sensor.max_nitrogen,
    min_soil_moisture: sensor.min_soil_moisture,
    max_soil_moisture: sensor.max_soil_moisture,
  };
}

/** Hanya tampilkan parameter yang melebihi batas maksimum threshold. */
export default function ScreenhouseMiniStats({ sensor, threshold: thresholdProp }) {
  if (!sensor) return null;

  const threshold = thresholdProp ?? thresholdFromSensor(sensor);
  if (!threshold?.max_soil_moisture && !threshold?.max_nitrogen) return null;

  const exceeded = PARAM_CHIPS.map((cfg) => {
    const value = sensor[cfg.key];
    const evals = evaluateParam(cfg.key, value, threshold);
    if (evals.status !== "high") return null;
    return { cfg, value, evals };
  }).filter(Boolean);

  if (!exceeded.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {exceeded.map(({ cfg, value }) => {
        const Icon = cfg.icon;
        return (
          <div
            key={cfg.key}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] ${cfg.chipClass}`}
          >
            <Icon size={11} className={`shrink-0 ${cfg.iconClass}`} />
            <span className="font-semibold">{cfg.format(value)}</span>
            <span className={cfg.suffixClass}>{cfg.suffix}</span>
            <span className="px-1 py-0.5 rounded bg-red-50 text-red-700 font-medium">
              {cfg.overLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
