const pool = require("../../../config/db");

async function getOperatorStats(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        (SELECT COUNT(*)::int
           FROM screenhouse_registry
           WHERE status = 'active') AS screenhouse_count,
        (SELECT COUNT(*)::int
           FROM sensor_nodes
           WHERE is_active = true) AS device_count
      `
    );

    const row = result.rows[0] || {};
    res.json({
      screenhouse_count: row.screenhouse_count ?? 0,
      device_count: row.device_count ?? 0,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getOwnerStats(req, res) {
  try {
    const ownerId = Number(req.params.ownerId);
    if (!Number.isInteger(ownerId)) {
      return res.status(400).json({ message: "ownerId tidak valid" });
    }

    const result = await pool.query(
      `
      SELECT
        (SELECT COUNT(*)::int
           FROM screenhouse_registry
           WHERE owner_user_id = $1) AS screenhouse_count,
        (SELECT COUNT(*)::int
           FROM sensor_nodes sn
           JOIN screenhouse_registry r ON r.screenhouse_id = sn.screenhouse_id
           WHERE r.owner_user_id = $1
             AND sn.is_active = true) AS active_nodes,
        (SELECT COUNT(DISTINCT sn.id)::int
           FROM sensor_nodes sn
           JOIN screenhouse_registry r ON r.screenhouse_id = sn.screenhouse_id
           WHERE r.owner_user_id = $1
             AND sn.is_active = true
             AND EXISTS (
               SELECT 1 FROM sensor_data sd
               WHERE sd.sensor_node_id = sn.id
                 AND sd.created_at >= NOW() - INTERVAL '24 hours'
             )) AS active_sensors,
        (SELECT COUNT(*)::int
           FROM alerts a
           JOIN screenhouse_registry r ON r.screenhouse_id = a.screenhouse_id
           WHERE r.owner_user_id = $1
             AND a.status = 'active') AS active_alerts
      `,
      [ownerId]
    );

    const row = result.rows[0] || {};
    res.json({
      screenhouse_count: row.screenhouse_count ?? 0,
      active_nodes: row.active_nodes ?? 0,
      active_sensors: row.active_sensors ?? 0,
      active_alerts: row.active_alerts ?? 0,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getNodeCounts(req, res) {
  try {
    const idsParam = (req.query.screenhouseIds || "").trim();
    const ids = idsParam
      ? idsParam
          .split(",")
          .map((v) => Number(v.trim()))
          .filter((v) => Number.isInteger(v))
      : null;

    const result = ids
      ? await pool.query(
          `
          SELECT screenhouse_id, COUNT(*)::int AS node_count
          FROM sensor_nodes
          WHERE screenhouse_id = ANY($1::int[])
          GROUP BY screenhouse_id
          `,
          [ids]
        )
      : await pool.query(
          `
          SELECT screenhouse_id, COUNT(*)::int AS node_count
          FROM sensor_nodes
          GROUP BY screenhouse_id
          `
        );

    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getOperatorStats,
  getOwnerStats,
  getNodeCounts,
};
