const pool = require("../../config/db");
const { publishEvent } = require("../../shared/events/eventBus");
const { RK } = require("../../shared/events/routingKeys");
const { sinkCodeOf, toIsoOrNull, num, idempKey } = require("./collabTopics");

/**
 * Collaboration Service — bounded context kolaborasi robot (proposal tesis, X3).
 *
 * Menyimpan siklus hidup misi robot dan hasil penilaian mutu bibit per tray yang
 * datang lewat sink node, lalu menerbitkan peristiwa untuk dashboard realtime.
 *
 * Jaminan:
 *  - Idempoten: setiap pesan punya idemp_key UNIQUE; replay store-and-forward dari
 *    sink node (atau requeue RabbitMQ) tidak menambah baris (ON CONFLICT DO NOTHING).
 *  - Tahan urutan acak: ringkasan misi hanya diperbarui oleh status ber-seq lebih
 *    besar dari yang sudah tercatat; status terminal tidak ditimpa status lama.
 *  - Status bisa tiba sebelum command (mis. command diterbitkan pihak lain dan
 *    terlewat): baris misi dibuat minimal lalu dilengkapi saat command terlihat.
 */

const TERMINAL = new Set(["COMPLETED", "FAILED", "REJECTED", "CANCELLED"]);
const VALID_STATUS = new Set(["ACCEPTED", "IN_PROGRESS", "COMPLETED", "FAILED", "REJECTED",
  "BUFFERED_OFFLINE", "CANCELLED"]);
const VALID_LABEL = new Set(["BAGUS", "TIDAK_BAGUS"]);

const cache = { sink: new Map(), owner: new Map() };
const TTL = Number(process.env.COLLAB_LOOKUP_TTL_MS || 60000);

async function cached(map, key, fn) {
  const hit = map.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const v = await fn();
  map.set(key, { v, t: Date.now() });
  return v;
}

/** h_id → { screenhouse_id, sink_node_id } lewat kode sink "<h_id>-SINK". */
function resolveHouse(houseCode) {
  if (!houseCode) return Promise.resolve(null);
  return cached(cache.sink, houseCode, async () => {
    const r = await pool.query(
      `SELECT id AS sink_node_id, screenhouse_id FROM sink_nodes WHERE node_code = $1`,
      [sinkCodeOf(houseCode)]
    );
    return r.rows[0] ?? null;
  });
}

function ownerOf(screenhouseId) {
  if (screenhouseId == null) return Promise.resolve(null);
  return cached(cache.owner, String(screenhouseId), async () => {
    const r = await pool.query(
      `SELECT owner_user_id FROM screenhouse_registry WHERE screenhouse_id = $1`,
      [screenhouseId]
    );
    return r.rows[0]?.owner_user_id ?? null;
  });
}

async function emit(routingKey, payload) {
  try {
    await publishEvent(routingKey, payload);
  } catch (err) {
    // Baris sudah commit; event yang hilang hanya membuat dashboard telat.
    console.error(`[collaboration] publish ${routingKey} gagal:`, err.message);
  }
}

function invalid(kind, why, msg) {
  console.warn(`[collaboration] ${kind} diabaikan (${why}):`, JSON.stringify(msg).slice(0, 200));
  return { ok: false, reason: why };
}

const MISSION_COLUMNS = `id, mission_code, screenhouse_id, house_code, robot_code, cmd, trays,
  crit_lvl, source, status, progress_pct, current_tray, battery, last_seq,
  issued_at, accepted_at, completed_at, last_event_at, created_at, updated_at`;

/** Pastikan baris misi ada; kembalikan id-nya. */
async function ensureMission(missionCode, defaults = {}) {
  const r = await pool.query(
    `INSERT INTO robot_missions (mission_code, screenhouse_id, house_code, robot_code, source)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (mission_code) DO UPDATE
       SET screenhouse_id = COALESCE(robot_missions.screenhouse_id, EXCLUDED.screenhouse_id),
           house_code     = COALESCE(robot_missions.house_code, EXCLUDED.house_code),
           robot_code     = COALESCE(EXCLUDED.robot_code, robot_missions.robot_code)
     RETURNING id, screenhouse_id, house_code`,
    [missionCode, defaults.screenhouseId ?? null, defaults.houseCode ?? null,
      defaults.robotCode ?? null, defaults.source ?? "mqtt"]
  );
  return r.rows[0];
}

