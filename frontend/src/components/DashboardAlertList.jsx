import { useState } from "react";
import { ChevronDown, Bot } from "lucide-react";
import {
  ALERT_CATEGORY,
  getAlertCategoryLabel,
  getCategoryBadgeClasses,
  groupAlertsForDashboard,
} from "../utils/alertDisplay";
import { isAutoHandledAlert } from "../constants/actuatorRules";

function AutoHandledBadge() {
  return (
    <span className="inline-flex items-center gap-1 ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-bl-surface-muted text-bl-primary align-middle">
      <Bot size={11} aria-hidden />
      Ditangani otomatis
    </span>
  );
}

const LOCATION_PREVIEW = 3;

function rowBorderClasses(item) {
  if (item.category === ALERT_CATEGORY.DEVICE) {
    return "border-slate-300 bg-slate-50 text-slate-800";
  }
  if (item.critical) {
    return "border-red-300 bg-red-50 text-red-950";
  }
  return "border-amber-300 bg-amber-50 text-amber-950";
}

function dotColor(item) {
  if (item.category === ALERT_CATEGORY.DEVICE) return "#94a3b8";
  return item.critical ? "#dc2626" : "#d97706";
}

function shortenScreenhouseName(name) {
  return String(name ?? "")
    .replace(/^Screenhouse\s+/i, "")
    .trim() || name;
}

function LocationRows({ locations, showRacks, expanded, onNavigate }) {
  const visible = expanded ? locations : locations.slice(0, LOCATION_PREVIEW);
  const hiddenCount = locations.length - LOCATION_PREVIEW;

  return (
    <div className="mt-2.5 space-y-1.5">
      {visible.map((loc) => (
        <button
          key={loc.fullName ?? loc.name}
          type="button"
          onClick={() => loc.primaryAlertId && onNavigate({ alertId: loc.primaryAlertId })}
          className="w-full flex items-center justify-between gap-2 rounded-lg bg-white/85 border border-black/5 px-2.5 py-2 text-left hover:bg-white hover:border-bl-primary/30 transition group"
        >
          <span className="text-xs font-semibold text-gray-800 truncate min-w-0 group-hover:text-bl-primary">
            {loc.name}
          </span>
          {showRacks && loc.racks?.length > 0 && (
            <span className="flex flex-wrap gap-1 justify-end shrink-0">
              {loc.racks.map((rack) => (
                <span
                  key={rack}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-200/90 text-slate-700"
                >
                  {rack}
                </span>
              ))}
            </span>
          )}
        </button>
      ))}
      {!expanded && hiddenCount > 0 && (
        <div className="text-[11px] font-medium text-gray-500 px-1">
          +{hiddenCount} screenhouse lainnya
        </div>
      )}
    </div>
  );
}

function GroupAlertCard({ item, expanded, onToggleExpand, onNavigateAlert }) {
  const { display } = item;
  const showRacks = item.category === ALERT_CATEGORY.DEVICE;
  const needsExpand = display.locations.length > LOCATION_PREVIEW;
  const isOpen = expanded;
  const autoHandled = isAutoHandledAlert(item.alerts?.[0]);

  const openPrimary = () => {
    if (item.primaryAlertId) {
      onNavigateAlert({ alertId: item.primaryAlertId });
    }
  };

  return (
    <div className={`rounded-xl border text-sm text-left ${rowBorderClasses(item)}`}>
      <div className="px-3 py-3">
        <div className="flex items-start gap-2">
          <span
            className="mt-1.5 w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: dotColor(item) }}
          />
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={openPrimary}
              className="w-full text-left rounded-lg hover:bg-white/60 transition px-0.5 py-0.5 -mx-0.5"
            >
              <span className={getCategoryBadgeClasses(item.category)}>
                {getAlertCategoryLabel(item.category)}
              </span>
              {autoHandled && <AutoHandledBadge />}
              <div className="mt-1.5 text-base font-bold text-gray-900 leading-snug">
                {display.headline}
              </div>
              <div className="text-xs font-medium text-gray-600 mt-0.5">{display.subline}</div>
            </button>

            <LocationRows
              locations={display.locations}
              showRacks={showRacks}
              expanded={!needsExpand || isOpen}
              onNavigate={onNavigateAlert}
            />
          </div>

          {needsExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="shrink-0 flex items-center gap-0.5 text-[11px] font-semibold text-gray-600 hover:text-gray-900 px-1.5 py-1 rounded-md hover:bg-black/5"
              aria-expanded={isOpen}
            >
              {isOpen ? "Ringkas" : "Semua"}
              <ChevronDown
                size={14}
                className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
      </div>
    </div>
  );
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
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <div className="text-sm font-semibold text-gray-800">Peringatan aktif</div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {items.length} jenis peringatan perlu dicek
          </div>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-semibold text-bl-primary hover:underline shrink-0"
        >
          Lihat semua
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          if (item.kind === "single") {
            const a = item.alert;
            const autoHandled = isAutoHandledAlert(a);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigateAlert({ alertId: a.id })}
                className={`w-full rounded-xl px-3 py-3 text-left transition border hover:opacity-95 ${rowBorderClasses(item)}`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: dotColor(item) }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className={getCategoryBadgeClasses(item.category)}>
                      {getAlertCategoryLabel(item.category)}
                    </span>
                    {autoHandled && <AutoHandledBadge />}
                    <div className="mt-1.5 text-sm font-bold text-gray-900">
                      {shortenScreenhouseName(a.screenhouse_name)}
                    </div>
                    <div className="text-sm text-gray-800 mt-0.5 leading-snug">{a.message}</div>
                  </div>
                </div>
              </button>
            );
          }

          return (
            <GroupAlertCard
              key={item.id}
              item={item}
              expanded={expanded.has(item.id)}
              onToggleExpand={() => toggleExpand(item.id)}
              onNavigateAlert={onNavigateAlert}
            />
          );
        })}
      </div>
    </div>
  );
}
