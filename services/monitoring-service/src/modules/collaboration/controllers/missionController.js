const pool = require("../../../config/db");
const { COMMAND_QUEUE } = require("../../../config/rabbitmq");
const { sendToQueue, publishEvent } = require("../../../shared/events/eventBus");
const { RK } = require("../../../shared/events/routingKeys");
const { TOPICS, houseCodeOf } = require("../collabTopics");
const { MISSION_COLUMNS, TERMINAL } = require("../collaborationService");

// Misi non-terminal yang lebih tua dari ini dianggap macet dan tidak lagi
// memblokir misi baru (robot bisa saja mati di tengah misi).
const STALE_MIN = Number(process.env.COLLAB_MISSION_STALE_MIN || 60);

/** Petani hanya boleh mengakses screenhouse miliknya; operator/admin semua. */
async function assertAccess(req, res, screenhouseId) {
  const reg = await pool.query(
    `SELECT owner_user_id FROM screenhouse_registry WHERE screenhouse_id = $1`,
    [screenhouseId]
  );
  if (!reg.rows[0]) {
    res.status(404).json({ message: "Screenhouse tidak ditemukan" });
    return false;
  }
  if (req.user?.role === "petani" && Number(reg.rows[0].owner_user_id) !== Number(req.user.id)) {
    res.status(403).json({ message: "Bukan screenhouse Anda" });
    return false;
  }
  return true;
}