// --- mission/command --------------------------------------------------------
async function handleCommand(msg) {
  if (!msg?.m_id || !msg?.h_id) return invalid("command", "m_id/h_id kosong", msg);
  if (String(msg.cmd).toUpperCase() === "ABORT") {
    // Pembatalan (dari API /cancel atau pihak lain): misi non-terminal → CANCELLED.
    const r = await pool.query(
      `UPDATE robot_missions SET status = 'CANCELLED', completed_at = COALESCE(completed_at, NOW()),
              updated_at = NOW()
        WHERE mission_code = $1 AND NOT (status = ANY($2::text[]))
        RETURNING ${MISSION_COLUMNS}`,
      [msg.m_id, [...TERMINAL]]
    );
    if (r.rows[0]) {
      await emit(RK.MISSION_UPDATED, { mission: r.rows[0], user_id: await ownerOf(r.rows[0].screenhouse_id) });
    }
    return { ok: true, cancelled: Boolean(r.rows[0]) };
  }
  const house = await resolveHouse(msg.h_id);
  const trays = Array.isArray(msg.trays) ? msg.trays.map(Number).filter(Number.isFinite) : [];
  const r = await pool.query(
    `INSERT INTO robot_missions
       (mission_code, screenhouse_id, house_code, cmd, trays, crit_lvl, status, issued_at, source)
     VALUES ($1, $2, $3, $4, $5, $6, 'ISSUED', COALESCE($7::timestamptz, NOW()), 'mqtt')
     ON CONFLICT (mission_code) DO UPDATE SET
       screenhouse_id = COALESCE(robot_missions.screenhouse_id, EXCLUDED.screenhouse_id),
       house_code     = COALESCE(robot_missions.house_code, EXCLUDED.house_code),
       cmd            = EXCLUDED.cmd,
       trays          = CASE WHEN cardinality(robot_missions.trays) = 0
                             THEN EXCLUDED.trays ELSE robot_missions.trays END,
       crit_lvl       = EXCLUDED.crit_lvl,
       issued_at      = COALESCE(robot_missions.issued_at, EXCLUDED.issued_at),
       updated_at     = NOW()
     RETURNING ${MISSION_COLUMNS}`,
    [msg.m_id, house?.screenhouse_id ?? null, msg.h_id, msg.cmd || "INSPECT", trays,
      num(msg.crit_lvl) ?? 1, toIsoOrNull(msg.ts)]
  );
  const mission = r.rows[0];
  await emit(RK.MISSION_UPDATED, { mission, user_id: await ownerOf(mission.screenhouse_id) });
  return { ok: true, mission };
}

// --- mission/status ---------------------------------------------------------
async function handleStatus(msg) {
  if (!msg?.m_id || !msg?.st || msg.seq == null) return invalid("status", "m_id/st/seq kosong", msg);
  if (!VALID_STATUS.has(msg.st)) return invalid("status", `st tidak dikenal: ${msg.st}`, msg);
  const m = await ensureMission(msg.m_id, { robotCode: msg.r_id });
  const eventTs = toIsoOrNull(msg.ts);
  const ins = await pool.query(
    `INSERT INTO robot_mission_events
       (mission_id, idemp_key, status, progress_pct, current_tray, battery, seq, event_ts)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, NOW()))
     ON CONFLICT (idemp_key) DO NOTHING
     RETURNING id`,
    [m.id, idempKey.status(msg), msg.st, num(msg.pct), num(msg.cur_tray), num(msg.bat),
      num(msg.seq), eventTs]
  );
  if (!ins.rows[0]) return { ok: true, duplicate: true };

  // Ringkasan hanya maju: seq lebih besar, dan status terminal tidak dibatalkan
  // oleh status non-terminal yang tiba terlambat (replay).
  const upd = await pool.query(
    `UPDATE robot_missions SET
        status        = $2,
        progress_pct  = $3,
        current_tray  = COALESCE($4, current_tray),
        battery       = COALESCE($5, battery),
        robot_code    = COALESCE($6, robot_code),
        last_seq      = $7,
        last_event_at = COALESCE($8::timestamptz, NOW()),
        accepted_at   = CASE WHEN $2 = 'ACCEPTED' THEN COALESCE(accepted_at, $8::timestamptz, NOW())
                             ELSE accepted_at END,
        completed_at  = CASE WHEN $2 = ANY($9::text[]) THEN COALESCE($8::timestamptz, NOW())
                             ELSE completed_at END,
        updated_at    = NOW()
      WHERE id = $1
        AND (last_seq IS NULL OR last_seq < $7)
        AND NOT (status = ANY($9::text[]) AND NOT ($2 = ANY($9::text[])))
        AND status <> 'CANCELLED'
      RETURNING ${MISSION_COLUMNS}`,
    [m.id, msg.st, num(msg.pct), num(msg.cur_tray), num(msg.bat), msg.r_id ?? null,
      num(msg.seq), eventTs, [...TERMINAL]]
  );
  const mission = upd.rows[0];
  if (mission) {
    await emit(RK.MISSION_UPDATED, { mission, user_id: await ownerOf(mission.screenhouse_id) });
  }
  return { ok: true, mission: mission ?? null, stale: !mission };
}

