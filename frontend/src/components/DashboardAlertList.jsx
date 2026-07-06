import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  ALERT_CATEGORY,
  getAlertCategoryLabel,
  getCategoryBadgeClasses,
  getTrayLabel,
  groupAlertsForDashboard,
} from "../utils/alertDisplay";

function rowBorderClasses(item) {
  if (item.category === ALERT_CATEGORY.DEVICE) {
    return "border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100/90";
  }
  if (item.critical) {
    return "border-red-300 bg-red-50 text-red-950 hover:bg-red-100/70 alert-attention-pulse";
  }
  return "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100/70 alert-attention-pulse";
}

function dotColor(item) {
  if (item.category === ALERT_CATEGORY.DEVICE) return "#94a3b8";
  return item.critical ? "#dc2626" : "#d97706";
}

export default function DashboardAlertList({ alerts, onNavigateAlert, onViewAll }) {
  const items = groupAlertsForDashboard(alerts);
  const [expanded, setExpanded] = useState(() => new Set());

  if (!items.length) return null;

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-sm font-semibold text-gray-800">Peringatan aktif</div>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-medium text-bl-primary hover:underline"
        >
          Lihat semua
        </button>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => {
          const isGroup = item.kind === "group";
          const isOpen = expanded.has(item.id);

          if (item.kind === "single") {
            const a = item.alert;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigateAlert({ alertId: a.id })}
                className={`w-full flex items-start gap-2 text-sm rounded-lg px-3 py-2 text-left transition border hover:opacity-90 ${rowBorderClasses(item)}`}
              >
                <span
                  className="mt-1 w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: dotColor(item) }}
                />
                <span className="min-w-0">
                  <span className={`mr-1.5 ${getCategoryBadgeClasses(item.category)}`}>
                    {getAlertCategoryLabel(item.category)}
                  </span>
                  <span className="font-semibold text-gray-900">{a.screenhouse_name}</span>
                  <span className="text-gray-800">: {a.message}</span>
                  {item.advice && (
                    <span className="text-gray-700 font-medium"> · {item.advice}</span>
                  )}
                </span>
              </button>
            );
          }

          return (
            <div key={item.id} className={`rounded-lg border text-sm text-left ${rowBorderClasses(item)}`}>
              <div className="flex items-start gap-2 px-3 py-2">
                <span
                  className="mt-1 w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: dotColor(item) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <span className={getCategoryBadgeClasses(item.category)}>
                      {getAlertCategoryLabel(item.category)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateAlert({ alertId: item.alerts[0]?.id })}
                    className="text-left hover:underline w-full font-medium text-gray-900"
                  >
                    {item.summary}
                  </button>
                  {item.advice && (
                    <div className="text-xs text-gray-700 font-medium mt-0.5">{item.advice}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleExpand(item.id)}
                  className="shrink-0 flex items-center gap-0.5 text-[11px] font-semibold text-gray-700 hover:text-gray-900 px-1.5 py-0.5 rounded-md hover:bg-black/5"
                  aria-expanded={isOpen}
                >
                  Detail
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </div>
              {isOpen && (
                <div className="border-t border-black/5 px-3 py-2 space-y-1 bg-white/60 rounded-b-lg">
                  {item.alerts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onNavigateAlert({ alertId: a.id })}
                      className="w-full text-left text-xs text-gray-700 hover:text-bl-primary py-1 px-1 rounded hover:bg-gray-50"
                    >
                      <span className="font-semibold text-gray-900">{a.screenhouse_name}</span>
                      {isGroup && item.category === ALERT_CATEGORY.DEVICE && (
                        <span className="text-gray-600 font-medium"> · {getTrayLabel(a)}</span>
                      )}
                      {item.category === ALERT_CATEGORY.SOIL && (
                        <span className="text-gray-600 font-medium"> · {a.message}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
