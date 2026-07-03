const pool = require("../../../config/db");
const { isRabbitMqEnabled } = require("../../../config/rabbitmq");
const {
  getIngestMetricsSnapshot,
  resetIngestMetrics,
  appendTimeSeriesSample,
} = require("../../ingest/ingestMetrics");

// Sink dianggap online bila ada tray aktif yang masih kirim telemetri
// (interval × 3, minimal 15 menit — selaras map-summary & alert worker).
const ONLINE_SINK_EXISTS = `
  EXISTS (
    SELECT 1
    FROM sensor_nodes sn
    INNER JOIN sensor_data sd ON sd.sensor_node_id = sn.id
    WHERE sn.screenhouse_id = sk.screenhouse_id
      AND sn.is_active = true
      AND sd.created_at >= NOW() - (
        GREATEST(GREATEST(COALESCE(sn.send_interval_seconds, 60), 60) * 3, 900)
        || ' seconds'
      )::interval
  )
`;

async function getOperatorStats(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        (SELECT COUNT(*)::int
           FROM screenhouse_registry
           WHERE status = 'active') AS screenhouse_count,
        (SELECT COUNT(*)::int
           FROM sink_nodes
           WHERE is_active = true
             AND node_code NOT LIKE 'LT-%') AS sink_node_count,
        (SELECT COUNT(*)::int
           FROM sink_nodes sk
           INNER JOIN screenhouse_registry sr
             ON sr.screenhouse_id = sk.screenhouse_id AND sr.status = 'active'
           WHERE sk.is_active = true
             AND sk.node_code NOT LIKE 'LT-%'
             AND ${ONLINE_SINK_EXISTS}) AS online_sink_node_count
      `
    );

    const row = result.rows[0] || {};
    res.json({
      screenhouse_count: row.screenhouse_count ?? 0,
      sink_node_count: row.sink_node_count ?? 0,
      online_sink_node_count: row.online_sink_node_count ?? 0,
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
           WHERE owner_user_id = $1
             AND status = 'active') AS screenhouse_count,
        (SELECT COUNT(*)::int
           FROM sensor_nodes sn
           JOIN screenhouse_registry r ON r.screenhouse_id = sn.screenhouse_id
           WHERE r.owner_user_id = $1
             AND r.status = 'active'
             AND sn.is_active = true) AS active_nodes,
        (SELECT COUNT(*)::int
           FROM sensor_nodes sn
           JOIN screenhouse_registry r ON r.screenhouse_id = sn.screenhouse_id
           WHERE r.owner_user_id = $1
             AND r.status = 'active'
             AND sn.is_active = true
             AND EXISTS (
               SELECT 1
               FROM sensor_data sd
               WHERE sd.sensor_node_id = sn.id
                 AND sd.created_at >= NOW() - (
                   GREATEST(GREATEST(COALESCE(sn.send_interval_seconds, 60), 60) * 3, 900)
                   || ' seconds'
                 )::interval
             )) AS online_nodes,
        (SELECT COUNT(*)::int
           FROM alerts a
           JOIN screenhouse_registry r ON r.screenhouse_id = a.screenhouse_id
           WHERE r.owner_user_id = $1
             AND a.status = 'active') AS active_alerts
      `,
      [ownerId]
    );

    const row = result.rows[0] || {};
    const activeNodes = row.active_nodes ?? 0;
    const onlineNodes = row.online_nodes ?? 0;
    res.json({
      screenhouse_count: row.screenhouse_count ?? 0,
      active_nodes: activeNodes,
      online_nodes: onlineNodes,
      offline_nodes: Math.max(activeNodes - onlineNodes, 0),
      /** @deprecated gunakan online_nodes — dipertahankan sementara untuk kompatibilitas */
      active_sensors: onlineNodes,
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

async function getIngestStats(req, res) {
  try {
    let queueDepth = null;
    if (isRabbitMqEnabled()) {
      try {
        const { getChannel, QUEUE_NAME } = require("../../../config/rabbitmq");
        const ch = await getChannel();
        const q = await ch.checkQueue(QUEUE_NAME);
        queueDepth = q.messageCount;
      } catch {
        queueDepth = null;
      }
    }

    appendTimeSeriesSample({ queueDepth });
    res.json({
      ingestMode: isRabbitMqEnabled() ? "rabbitmq" : "direct",
      ...getIngestMetricsSnapshot(),
      queueDepth,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function resetIngestStats(req, res) {
  try {
    const runId = req.body?.runId ?? req.query?.runId ?? null;
    resetIngestMetrics(runId);
    res.json({ ok: true, runId });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getOperatorStats,
  getOwnerStats,
  getNodeCounts,
  getIngestStats,
  resetIngestStats,
};