function missionCode(now = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `M${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-` +
    `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

// POST /missions/screenhouse/:screenhouseId  { trays?: number[], crit_lvl?: number, force?: bool }
async function createMission(req, res) {
  try {
    const screenhouseId = Number(req.params.screenhouseId);
    if (!(await assertAccess(req, res, screenhouseId))) return;

    const sink = await pool.query(
      `SELECT node_code FROM sink_nodes WHERE screenhouse_id = $1 AND is_active = true LIMIT 1`,
      [screenhouseId]
    );
    if (!sink.rows[0]) return res.status(409).json({ message: "Screenhouse belum punya sink node" });
    const houseCode = houseCodeOf(sink.rows[0].node_code);

    // Ketersediaan robot: satu misi aktif per screenhouse.
    const active = await pool.query(
      `SELECT mission_code, status FROM robot_missions
        WHERE screenhouse_id = $1 AND NOT (status = ANY($2::text[]))
          AND created_at > NOW() - ($3 || ' minutes')::interval
        ORDER BY created_at DESC LIMIT 1`,
      [screenhouseId, [...TERMINAL], String(STALE_MIN)]
    );
    if (active.rows[0] && !req.body?.force) {
      return res.status(409).json({
        message: `Robot sedang menjalankan misi ${active.rows[0].mission_code} (${active.rows[0].status})`,
        mission_code: active.rows[0].mission_code,
      });
    }

    let trays = Array.isArray(req.body?.trays) ? req.body.trays.map(Number).filter((n) => n >= 1) : [];
    if (!trays.length) {
      // Default: semua tray yang punya node WSN "<h_id>-Tnn".
      const nodes = await pool.query(
        `SELECT node_code FROM sensor_nodes WHERE screenhouse_id = $1 AND is_active = true`,
        [screenhouseId]
      );
      trays = nodes.rows
        .map((r) => Number(String(r.node_code).match(/-T(\d+)$/)?.[1]))
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
    }
    if (!trays.length) return res.status(400).json({ message: "Daftar tray kosong" });

    const code = missionCode();
    const critLvl = Number(req.body?.crit_lvl) || 1;
    const ins = await pool.query(
      `INSERT INTO robot_missions (mission_code, screenhouse_id, house_code, cmd, trays, crit_lvl,
                                   status, issued_at, source, requested_by)
       VALUES ($1,$2,$3,'INSPECT',$4,$5,'ISSUED',NOW(),'api',$6)
       RETURNING ${MISSION_COLUMNS}`,
      [code, screenhouseId, houseCode, trays, critLvl, req.user?.id ?? null]
    );
    const mission = ins.rows[0];
    const payload = {
      m_id: code, h_id: houseCode, cmd: "INSPECT", trays, crit_lvl: critLvl, ts: Date.now(),
    };
    // Hanya collector yang memegang MQTT; perintah dititipkan ke q.device.command.
    await sendToQueue(COMMAND_QUEUE, {
      screenhouseId, sinkCode: sink.rows[0].node_code, topics: [TOPICS.command], payload,
    });
    try {
      await publishEvent(RK.MISSION_UPDATED, { mission, user_id: req.user?.id ?? null });
    } catch (_) { /* dashboard akan memuat ulang lewat REST */ }
    return res.status(201).json({ mission, command: payload });
  } catch (err) {
    console.error("[missions] gagal membuat misi:", err.message);
    return res.status(503).json({ message: "Gagal menerbitkan misi", detail: err.message });
  }
}

// GET /missions/screenhouse/:screenhouseId?limit=20
async function listMissions(req, res) {
  try {
    const screenhouseId = Number(req.params.screenhouseId);
    if (!(await assertAccess(req, res, screenhouseId))) return;
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const r = await pool.query(
      `SELECT ${MISSION_COLUMNS},
              (SELECT COUNT(*)::int FROM tray_inspections ti WHERE ti.mission_id = m.id) AS inspected,
              (SELECT COUNT(*)::int FROM tray_inspections ti
                WHERE ti.mission_id = m.id AND ti.label = 'TIDAK_BAGUS') AS not_good
         FROM robot_missions m WHERE screenhouse_id = $1
        ORDER BY created_at DESC LIMIT $2`,
      [screenhouseId, limit]
    );
    return res.json(r.rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// GET /missions/:missionCode
async function getMission(req, res) {
  try {
    const m = await pool.query(
      `SELECT ${MISSION_COLUMNS} FROM robot_missions WHERE mission_code = $1`,
      [req.params.missionCode]
    );
    const mission = m.rows[0];
    if (!mission) return res.status(404).json({ message: "Misi tidak ditemukan" });
    if (mission.screenhouse_id != null && !(await assertAccess(req, res, mission.screenhouse_id))) return;
    const [events, inspections] = await Promise.all([
      pool.query(
        `SELECT status, progress_pct, current_tray, battery, seq, event_ts, received_at
           FROM robot_mission_events WHERE mission_id = $1 ORDER BY seq ASC`,
        [mission.id]
      ),
      pool.query(
        `SELECT tray_no, label, confidence, plant_height_cm, anomaly, seq, event_ts, received_at,
                sensor_node_id
           FROM tray_inspections WHERE mission_id = $1 ORDER BY tray_no ASC`,
        [mission.id]
      ),
    ]);
    return res.json({ ...mission, events: events.rows, inspections: inspections.rows });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// GET /missions/screenhouse/:screenhouseId/inspections/latest — hasil terbaru per tray
async function latestInspections(req, res) {
  try {
    const screenhouseId = Number(req.params.screenhouseId);
    if (!(await assertAccess(req, res, screenhouseId))) return;
    const r = await pool.query(
      `SELECT DISTINCT ON (ti.tray_no)
              ti.tray_no, ti.label, ti.confidence, ti.plant_height_cm, ti.anomaly, ti.event_ts,
              m.mission_code, sn.node_code, sn.node_name
         FROM tray_inspections ti
         JOIN robot_missions m ON m.id = ti.mission_id
         LEFT JOIN sensor_nodes sn ON sn.id = ti.sensor_node_id
        WHERE ti.screenhouse_id = $1
        ORDER BY ti.tray_no, ti.event_ts DESC`,
      [screenhouseId]
    );
    return res.json(r.rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// GET /missions/screenhouse/:screenhouseId/actuations?limit=50
async function listActuations(req, res) {
  try {
    const screenhouseId = Number(req.params.screenhouseId);
    if (!(await assertAccess(req, res, screenhouseId))) return;
    const limit = Math.min(500, Number(req.query.limit) || 50);
    const r = await pool.query(
      `SELECT actuator_code, action, duration_s, trigger, seq, event_ts, received_at
         FROM actuation_events WHERE screenhouse_id = $1 ORDER BY event_ts DESC LIMIT $2`,
      [screenhouseId, limit]
    );
    return res.json(r.rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// POST /missions/:missionCode/cancel — batalkan misi yang belum selesai.
// Ringkasan misi ditandai CANCELLED (terminal, sehingga robot dianggap tersedia lagi)
// dan perintah ABORT diterbitkan ke robot lewat sink node.
async function cancelMission(req, res) {
  try {
    const m = await pool.query(
      `SELECT ${MISSION_COLUMNS} FROM robot_missions WHERE mission_code = $1`,
      [req.params.missionCode]
    );
    const mission = m.rows[0];
    if (!mission) return res.status(404).json({ message: "Misi tidak ditemukan" });
    if (mission.screenhouse_id != null && !(await assertAccess(req, res, mission.screenhouse_id))) return;
    if (TERMINAL.has(mission.status)) {
      return res.status(409).json({ message: `Misi sudah berakhir (${mission.status})` });
    }
    const upd = await pool.query(
      `UPDATE robot_missions SET status = 'CANCELLED', completed_at = NOW(), updated_at = NOW()
        WHERE id = $1 RETURNING ${MISSION_COLUMNS}`,
      [mission.id]
    );
    const payload = { m_id: mission.mission_code, h_id: mission.house_code, cmd: "ABORT",
      trays: [], crit_lvl: mission.crit_lvl ?? 1, ts: Date.now() };
    await sendToQueue(COMMAND_QUEUE, {
      screenhouseId: mission.screenhouse_id, topics: [TOPICS.command], payload,
    });
    try {
      await publishEvent(RK.MISSION_UPDATED, { mission: upd.rows[0], user_id: req.user?.id ?? null });
    } catch (_) { /* dashboard memuat ulang lewat REST */ }
    return res.json({ mission: upd.rows[0], command: payload });
  } catch (err) {
    return res.status(503).json({ message: "Gagal membatalkan misi", detail: err.message });
  }
}

module.exports = {
  createMission, listMissions, getMission, latestInspections, listActuations, cancelMission,
};