// --- mission/result ---------------------------------------------------------
async function handleResult(msg) {
  if (!msg?.m_id || msg.tray_id == null || msg.seq == null) {
    return invalid("result", "m_id/tray_id/seq kosong", msg);
  }
  if (!VALID_LABEL.has(msg.label)) return invalid("result", `label tidak dikenal: ${msg.label}`, msg);
  const house = await resolveHouse(msg.h_id);
  const m = await ensureMission(msg.m_id, {
    screenhouseId: house?.screenhouse_id, houseCode: msg.h_id,
  });
  const screenhouseId = m.screenhouse_id ?? house?.screenhouse_id ?? null;
  const trayNo = Number(msg.tray_id);
  // Tray n ↔ sensor node "<h_id>-Tnn" (konvensi kode node repo).
  const node = msg.h_id
    ? await pool.query(`SELECT id FROM sensor_nodes WHERE node_code = $1`,
      [`${msg.h_id}-T${String(trayNo).padStart(2, "0")}`])
    : { rows: [] };
  const ins = await pool.query(
    `INSERT INTO tray_inspections
       (mission_id, screenhouse_id, sensor_node_id, tray_no, label, confidence,
        plant_height_cm, anomaly, seq, idemp_key, event_ts)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, COALESCE($11::timestamptz, NOW()))
     ON CONFLICT (idemp_key) DO NOTHING
     RETURNING *`,
    [m.id, screenhouseId, node.rows[0]?.id ?? null, trayNo, msg.label, num(msg.conf),
      num(msg.h_cm), num(msg.anom) ?? 0, num(msg.seq), idempKey.result(msg), toIsoOrNull(msg.ts)]
  );
  const inspection = ins.rows[0];
  if (!inspection) return { ok: true, duplicate: true };
  await emit(RK.INSPECTION_RECORDED, {
    inspection: { ...inspection, mission_code: msg.m_id },
    user_id: await ownerOf(screenhouseId),
  });
  return { ok: true, inspection };
}

// --- actuator/control -------------------------------------------------------
async function handleActuator(msg) {
  if (!msg?.h_id || !msg?.act_id || msg.seq == null) {
    return invalid("actuator", "h_id/act_id/seq kosong", msg);
  }
  const house = await resolveHouse(msg.h_id);
  const ins = await pool.query(
    `INSERT INTO actuation_events
       (screenhouse_id, house_code, actuator_code, action, duration_s, trigger, seq, idemp_key, event_ts)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, COALESCE($9::timestamptz, NOW()))
     ON CONFLICT (idemp_key) DO NOTHING
     RETURNING *`,
    [house?.screenhouse_id ?? null, msg.h_id, msg.act_id, String(msg.action || "").toUpperCase(),
      num(msg.dur_s), msg.trig ?? null, num(msg.seq), idempKey.actuator(msg), toIsoOrNull(msg.ts)]
  );
  const actuation = ins.rows[0];
  if (!actuation) return { ok: true, duplicate: true };
  await emit(RK.ACTUATION_RECORDED, { actuation, user_id: await ownerOf(actuation.screenhouse_id) });
  return { ok: true, actuation };
}

const HANDLERS = {
  command: handleCommand,
  status: handleStatus,
  result: handleResult,
  actuator: handleActuator,
};

/** Satu tugas dari q.collab: { kind, payload, topic, receivedAt }. */
async function processCollabJob(job) {
  const fn = HANDLERS[job?.kind];
  if (!fn) return invalid("job", `jenis tidak dikenal: ${job?.kind}`, job);
  return fn(job.payload);
}

module.exports = {
  processCollabJob,
  handleCommand,
  handleStatus,
  handleResult,
  handleActuator,
  resolveHouse,
  ownerOf,
  MISSION_COLUMNS,
  TERMINAL,
};
