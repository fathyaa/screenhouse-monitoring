const pool = require("../../../config/db");

const DEFAULT_ALERT_LIMIT = 500;
const MAX_ALERT_LIMIT = 1000;

function parseAlertListQuery(query) {
  const rawLimit = Number.parseInt(query.limit, 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_ALERT_LIMIT)
    : DEFAULT_ALERT_LIMIT;

  const status = typeof query.status === "string" ? query.status.trim().toLowerCase() : "all";
  const allowedStatus = new Set(["all", "active", "resolved"]);
  const normalizedStatus = allowedStatus.has(status) ? status : "all";

  return { limit, status: normalizedStatus };
}

async function getAlerts(req, res) {
  try {
    const { limit, status } = parseAlertListQuery(req.query);
    const params = [req.user.id];
    let statusClause = "";

    if (status === "active") {
      statusClause = "AND a.status = 'active'";
    } else if (status === "resolved") {
      statusClause = "AND a.status = 'resolved'";
    }

    params.push(limit);

    const [result, countsResult] = await Promise.all([
      pool.query(
        `
        SELECT
          a.id,
          a.screenhouse_id,
          a.sensor_node_id,
          a.message,
          a.status,
          a.created_at,
          a.resolved_at,
          a.resolve_note,
          a.sensor_data_id,

          sd.nitrogen AS actual_nitrogen,
          sd.phosphorus AS actual_phosphorus,
          sd.potassium AS actual_potassium,
          sd.soil_moisture AS actual_soil_moisture,
          sd.soil_temperature AS actual_soil_temperature,
          sd.soil_ph AS actual_soil_ph,
          sd.conductivity AS actual_conductivity,
          sd.air_temperature AS actual_air_temperature,
          sd.air_humidity AS actual_air_humidity,
          sd.light_intensity AS actual_light_intensity,

          sn.node_name AS sensor_node_name,
          sn.node_code,

          t.min_nitrogen, t.max_nitrogen,
          t.min_phosphorus, t.max_phosphorus,
          t.min_potassium, t.max_potassium,
          t.min_soil_moisture, t.max_soil_moisture,
          t.min_soil_temperature, t.max_soil_temperature,
          t.min_soil_ph, t.max_soil_ph,
          t.min_conductivity, t.max_conductivity,
          t.min_air_temperature, t.max_air_temperature,
          t.min_air_humidity, t.max_air_humidity,
          t.min_light_intensity, t.max_light_intensity,

          sr.screenhouse_name

        FROM alerts a
        INNER JOIN screenhouse_registry sr ON sr.screenhouse_id = a.screenhouse_id
        LEFT JOIN sensor_data sd ON sd.id = a.sensor_data_id
        LEFT JOIN sensor_nodes sn ON sn.id = a.sensor_node_id
        LEFT JOIN threshold_snapshots t ON t.screenhouse_id = a.screenhouse_id
        WHERE sr.owner_user_id = $1
        ${statusClause}
        ORDER BY a.created_at DESC
        LIMIT $2
        `,
        params
      ),
      pool.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE a.status = 'active')::int AS active,
          COUNT(*) FILTER (WHERE a.status = 'resolved')::int AS resolved
        FROM alerts a
        INNER JOIN screenhouse_registry sr ON sr.screenhouse_id = a.screenhouse_id
        WHERE sr.owner_user_id = $1
        `,
        [req.user.id]
      ),
    ]);

    const counts = countsResult.rows[0] ?? { active: 0, resolved: 0 };

    res.json({
      items: result.rows,
      counts: {
        active: counts.active ?? 0,
        resolved: counts.resolved ?? 0,
        total: (counts.active ?? 0) + (counts.resolved ?? 0),
      },
      limit,
      status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function resolveAlert(req, res) {
  try {
    const { id } = req.params;
    const resolveNote =
      typeof req.body?.resolve_note === "string"
        ? req.body.resolve_note.trim().slice(0, 255) || null
        : null;

    const result = await pool.query(
      `
      UPDATE alerts a
      SET status = 'resolved',
          resolved_at = CURRENT_TIMESTAMP,
          resolve_note = COALESCE($3, a.resolve_note)
      FROM screenhouse_registry sr
      WHERE a.id = $1
        AND a.screenhouse_id = sr.screenhouse_id
        AND sr.owner_user_id = $2
      RETURNING a.*
      `,
      [id, req.user.id, resolveNote]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Alert tidak ditemukan" });
    }

    res.json({
      message: "Alert resolved",
      alert: result.rows[0],
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getAlerts,
  resolveAlert,
};
