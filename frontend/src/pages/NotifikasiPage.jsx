import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TriangleAlert, CheckCircle2, Filter, Menu, Lightbulb, Bot } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
import { useAlerts, getAlertDetail } from "../context/AlertContext";
import PetaniTopbar from "../layouts/PetaniTopbar";
import PetaniBottomNav from "../layouts/PetaniBottomNav";
import { pickPrimaryAlert, focusAlertHighlight } from "../utils/petaniAlertNav";
import { isAutoHandledAlert, getAutoHandledExplanation } from "../constants/actuatorRules";
import { RESOLVE_ACTION_OPTIONS } from "../constants/alertResolve";
import {
  ALERT_CATEGORY,
  getAlertCategory,
  getAlertCategoryLabel,
  getAlertIconClasses,
  getAlertListItemClasses,
  getCategoryBadgeClasses,
  getAlertDisplayMessage,
  sortAlertsForDisplay,
} from "../utils/alertDisplay";
import { isAlertCritical, getAdviceForAlert } from "../constants/paramHealth";
import PullToRefresh from "../components/PullToRefresh";
import { AlertListSkeleton } from "../components/LoadingUI";

function dayKeyOf(dateStr) {
    return new Date(dateStr).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function dayLabelOf(dateStr) {
    const key = dayKeyOf(dateStr);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", {
        timeZone: "Asia/Jakarta",
    });
    if (key === today) return "Hari ini";
    if (key === yesterday) return "Kemarin";
    return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
    });
}

/** Kelompokkan alert per hari (created_at), lalu per screenhouse dalam hari itu. */
function groupAlertsByDayAndScreenhouse(alerts) {
    const days = new Map();
    for (const alert of alerts) {
        const dKey = dayKeyOf(alert.created_at);
        if (!days.has(dKey)) {
            days.set(dKey, { key: dKey, label: dayLabelOf(alert.created_at), screenhouses: new Map() });
        }
        const day = days.get(dKey);
        const shKey = alert.screenhouse_id;
        if (!day.screenhouses.has(shKey)) {
            day.screenhouses.set(shKey, {
                id: shKey,
                name: alert.screenhouse_name,
                alerts: [],
            });
        }
        day.screenhouses.get(shKey).alerts.push(alert);
    }
    return Array.from(days.values());
}

