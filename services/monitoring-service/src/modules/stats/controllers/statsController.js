const pool = require("../../../config/db");
const { resetIngestMetrics } = require("../../ingest/ingestMetrics");
const { aggregateSnapshot, broadcastReset } = require("../../../shared/metricsAggregator");
const { MIN_STALE_SECONDS } = require("../../../shared/nodeLiveness");

// Sink dianggap online bila ada tray aktif yang masih kirim telemetri
// (interval × 3, dengan lantai dari shared/nodeLiveness — selaras map-summary
// & alert worker).
const ONLINE_SINK_EXISTS = `
  EXISTS (
    SELECT 1
    FROM sensor_nodes sn
    INNER JOIN sensor_data sd ON sd.sensor_node_id = sn.id
    WHERE sn.screenhouse_id = sk.screenhouse_id
      AND sn.is_active = true
      AND sd.created_at >= NOW() - (
        GREATEST(GREATEST(COALESCE(sn.send_interval_seconds, 60), 60) * 3, ${MIN_STALE_SECONDS})
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
                   GREATEST(GREATEST(COALESCE(sn.send_interval_seconds, 60), 60) * 3, ${MIN_STALE_SECONDS})
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

/**
 * Kedalaman antrean per queue — satu-satunya ukuran throughput yang masih benar
 * setelah arsitektur dipecah.
 *
 * PENTING untuk pengujian beban: counter di ingestMetrics sekarang bersifat
 * PER PROSES. Endpoint ini dilayani role `api`, yang tidak mengonsumsi satu pun
 * pesan sensor, jadi angka mqttProcessed di sini akan nol — itu benar, bukan
 * bug. Ukuran agregat lintas replica harus diambil dari RabbitMQ (queue depth di
 * bawah, atau HTTP management API di :15672 untuk laju publish/ack).
 */
async function getQueueDepths() {
  const { getChannel, INGEST_QUEUE, COMMAND_QUEUE, DEAD_QUEUE } = require("../../../config/rabbitmq");
  const names = {
    ingest: INGEST_QUEUE,
    command: COMMAND_QUEUE,
    dead: DEAD_QUEUE,
    persist: process.env.QUEUE_PERSIST || "q.persist",
    alert: process.env.QUEUE_ALERT || "q.alert",
    notif: process.env.QUEUE_NOTIF || "q.notif",
  };

  const depths = {};
  for (const [label, queue] of Object.entries(names)) {
    try {
      const ch = await getChannel();
      // assertQueue, BUKAN checkQueue. checkQueue pada queue yang belum ada
      // membalas 404 dan AMQP menutup channel-nya — karena channel itu di-cache
      // dan dipakai bersama, satu queue yang belum terbentuk akan mematikan
      // seluruh pembacaan berikutnya. assertQueue idempoten untuk queue durable
      // biasa: cocok kalau sudah ada, dibuat kosong kalau belum.
      const info = await ch.assertQueue(queue, { durable: true });
      depths[label] = info.messageCount;
    } catch (err) {
      console.warn(`[stats] gagal membaca queue ${queue}:`, err.message);
      depths[label] = null;
    }
  }
  return depths;
}

/**
 * Bentuk respons SENGAJA identik dengan arsitektur lama (mqttReceived,
 * mqttProcessed, latency, memory.rssMb, queueDepth, timeSeries) supaya harness
 * uji beban bisa mengukur kedua arsitektur dengan kode yang sama — syarat mutlak
 * agar hasilnya bisa dibandingkan.
 *
 * Bedanya cuma sumber angkanya: dulu dari state proses ini sendiri, sekarang
 * dijumlahkan dari laporan seluruh role lewat `metrics.report`.
 */
async function getIngestStats(req, res) {
  try {
    const queues = await getQueueDepths();
    // Antrean yang menahan pekerjaan sebelum baris masuk DB. Kalau salah satu
    // masih berisi, run belum tuntas — inilah yang dipantau harness saat
    // menunggu drain.
    const queueDepth =
      queues.ingest == null && queues.persist == null
        ? null
        : (queues.ingest ?? 0) + (queues.persist ?? 0);

    const agg = aggregateSnapshot(queueDepth);
    const elapsedSec = Math.max((Date.now() - agg.startedAt) / 1000, 0.001);
    const t = agg.totals;
    const successCount = t.mqttProcessed;
    // Requeue tidak dihitung error: pesannya masih di antrean dan akan diproses
    // lagi begitu infrastruktur pulih.
    const errorCount = t.mqttFailed + t.mqttDeadLettered;
    const totalHandled = successCount + errorCount;

    res.json({
      ingestMode: "listener",
      role: process.env.ROLE || "api",
      runId: agg.runId,
      uptimeSec: elapsedSec,
      mqttReceived: t.mqttReceived,
      mqttProcessed: successCount,
      mqttEnqueued: t.mqttEnqueued,
      mqttFailed: t.mqttFailed,
      mqttNacked: t.mqttDeadLettered,
      mqttDeadLettered: t.mqttDeadLettered,
      mqttRequeued: t.mqttRequeued,
      successRatePct: totalHandled ? (successCount / totalHandled) * 100 : null,
      errorRatePct: totalHandled ? (errorCount / totalHandled) * 100 : null,
      receiveRatePerSec: t.mqttReceived / elapsedSec,
      processRatePerSec: successCount / elapsedSec,
      latency: agg.latency,
      timeSeries: agg.timeSeries,
      memory: { rssMb: agg.rssMb, heapUsedMb: agg.heapUsedMb },
      queueDepth,
      queues,
      // Khusus arsitektur baru — memungkinkan laporan memecah kontribusi
      // per role dan mencatat berapa replica yang benar-benar hidup.
      topology: { instanceCount: agg.instanceCount, roles: agg.roles },
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
    // Reset harus sampai ke SEMUA proses, bukan cuma yang melayani request ini.
    // Kalau tidak, run berikutnya mewarisi counter run sebelumnya dari role
    // collector/persistence dan delivery rate-nya jadi >100%.
    await broadcastReset(runId);
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
