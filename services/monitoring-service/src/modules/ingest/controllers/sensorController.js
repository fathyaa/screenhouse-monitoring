const pool = require("../../../config/db");
const { THRESHOLD_METRICS } = require("../../../shared/thresholdMetrics");

const SENSOR_DATA_JOIN = `
  FROM sensor_data sd
  INNER JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
`;

const LATEST_READING_COLUMNS = `
  nitrogen, phosphorus, potassium,
  soil_temperature, soil_moisture, soil_ph, conductivity,
  air_temperature, air_humidity, light_intensity,
  fan_status, irrigation_status, lamp_status,
  created_at
`;

function buildInsight(latest, threshold) {
  if (!latest || !threshold) {
    return "Belum ada data sensor atau threshold.";
  }

  for (const m of THRESHOLD_METRICS) {
    const value = latest[m.key];
    const min = threshold[m.minCol];
    const max = threshold[m.maxCol];
    if (value == null) continue;
    if (min != null && Number(value) < Number(min)) {
      return `${m.label} rendah — periksa kondisi screenhouse.`;
    }
    if (max != null && Number(value) > Number(max)) {
      return `${m.label} tinggi — perlu tindakan segera.`;
    }
  }

  return "Kondisi screenhouse dalam batas normal.";
}

// Kumpulkan parameter yang keluar dari rentang threshold (untuk chip di popup peta).
function collectAbnormal(latest, threshold) {
  if (!latest || !threshold) return [];

  const abnormal = [];
  for (const m of THRESHOLD_METRICS) {
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

// Ringkasan status seluruh screenhouse untuk pewarnaan marker peta operator.
async function getMapSummary(req, res) {
  try {
    const [registry, latestRows, thresholdRows, alertRows] = await Promise.all([
      pool.query(
        `SELECT screenhouse_id FROM screenhouse_registry WHERE status = 'active'`
      ),
      pool.query(
        `
        SELECT DISTINCT ON (sn.screenhouse_id)
          sn.screenhouse_id,
          sn.node_name,
          sn.send_interval_seconds,
          sd.nitrogen, sd.phosphorus, sd.potassium,
          sd.soil_moisture, sd.soil_temperature, sd.soil_ph, sd.conductivity,
          sd.air_temperature, sd.air_humidity, sd.light_intensity,
          sd.created_at
        ${SENSOR_DATA_JOIN}
        ORDER BY sn.screenhouse_id, sd.created_at DESC
        `
      ),
      pool.query(`SELECT * FROM threshold_snapshots`),
      pool.query(
        `
        SELECT screenhouse_id, COUNT(*)::int AS active_alerts
        FROM alerts
        WHERE status = 'active'
        GROUP BY screenhouse_id
        `
      ),
    ]);

    const latestById = new Map(
      latestRows.rows.map((r) => [r.screenhouse_id, r])
    );
    const thresholdById = new Map(
      thresholdRows.rows.map((r) => [r.screenhouse_id, r])
    );
    const alertsById = new Map(
      alertRows.rows.map((r) => [r.screenhouse_id, r.active_alerts])
    );

    const now = Date.now();

    const summary = registry.rows.map(({ screenhouse_id }) => {
      const latest = latestById.get(screenhouse_id) ?? null;
      const threshold = thresholdById.get(screenhouse_id) ?? null;
      const activeAlerts = alertsById.get(screenhouse_id) ?? 0;

      const lastSeen = latest?.created_at ?? null;
      const intervalSec = Number(latest?.send_interval_seconds) || 60;
      // Anggap offline jika data lebih lama dari 3x interval kirim (min. 15 menit).
      const staleMs = Math.max(intervalSec * 3, 900) * 1000;
      const ageMs = lastSeen ? now - new Date(lastSeen).getTime() : Infinity;
      const isOffline = !lastSeen || ageMs > staleMs;

      const abnormal = collectAbnormal(latest, threshold);

      let status;
      let insight;
      if (isOffline) {
        status = "offline";
        insight = lastSeen
          ? "Perangkat tidak mengirim data terbaru."
          : "Belum ada data sensor dari perangkat.";
      } else if (activeAlerts > 0) {
        status = "critical";
        insight = buildInsight(latest, threshold);
      } else if (abnormal.length > 0) {
        status = "warning";
        insight = buildInsight(latest, threshold);
      } else {
        status = "healthy";
        insight = threshold
          ? "Kondisi screenhouse dalam batas normal."
          : "Online — threshold belum diatur.";
      }

      return {
        screenhouse_id,
        status,
        insight,
        last_seen: lastSeen,
        node_name: latest?.node_name ?? null,
        active_alerts: activeAlerts,
        abnormal,
        has_threshold: threshold != null,
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
    const result = await pool.query(
      `
        SELECT DISTINCT ON (sn.screenhouse_id)
          sd.*,
          sn.screenhouse_id,
          sn.id AS sensor_node_id,
          sn.node_code,
          sn.node_name
        ${SENSOR_DATA_JOIN}
        ORDER BY sn.screenhouse_id, sd.created_at DESC
        `
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
          fan_status: row.fan_status,
          irrigation_status: row.irrigation_status,
          lamp_status: row.lamp_status,
          created_at: row.last_reading_at,
        }
      : null,
  };
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
          latest.fan_status,
          latest.irrigation_status,
          latest.lamp_status,
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

async function getScreenhouseDashboardSummary(req, res) {
  try {
    const { screenhouseId } = req.params;

    const [latest, sensorNodes, hourlyTrend, threshold] = await Promise.all([
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
            latest.fan_status,
            latest.irrigation_status,
            latest.lamp_status,
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
    ]);

    const latestRow = latest.rows[0] ?? null;
    const thresholdRow = threshold.rows[0] ?? null;
    const nodes = sensorNodes.rows;

    res.json({
      latest: latestRow,
      sensorNodes: nodes,
      sensors: nodes,
      hourlyTrend: hourlyTrend.rows,
      threshold: thresholdRow,
      insight: buildInsight(latestRow, thresholdRow),
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
};