function NotifikasiPage() {
    const navigate = useNavigate();
    const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
    const [filter, setFilter] = useState("semua");
    const [blinkId, setBlinkId] = useState(null);
    const [resolveTarget, setResolveTarget] = useState(null);
    const [resolveNote, setResolveNote] = useState(RESOLVE_ACTION_OPTIONS[0]);
    const [customNote, setCustomNote] = useState("");
    const [searchParams, setSearchParams] = useSearchParams();
    const highlightHandled = useRef(false);
    const user = JSON.parse(localStorage.getItem("user"));
    const {
        alerts,
        alertsLoading,
        resolveAlert,
        resolvingAlertId,
        markAutoHandledAlertsSeen,
        refetchAlerts,
    } = useAlerts();

    useEffect(() => {
        const status = filter === "semua" ? "all" : filter;
        refetchAlerts({ status, limit: 500 });
    }, [filter, refetchAlerts]);

    useEffect(() => {
        if (alertsLoading) return;
        markAutoHandledAlertsSeen();
    }, [alertsLoading, alerts, markAutoHandledAlertsSeen]);

    useEffect(() => {
        highlightHandled.current = false;
    }, [searchParams]);

    useEffect(() => {
        if (highlightHandled.current) return;
        if (alertsLoading && alerts.length === 0) return;

        const highlightParam = searchParams.get("highlight");
        const screenhouseParam = searchParams.get("screenhouse");
        if (!highlightParam && !screenhouseParam) return;

        let targetId = highlightParam ? String(highlightParam) : null;

        if (!targetId && screenhouseParam) {
            const matches = alerts.filter(
                (a) => String(a.screenhouse_id) === String(screenhouseParam)
            );
            const picked =
                pickPrimaryAlert(matches.filter((a) => a.status === "active")) ??
                pickPrimaryAlert(matches);
            targetId = picked?.id != null ? String(picked.id) : null;
        }

        if (!targetId) {
            highlightHandled.current = true;
            setSearchParams({}, { replace: true });
            return;
        }

        const alert = alerts.find((a) => String(a.id) === targetId);
        if (!alert) return;

        if (filter !== "semua" && alert.status !== filter) {
            setFilter("semua");
            return;
        }

        highlightHandled.current = true;

        const cancelFocus = focusAlertHighlight(targetId, {
            onFound: (id) => {
                setBlinkId(id);
                setSearchParams({}, { replace: true });
                window.setTimeout(() => setBlinkId(null), 1100);
            },
            onGiveUp: () => {
                setSearchParams({}, { replace: true });
            },
        });

        return () => cancelFocus();
    }, [alertsLoading, alerts, filter, searchParams, setSearchParams]);

    const filtered = filter === "semua" ? alerts : alerts.filter((a) => a.status === filter);
    const sortedFiltered = useMemo(
        () => sortAlertsForDisplay(filtered),
        [filtered]
    );
    const grouped = useMemo(
        () => groupAlertsByDayAndScreenhouse(sortedFiltered),
        [sortedFiltered]
    );
    const showLoadingSkeleton = alertsLoading && alerts.length === 0;

    const submitResolve = async () => {
        if (!resolveTarget) return;
        const note =
            resolveNote === "Lainnya"
                ? customNote.trim() || "Sudah ditangani"
                : resolveNote;
        await resolveAlert(resolveTarget, note);
        setResolveTarget(null);
        setCustomNote("");
    };

    return (
        <div className="app-shell fixed inset-0 flex bg-bl-surface overflow-hidden">
            <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} screenhouses={[]} role={user?.role} user={user} />

            <div className="flex-1 flex flex-col overflow-hidden min-w-0 text-left">
                <PetaniTopbar
                    onToggleSidebar={toggleSidebar}
                    title="Peringatan"
                    subtitle="Pantau dan tandai peringatan screenhouse"
                    onBack={() => {
                        if (window.history.state?.idx > 0) {
                            navigate(-1);
                        } else {
                            navigate("/petani/dashboard");
                        }
                    }}
                />

                <PullToRefresh onRefresh={refetchAlerts} className="p-4 sm:p-5 space-y-4">

                    {showLoadingSkeleton ? (
                        <AlertListSkeleton count={4} />
                    ) : (
                    <>
                    {/* FILTER */}
                    <div className="flex items-center gap-2">
                        <Filter size={14} className="text-gray-600" />
                        <span className="text-xs text-gray-600 font-medium mr-1">Filter:</span>
                        {[
                            { key: "semua", label: "Semua" },
                            { key: "active", label: "Aktif" },
                            { key: "resolved", label: "Selesai" },
                        ].map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === f.key ? "bg-bl-primary text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* ALERT LIST — dikelompokkan per hari, lalu per screenhouse */}
                    <div className="space-y-5">
                        {sortedFiltered.length === 0 && (
                            <div className="text-center py-12 text-gray-600">
                                <CheckCircle2 size={32} className="mx-auto mb-3 text-gray-500" />
                                <div className="text-sm font-medium">Tidak ada peringatan</div>
                            </div>
                        )}
                        {grouped.map((day) => (
                            <div key={day.key}>
                                <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-2">
                                    {day.label}
                                </div>
                                <div className="space-y-4">
                                    {Array.from(day.screenhouses.values()).map((sh) => (
                                        <div key={sh.id}>
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/petani/screenhouse/${sh.id}`)}
                                                className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700 hover:text-bl-primary hover:underline"
                                            >
                                                {sh.name}
                                                <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold">
                                                    {sh.alerts.length}
                                                </span>
                                            </button>
                                            <div className="space-y-3">
                                                {sh.alerts.map((alert) => (
                                                    <AlertRow
                                                        key={alert.id}
                                                        alert={alert}
                                                        blinkId={blinkId}
                                                        resolvingAlertId={resolvingAlertId}
                                                        onOpenResolve={() => {
                                                            setResolveTarget(alert.id);
                                                            setResolveNote(RESOLVE_ACTION_OPTIONS[0]);
                                                        }}
                                                        navigate={navigate}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    </>
                    )}

                </PullToRefresh>
                <PetaniBottomNav />

                {resolveTarget && (
                    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4 bg-black/40">
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-5 text-left">
                            <div className="text-sm font-semibold text-gray-800">Tandai selesai</div>
                            <p className="text-xs text-gray-600 font-medium mt-1">Catat tindakan yang Anda lakukan (opsional).</p>
                            <div className="mt-3 space-y-1.5">
                                {RESOLVE_ACTION_OPTIONS.map((opt) => (
                                    <label
                                        key={opt}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer ${
                                            resolveNote === opt
                                                ? "border-bl-primary bg-bl-surface-muted"
                                                : "border-gray-200 hover:bg-gray-50"
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="resolve-note"
                                            checked={resolveNote === opt}
                                            onChange={() => setResolveNote(opt)}
                                            className="text-bl-primary"
                                        />
                                        {opt}
                                    </label>
                                ))}
                            </div>
                            {resolveNote === "Lainnya" && (
                                <input
                                    type="text"
                                    value={customNote}
                                    onChange={(e) => setCustomNote(e.target.value)}
                                    placeholder="Jelaskan singkat..."
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100"
                                />
                            )}
                            <div className="flex gap-2 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setResolveTarget(null)}
                                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    onClick={submitResolve}
                                    disabled={resolvingAlertId === resolveTarget}
                                    className="flex-1 py-2.5 rounded-xl bg-bl-primary text-white text-sm font-medium disabled:opacity-50"
                                >
                                    {resolvingAlertId === resolveTarget ? "Menyimpan..." : "Simpan"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function AlertRow({ alert, blinkId, resolvingAlertId, onOpenResolve, navigate }) {
    const autoHandled = isAutoHandledAlert(alert, alert.capabilities);
    const autoHandledExplanation = autoHandled ? getAutoHandledExplanation(alert) : null;
    const advice = alert.status === "active" && !autoHandled ? getAdviceForAlert(alert) : null;
    const category = getAlertCategory(alert);
    const categoryLabel = getAlertCategoryLabel(category);
    const iconBoxCls = getAlertIconClasses(alert);
    const cardCls = getAlertListItemClasses(alert, {
        blink: blinkId != null && String(blinkId) === String(alert.id),
    });
    const actionControl =
        alert.status === "active" ? (
            autoHandled ? null : (
                <button
                    type="button"
                    onClick={onOpenResolve}
                    disabled={resolvingAlertId === alert.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-medium hover:bg-gray-50 transition disabled:opacity-50"
                >
                    <CheckCircle2 size={13} />
                    {resolvingAlertId === alert.id ? "Menyimpan..." : "Tandai selesai"}
                </button>
            )
        ) : null;

    return (
        <div id={`alert-${alert.id}`} className={cardCls}>
            <div className={iconBoxCls}>
                {alert.status === "active" ? (
                    <TriangleAlert
                        size={17}
                        className={
                            category === ALERT_CATEGORY.DEVICE
                                ? "text-slate-600 font-medium"
                                : isAlertCritical(alert)
                                ? "text-red-600"
                                : "text-amber-600"
                        }
                    />
                ) : (
                    <CheckCircle2 size={17} className="text-bl-primary" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={getCategoryBadgeClasses(category)}>{categoryLabel}</span>
                    {/* Alert yang ditangani otomatis jangan tampilkan badge merah "Aktif" —
                        menyesatkan (seolah petani harus bertindak) padahal sistem sudah
                        menangani. Cukup badge hijau "Ditangani otomatis". */}
                    {!(autoHandled && alert.status === "active") && (
                        <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                alert.status === "active" ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600"
                            }`}
                        >
                            {alert.status === "active" ? "Aktif" : "Selesai"}
                        </span>
                    )}
                    {autoHandled && alert.status === "active" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-bl-surface-muted text-bl-primary">
                            <Bot size={12} aria-hidden />
                            Sedang ditangani otomatis
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => navigate(`/petani/screenhouse/${alert.screenhouse_id}`)}
                    className="text-base font-semibold text-gray-900 text-left hover:text-bl-primary hover:underline leading-snug"
                >
                    {getAlertDisplayMessage(alert)}
                </button>
                <div className="text-xs text-gray-600 font-medium mt-1 tabular-nums">
                    {new Date(alert.created_at).toLocaleString("id-ID")}
                </div>

                <AlertValueDetail alert={alert} />

                {autoHandledExplanation && alert.status === "active" && (
                    <p className="mt-2 text-xs text-gray-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
                        {autoHandledExplanation}
                    </p>
                )}

                {advice && (
                    <div className="mt-2 flex gap-2 rounded-lg bg-amber-50/70 border border-amber-100 px-2.5 py-2">
                        <Lightbulb size={14} className="shrink-0 text-amber-600 mt-0.5" aria-hidden />
                        <p className="text-xs leading-relaxed text-gray-700">{advice}</p>
                    </div>
                )}

                {actionControl && <div className="mt-2.5 flex justify-end sm:hidden">{actionControl}</div>}

                {alert.status === "resolved" && (
                    <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                        {alert.resolved_at && (
                            <div className="flex items-center gap-1">
                                <CheckCircle2 size={12} className="text-gray-500" />
                                Diselesaikan {new Date(alert.resolved_at).toLocaleString("id-ID")}
                            </div>
                        )}
                        {alert.resolve_note && (
                            <div className="text-gray-700 font-medium pl-4">Tindakan: {alert.resolve_note}</div>
                        )}
                    </div>
                )}
            </div>

            {actionControl && <div className="hidden sm:block shrink-0 self-start">{actionControl}</div>}
        </div>
    );
}

function AlertValueDetail({ alert }) {
    const detail = getAlertDetail(alert)
    if (!detail || detail.actual === undefined || detail.actual === null) return null

    const unit = detail.unit ?? ""
    const label = detail.label
      ? detail.label.charAt(0).toUpperCase() + detail.label.slice(1)
      : detail.param

    const thresholdBadge = (kind, value) => (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-300 shadow-sm">
            <span className="text-[11px] text-slate-700 uppercase tracking-wide font-semibold">{kind}</span>
            <span className="text-xs font-bold text-slate-900 tabular-nums">{value} {unit}</span>
        </div>
    )

    return (
        <div className="mt-2 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-100 border border-red-300 shadow-sm">
                <span className="text-[11px] text-red-800 uppercase tracking-wide font-semibold">Aktual</span>
                <span className="text-xs font-bold text-red-900 tabular-nums">{detail.actual} {unit}</span>
            </div>

            {detail.isMin && detail.min !== undefined && thresholdBadge("Min", detail.min)}
            {detail.isMax && detail.max !== undefined && thresholdBadge("Maks", detail.max)}

            {detail.min !== undefined && detail.max !== undefined && (
                <div className="w-full mt-1.5">
                    <div className="flex justify-between text-[11px] text-gray-700 font-semibold tabular-nums mb-1">
                        <span>{detail.min}{unit ? ` ${unit}` : ""}</span>
                        <span className="text-gray-600 font-medium">Rentang normal {label}</span>
                        <span>{detail.max}{unit ? ` ${unit}` : ""}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full relative overflow-hidden border border-gray-300/60">
                        <div
                            className="absolute h-full bg-green-400 rounded-full"
                            style={{
                                left: `${(detail.min / (detail.max * 1.5)) * 100}%`,
                                width: `${((detail.max - detail.min) / (detail.max * 1.5)) * 100}%`,
                            }}
                        />
                        {detail.actual !== null && (
                            <div
                                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-red-600 border-2 border-white shadow-md"
                                style={{ left: `calc(${Math.min((detail.actual / (detail.max * 1.5)) * 100, 98)}% - 5px)` }}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default NotifikasiPage;