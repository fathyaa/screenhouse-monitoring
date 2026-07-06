const pool = require("../../../config/db");
const { HEALTH_STATUS_METRICS } = require("../../../shared/thresholdMetrics");
const { computeScreenhouseStressScore } = require("../../../shared/stressScore");
const { deriveScreenhouseStatus } = require("../../../shared/screenhouseStatus");

const SENSOR_DATA_JOIN = `
  FROM sensor_data sd
  INNER JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
`;

const LATEST_READING_COLUMNS = `
  nitrogen, phosphorus, potassium,
  soil_temperature, soil_moisture, soil_ph, conductivity,
  air_temperature, air_humidity, light_intensity,
  created_at
`;

function buildInsight(latest, threshold) {
  if (!latest || !threshold) {
    return "Belum ada data sensor atau threshold.";
  }

  for (const m of HEALTH_STATUS_METRICS) {
    const value = latest[m.key];
    const min = threshold[m.minCol];
    const max = threshold[m.maxCol];
    if (value == null) continue;
    if (min != null && Number(value) < Number(min)) {
      return `${m.label} rendah, periksa kondisi screenhouse.`;
    }
    if (max != null && Number(value) > Number(max)) {
      return `${m.label} tinggi, perlu tindakan segera.`;
    }
  }

  return "Kondisi screenhouse dalam batas normal.";
}

// Kumpulkan parameter yang keluar dari rentang threshold (untuk chip di popup peta).
function collectAbnormal(latest, threshold) {
  if (!latest || !threshold) return [];

  const abnormal = [];
  for (const m of HEALTH_STATUS_METRICS) {
    const value = latest[m.key];
    const min = threshold[m.minCol];
    const max = threshold[m.maxCol];
    if (value == null) continue;
    if (min != null && Number(value) < Number(min)) {
      abnormal.push({ key: m.key, label: m.label, value, min, max, direction: "low" });
    } else if (max != null && Number(value) > Number(max)) {
      abnormal.push({ key: m.key, label: m.label, value, min, max, direction: "high" });
    }
  }
  return abnormal;
}

// Gabungkan abnormal dari semua node (dedupe per key, ambil yang paling parah).
function collectAbnormalAllNodes(nodeRows, threshold) {
  if (!threshold || !nodeRows?.length) return [];

  const byKey = new Map();
  for (const row of nodeRows) {
    for (const item of collectAbnormal(row, threshold)) {
      const prev = byKey.get(item.key);
      if (!prev) {
        byKey.set(item.key, item);
        continue;
      }
      const prevDist =
        prev.direction === "high"
          ? Number(prev.value) - Number(prev.max)
          : Number(prev.min) - Number(prev.value);
      const nextDist =
        item.direction === "high"
          ? Number(item.value) - Number(item.max)
          : Number(item.min) - Number(item.value);
      if (nextDist > prevDist) byKey.set(item.key, item);
    }
  }
  return [...byKey.values()];
}

function pickLatestNodeRow(nodeRows) {
  if (!nodeRows?.length) return null;
  return nodeRows.reduce((best, row) => {
    if (!best) return row;
    return new Date(row.created_at) > new Date(best.created_at) ? row : best;
  }, null);
}

function isScreenhouseOfflineFromNodes(nodeRows, now = Date.now()) {
  const activeNodes = (nodeRows || []).filter((n) => n.is_active !== false);
  if (activeNodes.length === 0) return true;

  return activeNodes.every((node) => {
    const lastSeen = node.last_reading_at ?? node.created_at;
    if (!lastSeen) return true;
    const intervalSec = Math.max(Number(node.send_interval_seconds) || 60, 60);
    const staleMs = Math.max(intervalSec * 3, 900) * 1000;
    const ageMs = now - new Date(lastSeen).getTime();
    return Number.isNaN(ageMs) || ageMs > staleMs;
  });
}

function buildOfflineInsight(nodeRows) {
  const timestamps = (nodeRows || [])
    .map((n) => n.last_reading_at ?? n.created_at)
    .filter(Boolean)
    .map((d) => new Date(d).getTime())
    .filter((t) => !Number.isNaN(t));
  return timestamps.length
    ? "Perangkat tidak mengirim data terbaru."
    : "Belum ada data sensor dari perangkat.";
}

