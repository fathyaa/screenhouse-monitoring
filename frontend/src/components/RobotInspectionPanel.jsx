import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Bot, CheckCircle2, Droplets, PlayCircle, TriangleAlert } from "lucide-react";
import { API_URL } from "../config/api";
import { getSocket } from "../lib/socket";

const TERMINAL = new Set(["COMPLETED", "FAILED", "REJECTED"]);

const STATUS_LABEL = {
  ISSUED: "Menunggu robot",
  ACCEPTED: "Diterima robot",
  IN_PROGRESS: "Sedang inspeksi",
  COMPLETED: "Selesai",
  FAILED: "Gagal",
  REJECTED: "Ditolak robot",
  BUFFERED_OFFLINE: "Tertunda (offline)",
};

function fmtTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("id-ID", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

/**
 * Panel kolaborasi robot: misi inspeksi mutu bibit per tray (kotak).
 *
 * Data: GET /missions/screenhouse/:id (riwayat misi), /inspections/latest (hasil
 * terbaru per tray), /actuations (aktuasi lokal sink node). Realtime: event
 * Socket.IO mission-update / inspection-update / actuation-update.
 */
export default function RobotInspectionPanel({ screenhouseId, headers, readOnly = false }) {
  const [missions, setMissions] = useState([]);
  const [latest, setLatest] = useState([]);
  const [actuations, setActuations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const base = `${API_URL}/missions/screenhouse/${screenhouseId}`;
      const [m, l, a] = await Promise.all([
        fetch(`${base}?limit=5`, { headers }).then((r) => (r.ok ? r.json() : [])),
        fetch(`${base}/inspections/latest`, { headers }).then((r) => (r.ok ? r.json() : [])),
        fetch(`${base}/actuations?limit=5`, { headers }).then((r) => (r.ok ? r.json() : [])),
      ]);
      setMissions(Array.isArray(m) ? m : []);
      setLatest(Array.isArray(l) ? l : []);
      setActuations(Array.isArray(a) ? a : []);
    } finally {
      setLoading(false);
    }
  }, [screenhouseId, headers]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: muat ulang (di-debounce) saat ada peristiwa untuk screenhouse ini.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const handler = (payload) => {
      const sh = payload?.mission?.screenhouse_id ?? payload?.inspection?.screenhouse_id
        ?? payload?.actuation?.screenhouse_id;
      if (sh != null && Number(sh) !== Number(screenhouseId)) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 400);
    };
    const events = ["mission-update", "inspection-update", "actuation-update"];
    events.forEach((e) => socket.on(e, handler));
    return () => {
      events.forEach((e) => socket.off(e, handler));
      clearTimeout(timer.current);
    };
  }, [screenhouseId, load]);

  const active = missions.find((m) => !TERMINAL.has(m.status));

  async function startMission() {
    if (!window.confirm("Kirim robot untuk menginspeksi semua tray sekarang?")) return;
    setStarting(true);
    try {
      const r = await fetch(`${API_URL}/missions/screenhouse/${screenhouseId}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.message || `HTTP ${r.status}`);
      toast.success(`Misi ${body.mission.mission_code} dikirim ke robot`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Bot size={16} className="text-blue-600" /> Inspeksi Mutu Bibit oleh Robot
          </div>
          <div className="text-xs text-gray-600">
            Robot mengelilingi tiap tray, memotret bibit, dan menilai mutunya dengan computer vision.
          </div>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={startMission}
            disabled={starting || Boolean(active)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            <PlayCircle size={14} /> {active ? "Robot sibuk" : starting ? "Mengirim…" : "Mulai inspeksi"}
          </button>
        )}
      </div>

      {active && (
        <div className="mb-3 rounded-xl bg-blue-50 border border-blue-100 p-3">
          <div className="flex justify-between text-xs text-blue-900">
            <span>
              {active.mission_code} · {STATUS_LABEL[active.status] ?? active.status}
              {active.current_tray ? ` · tray ${active.current_tray}` : ""}
            </span>
            <span>{active.battery != null ? `baterai ${active.battery}%` : ""}</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-blue-100 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${Math.max(2, active.progress_pct ?? 0)}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-gray-500">Memuat…</div>
      ) : latest.length === 0 ? (
        <div className="text-xs text-gray-500">Belum ada hasil inspeksi robot.</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {latest.map((t) => {
            const good = t.label === "BAGUS";
            return (
              <div
                key={t.tray_no}
                className={`rounded-xl border p-2.5 ${good ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-800">
                    {t.node_name || `Tray ${t.tray_no}`}
                  </span>
                  {good ? (
                    <CheckCircle2 size={14} className="text-green-600" />
                  ) : (
                    <TriangleAlert size={14} className="text-red-600" />
                  )}
                </div>
                <div className={`text-sm font-bold ${good ? "text-green-700" : "text-red-700"}`}>
                  {good ? "Bagus" : "Tidak bagus"}
                </div>
                <div className="text-[11px] text-gray-600">
                  keyakinan {t.confidence != null ? Math.round(Number(t.confidence) * 100) : "—"}% ·{" "}
                  {fmtTime(t.event_ts)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {missions.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-gray-700 mb-1">Riwayat misi</div>
          <ul className="divide-y divide-gray-100 text-[11px] text-gray-700">
            {missions.map((m) => (
              <li key={m.mission_code} className="py-1 flex justify-between gap-2">
                <span>{m.mission_code}</span>
                <span>
                  {STATUS_LABEL[m.status] ?? m.status} · {m.inspected}/{m.trays?.length ?? 0} tray
                  {m.not_good ? ` · ${m.not_good} bermasalah` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {actuations.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
            <Droplets size={12} /> Aktuasi otomatis sink node
          </div>
          <ul className="text-[11px] text-gray-700">
            {actuations.map((a, i) => (
              <li key={i}>
                {fmtTime(a.event_ts)} · {a.actuator_code} {a.action}
                {a.duration_s ? ` ${a.duration_s} s` : ""} {a.trigger ? `(${a.trigger})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
