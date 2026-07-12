const OFFLINE_ALERT_MESSAGE_SUFFIX = "tidak mengirim data sensor terbaru";

function buildOfflineAlertMessage(nodeName) {
  const label = String(nodeName ?? "").trim() || "Rak bibit";
  return `${label} ${OFFLINE_ALERT_MESSAGE_SUFFIX}`;
}

function isOfflineAlertMessage(message) {
  return String(message ?? "").toLowerCase().includes("tidak mengirim data sensor");
}

/** Satu alert offline aktif per node — perbarui pesan setelah rename, tutup duplikat. */
async function consolidateOfflineAlerts(pool, { screenhouseId, sensorNodeId, message }) {
  const result = await pool.query(
    `
    SELECT id, message
    FROM alerts
    WHERE screenhouse_id = $1
      AND sensor_node_id = $2
      AND status = 'active'
      AND message ILIKE $3
    ORDER BY created_at DESC
    `,
    [screenhouseId, sensorNodeId, `%${OFFLINE_ALERT_MESSAGE_SUFFIX}%`]
  );

  if (!result.rows.length) return { keptId: null, resolvedIds: [] };

  const [keep, ...dupes] = result.rows;
  const resolvedIds = dupes.map((row) => row.id);

  if (resolvedIds.length) {
    await pool.query(
      `
      UPDATE alerts
      SET status = 'resolved', resolved_at = NOW()
      WHERE id = ANY($1::int[])
      `,
      [resolvedIds]
    );
  }

  if (keep.message !== message) {
    await pool.query(`UPDATE alerts SET message = $1 WHERE id = $2`, [message, keep.id]);
  }

  return { keptId: keep.id, resolvedIds };
}

/** Bersihkan duplikat offline aktif di seluruh database (mis. setelah rename rak). */
async function consolidateAllOfflineDuplicates(pool) {
  const result = await pool.query(
    `
    WITH ranked AS (
      SELECT
        id,
        screenhouse_id,
        sensor_node_id,
        ROW_NUMBER() OVER (
          PARTITION BY screenhouse_id, sensor_node_id
          ORDER BY created_at DESC
        ) AS rn
      FROM alerts
      WHERE status = 'active'
        AND sensor_node_id IS NOT NULL
        AND message ILIKE $1
    ),
    dupes AS (
      SELECT id FROM ranked WHERE rn > 1
    ),
  resolved AS (
      UPDATE alerts
      SET status = 'resolved', resolved_at = NOW()
      WHERE id IN (SELECT id FROM dupes)
      RETURNING id
    )
    SELECT COUNT(*)::int AS resolved_count FROM resolved
    `,
    [`%${OFFLINE_ALERT_MESSAGE_SUFFIX}%`]
  );

  const resolvedCount = result.rows[0]?.resolved_count ?? 0;

  const nodes = await pool.query(
    `
    SELECT DISTINCT a.screenhouse_id, a.sensor_node_id, sn.node_name
    FROM alerts a
    INNER JOIN sensor_nodes sn ON sn.id = a.sensor_node_id
    WHERE a.status = 'active'
      AND a.message ILIKE $1
    `,
    [`%${OFFLINE_ALERT_MESSAGE_SUFFIX}%`]
  );

  for (const row of nodes.rows) {
    await consolidateOfflineAlerts(pool, {
      screenhouseId: row.screenhouse_id,
      sensorNodeId: row.sensor_node_id,
      message: buildOfflineAlertMessage(row.node_name),
    });
  }

  return resolvedCount;
}

module.exports = {
  OFFLINE_ALERT_MESSAGE_SUFFIX,
  buildOfflineAlertMessage,
  isOfflineAlertMessage,
  consolidateOfflineAlerts,
  consolidateAllOfflineDuplicates,
};