// Ringkasan status seluruh screenhouse untuk pewarnaan marker peta operator.
async function getMapSummary(req, res) {
  try {
    const [registry, latestRows, thresholdRows, alertRows] = await Promise.all([
      pool.query(
        `SELECT screenhouse_id FROM screenhouse_registry WHERE status = 'active'`
      ),
      pool.query(
        `
        SELECT
          sn.screenhouse_id,
          sn.id AS sensor_node_id,
          sn.node_name,
          sn.send_interval_seconds,
          latest.nitrogen, latest.phosphorus, latest.potassium,
          latest.soil_moisture, latest.soil_temperature, latest.soil_ph, latest.conductivity,
          latest.air_temperature, latest.air_humidity, latest.light_intensity,
          latest.created_at
        FROM sensor_nodes sn
        INNER JOIN screenhouse_registry sr
          ON sr.screenhouse_id = sn.screenhouse_id AND sr.status = 'active'
        LEFT JOIN LATERAL (
          SELECT
            nitrogen, phosphorus, potassium,
            soil_moisture, soil_temperature, soil_ph, conductivity,
            air_temperature, air_humidity, light_intensity,
            created_at
          FROM sensor_data sd
          WHERE sd.sensor_node_id = sn.id
          ORDER BY sd.created_at DESC
          LIMIT 1
        ) latest ON true
        WHERE sn.is_active = true
        `
      ),
      pool.query(`SELECT * FROM threshold_snapshots`),
      pool.query(
        `
        SELECT screenhouse_id, message
        FROM alerts
        WHERE status = 'active'
        `
      ),
    ]);

    const nodesByScreenhouse = new Map();
    for (const row of latestRows.rows) {
      const list = nodesByScreenhouse.get(row.screenhouse_id) ?? [];
      list.push(row);
      nodesByScreenhouse.set(row.screenhouse_id, list);
    }

    const thresholdById = new Map(
      thresholdRows.rows.map((r) => [r.screenhouse_id, r])
    );
    const alertsByScreenhouse = new Map();
    for (const row of alertRows.rows) {
      const list = alertsByScreenhouse.get(row.screenhouse_id) ?? [];
      list.push(row);
      alertsByScreenhouse.set(row.screenhouse_id, list);
    }

    const now = Date.now();

    const summary = registry.rows.map(({ screenhouse_id }) => {
      const nodeRows = nodesByScreenhouse.get(screenhouse_id) ?? [];
      const latest = pickLatestNodeRow(nodeRows);
      const threshold = thresholdById.get(screenhouse_id) ?? null;
      const activeAlertRows = alertsByScreenhouse.get(screenhouse_id) ?? [];
      const activeAlerts = activeAlertRows.length;

      const lastSeen = latest?.created_at ?? null;
      const intervalSec = Math.max(
        ...nodeRows.map((n) => Number(n.send_interval_seconds) || 60),
        60
      );
      const staleMs = Math.max(intervalSec * 3, 900) * 1000;
      const ageMs = lastSeen ? now - new Date(lastSeen).getTime() : Infinity;
      const isOffline = !lastSeen || ageMs > staleMs;

      const abnormal = collectAbnormalAllNodes(nodeRows, threshold);
      const insightSource =
        abnormal.length > 0
          ? nodeRows.find((row) => collectAbnormal(row, threshold).length > 0) ?? latest
          : latest;

      let status;
      let insight;
      if (isOffline) {
        status = "offline";
        insight = lastSeen
          ? "Perangkat tidak mengirim data terbaru."
          : "Belum ada data sensor dari perangkat.";
      } else {
        status = deriveScreenhouseStatus({
          abnormalCount: abnormal.length,
          activeAlertCount: activeAlerts,
        });
        if (activeAlerts === 1 && abnormal.length === 0) {
          insight = "Sensor sudah normal; masih ada 1 alert aktif.";
        } else if (abnormal.length > 0) {
          insight = buildInsight(insightSource, threshold);
        } else {
          insight = threshold
            ? "Kondisi screenhouse dalam batas normal."
            : "Online, threshold belum diatur.";
        }
      }

      const nodeNames = [...new Set(nodeRows.map((n) => n.node_name).filter(Boolean))];

      return {
        screenhouse_id,
        status,
        insight,
        last_seen: lastSeen,
        node_name: nodeNames.length ? nodeNames.join(", ") : null,
        active_alerts: activeAlerts,
        abnormal,
        has_threshold: threshold != null,
        alerts_pending_review: activeAlerts > 0 && abnormal.length === 0,
      };
    });

    res.json(summary);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getSensorData(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        sd.*,
        sn.screenhouse_id,
        sn.node_code,
        sn.node_name,
        sn.location AS node_location
      ${SENSOR_DATA_JOIN}
      ORDER BY sd.created_at DESC
      LIMIT 50
    `);

    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getLatestSensorData(req, res) {
  try {
    const { screenhouseId } = req.params;

    const result = await pool.query(
      `
        SELECT
          sd.*,
          sn.screenhouse_id,
          sn.id AS sensor_node_id,
          sn.node_code,
          sn.node_name
        ${SENSOR_DATA_JOIN}
        WHERE sn.screenhouse_id = $1
        ORDER BY sd.created_at DESC
        LIMIT 1
        `,
      [screenhouseId]
    );

    res.json(result.rows[0] ?? null);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getLatestAllSensorData(req, res) {
  try {
    const ownerUserId = req.user?.id;
    if (!ownerUserId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const result = await pool.query(
      `
        SELECT
          pick.data_id AS id,
          pick.nitrogen,
          pick.phosphorus,
          pick.potassium,
          pick.soil_temperature,
          pick.soil_moisture,
          pick.soil_ph,
          pick.conductivity,
          pick.air_temperature,
          pick.air_humidity,
          pick.light_intensity,
          pick.created_at,
          sr.screenhouse_id,
          pick.sensor_node_id,
          pick.node_code,
          pick.node_name,
          sk.id AS sink_node_id,
          sk.node_code AS sink_node_code,
          sk.fan_status,
          sk.irrigation_status,
          sk.lamp_status,
          ts.min_nitrogen,
          ts.max_nitrogen,
          ts.min_phosphorus,
          ts.max_phosphorus,
          ts.min_potassium,
          ts.max_potassium,
          ts.min_soil_moisture,
          ts.max_soil_moisture,
          ts.min_soil_temperature,
          ts.max_soil_temperature,
          ts.min_soil_ph,
          ts.max_soil_ph,
          ts.min_air_temperature,
          ts.max_air_temperature,
          ts.min_air_humidity,
          ts.max_air_humidity
        FROM screenhouse_registry sr
        JOIN LATERAL (
          SELECT
            sd.id AS data_id,
            sd.nitrogen,
            sd.phosphorus,
            sd.potassium,
            sd.soil_temperature,
            sd.soil_moisture,
            sd.soil_ph,
            sd.conductivity,
            sd.air_temperature,
            sd.air_humidity,
            sd.light_intensity,
            sd.created_at,
            sn.id AS sensor_node_id,
            sn.node_code,
            sn.node_name
          FROM sensor_nodes sn
          LEFT JOIN LATERAL (
            SELECT *
            FROM sensor_data sd2
            WHERE sd2.sensor_node_id = sn.id
            ORDER BY sd2.created_at DESC
            LIMIT 1
          ) sd ON true
          WHERE sn.screenhouse_id = sr.screenhouse_id
            AND sn.is_active = true
            AND sd.id IS NOT NULL
          ORDER BY sd.created_at DESC NULLS LAST
          LIMIT 1
        ) pick ON true
        LEFT JOIN sink_nodes sk
          ON sk.screenhouse_id = sr.screenhouse_id AND sk.is_active = true
        LEFT JOIN threshold_snapshots ts ON ts.screenhouse_id = sr.screenhouse_id
        WHERE sr.owner_user_id = $1
        ORDER BY sr.screenhouse_id
        `,
      [ownerUserId]
    );

    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

function mapSensorNodeRow(row) {
  const hasReading = row.last_reading_at != null;

  return {
    id: row.id,
    node_code: row.node_code,
    node_name: row.node_name,
    location: row.location,
    send_interval_seconds: row.send_interval_seconds,
    is_active: row.is_active,
    created_at: row.created_at,
    status: row.is_active ? "active" : "inactive",
    last_seen: row.last_reading_at,
    latest_data: hasReading
      ? {
          nitrogen: row.nitrogen,
          phosphorus: row.phosphorus,
          potassium: row.potassium,
          soil_temperature: row.soil_temperature,
          soil_moisture: row.soil_moisture,
          soil_ph: row.soil_ph,
          conductivity: row.conductivity,
          air_temperature: row.air_temperature,
          air_humidity: row.air_humidity,
          light_intensity: row.light_intensity,
          created_at: row.last_reading_at,
        }
      : null,
  };
}

async function getSinkNodeByScreenhouse(req, res) {
  try {
    const { screenhouseId } = req.params;
    const result = await pool.query(
      `
      SELECT id, screenhouse_id, node_code, node_name, relay_channels,
             fan_status, irrigation_status, lamp_status, is_active, updated_at
      FROM sink_nodes
      WHERE screenhouse_id = $1
      LIMIT 1
      `,
      [screenhouseId]
    );
    res.json(result.rows[0] ?? null);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getSensorNodesByScreenhouse(req, res) {
  try {
    const { screenhouseId } = req.params;

    const result = await pool.query(
      `
        SELECT
          sn.id,
          sn.node_code,
          sn.node_name,
          sn.location,
          sn.send_interval_seconds,
          sn.is_active,
          sn.created_at,
          latest.nitrogen,
          latest.phosphorus,
          latest.potassium,
          latest.soil_moisture,
          latest.soil_temperature,
          latest.soil_ph,
          latest.conductivity,
          latest.air_temperature,
          latest.air_humidity,
          latest.light_intensity,
          latest.created_at AS last_reading_at
        FROM sensor_nodes sn
        LEFT JOIN LATERAL (
          SELECT ${LATEST_READING_COLUMNS}
          FROM sensor_data sd
          WHERE sd.sensor_node_id = sn.id
          ORDER BY sd.created_at DESC
          LIMIT 1
        ) latest ON true
        WHERE sn.screenhouse_id = $1
        ORDER BY sn.id
        `,
      [screenhouseId]
    );

    res.json(result.rows.map(mapSensorNodeRow));
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getScreenhouseSensorHistory(req, res) {
  try {
    const { screenhouseId } = req.params;
    const hours = Math.min(
      Math.max(parseInt(req.query.hours, 10) || 24, 1),
      168
    );

    const result = await pool.query(
      `
        SELECT
          sd.id,
          sd.sensor_node_id,
          sn.node_name AS sensor_name,
          sn.node_code,
          sd.nitrogen,
          sd.phosphorus,
          sd.potassium,
          sd.soil_moisture,
          sd.soil_temperature,
          sd.soil_ph,
          sd.air_temperature,
          sd.air_humidity,
          sd.created_at
        ${SENSOR_DATA_JOIN}
        WHERE sn.screenhouse_id = $1
          AND sd.created_at >= NOW() - ($2::text || ' hours')::interval
        ORDER BY sd.created_at ASC
        `,
      [screenhouseId, String(hours)]
    );

    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

function nodeIsOffline(node, now = Date.now()) {
  if (node.is_active === false) return true;
  const lastSeen = node.last_reading_at ?? node.created_at;
  if (!lastSeen) return true;
  const intervalSec = Math.max(Number(node.send_interval_seconds) || 60, 60);
  const staleMs = Math.max(intervalSec * 3, 900) * 1000;
  const ageMs = now - new Date(lastSeen).getTime();
  return Number.isNaN(ageMs) || ageMs > staleMs;
}

async function getScreenhouseStressScore(req, res) {
  try {
    const { screenhouseId } = req.params;

    const [nodeRes, thresholdRes] = await Promise.all([
      pool.query(
        `
          SELECT
            sn.id AS node_id,
            sn.node_code,
            sn.node_name,
            sn.is_active,
            sn.send_interval_seconds,
            latest.nitrogen,
            latest.phosphorus,
            latest.potassium,
            latest.soil_moisture,
            latest.soil_temperature,
            latest.soil_ph,
            latest.created_at AS last_reading_at
          FROM sensor_nodes sn
          LEFT JOIN LATERAL (
            SELECT ${LATEST_READING_COLUMNS}
            FROM sensor_data sd
            WHERE sd.sensor_node_id = sn.id
            ORDER BY sd.created_at DESC
            LIMIT 1
          ) latest ON true
          WHERE sn.screenhouse_id = $1
          ORDER BY sn.id
        `,
        [screenhouseId]
      ),
      pool.query(`SELECT * FROM threshold_snapshots WHERE screenhouse_id = $1`, [
        screenhouseId,
      ]),
    ]);

    const threshold = thresholdRes.rows[0] ?? null;
    const now = Date.now();
    const nodeReadings = nodeRes.rows.map((row) => ({
      node_id: row.node_id,
      node_code: row.node_code,
      node_name: row.node_name,
      nitrogen: row.nitrogen,
      phosphorus: row.phosphorus,
      potassium: row.potassium,
      soil_moisture: row.soil_moisture,
      soil_temperature: row.soil_temperature,
      soil_ph: row.soil_ph,
      offline: nodeIsOffline(row, now),
    }));

    const offline = isScreenhouseOfflineFromNodes(
      nodeRes.rows.map((r) => ({
        ...r,
        created_at: r.last_reading_at,
      })),
      now
    );

    const result = computeScreenhouseStressScore(nodeReadings, threshold, { offline });
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getScreenhouseDashboardSummary(req, res) {
  try {
    const { screenhouseId } = req.params;

    const [latest, sensorNodes, hourlyTrend, threshold, sinkNode] = await Promise.all([
      pool.query(
        `
          SELECT sd.*, sn.screenhouse_id, sn.node_name, sn.node_code
          ${SENSOR_DATA_JOIN}
          WHERE sn.screenhouse_id = $1
          ORDER BY sd.created_at DESC
          LIMIT 1
          `,
        [screenhouseId]
      ),
      pool.query(
        `
          SELECT
            sn.id,
            sn.node_code,
            sn.node_name,
            sn.location,
            sn.is_active,
            sn.send_interval_seconds,
            CASE WHEN sn.is_active THEN 'active' ELSE 'inactive' END AS status,
            latest.nitrogen,
            latest.phosphorus,
            latest.potassium,
            latest.soil_moisture,
            latest.soil_temperature,
            latest.soil_ph,
            latest.air_temperature,
            latest.air_humidity,
            latest.light_intensity,
            latest.created_at AS last_reading_at
          FROM sensor_nodes sn
          LEFT JOIN LATERAL (
            SELECT ${LATEST_READING_COLUMNS}
            FROM sensor_data sd
            WHERE sd.sensor_node_id = sn.id
            ORDER BY sd.created_at DESC
            LIMIT 1
          ) latest ON true
          WHERE sn.screenhouse_id = $1
          ORDER BY sn.id
          `,
        [screenhouseId]
      ),
      pool.query(
        `
          SELECT
            date_trunc('hour', sd.created_at) AS bucket,
            ROUND(AVG(sd.nitrogen))::int AS avg_nitrogen,
            ROUND(AVG(sd.soil_moisture))::numeric(5,2) AS avg_soil_moisture,
            ROUND(AVG(sd.phosphorus))::int AS avg_phosphorus,
            ROUND(AVG(sd.potassium))::int AS avg_potassium,
            ROUND(AVG(sd.air_temperature)::numeric, 1) AS avg_air_temperature
          ${SENSOR_DATA_JOIN}
          WHERE sn.screenhouse_id = $1
            AND sd.created_at >= NOW() - INTERVAL '24 hours'
          GROUP BY 1
          ORDER BY 1
          `,
        [screenhouseId]
      ),
      pool.query(`SELECT * FROM threshold_snapshots WHERE screenhouse_id = $1`, [
        screenhouseId,
      ]),
      pool.query(
        `
        SELECT id, screenhouse_id, node_code, node_name, relay_channels,
               fan_status, irrigation_status, lamp_status, is_active, updated_at
        FROM sink_nodes
        WHERE screenhouse_id = $1
        LIMIT 1
        `,
        [screenhouseId]
      ),
    ]);

    const latestRow = latest.rows[0] ?? null;
    const thresholdRow = threshold.rows[0] ?? null;
    const nodes = sensorNodes.rows;

    const nodeReadings = nodes
      .filter((n) => n.last_reading_at)
      .map((n) => ({ ...n, created_at: n.last_reading_at }));
    const abnormal = collectAbnormalAllNodes(nodeReadings, thresholdRow);
    const insightSource =
      abnormal.length > 0
        ? nodeReadings.find((row) => collectAbnormal(row, thresholdRow).length > 0) ??
          latestRow
        : nodeReadings[0] ?? latestRow;

    const insight = isScreenhouseOfflineFromNodes(nodes)
      ? buildOfflineInsight(nodes)
      : buildInsight(insightSource, thresholdRow);

    res.json({
      latest: latestRow,
      sensorNodes: nodes,
      sensors: nodes,
      sinkNode: sinkNode.rows[0] ?? null,
      hourlyTrend: hourlyTrend.rows,
      threshold: thresholdRow,
      insight,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getLatestSensorData,
  getSensorData,
  getMapSummary,
  getLatestAllSensorData,
  getSensorsByScreenhouse: getSensorNodesByScreenhouse,
  getSensorNodesByScreenhouse,
  getScreenhouseSensorHistory,
  getScreenhouseDashboardSummary,
  getScreenhouseStressScore,
  getSinkNodeByScreenhouse,
};
