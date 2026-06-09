const pool = require("../../../config/db");
const monitoringPool = require("../../../config/monitoringDb");
const { monitoringGet } = require("../../../shared/monitoringClient");

const PARAM_LABELS = [
  { key: "nitrogen", label: "Nitrogen" },
  { key: "phosphorus", label: "Phosphorus" },
  { key: "potassium", label: "Potassium" },
  { key: "soil_moisture", label: "Kelembapan tanah" },
  { key: "soil_temperature", label: "Suhu tanah" },
  { key: "soil_ph", label: "pH tanah" },
  { key: "conductivity", label: "Konduktivitas" },
  { key: "air_temperature", label: "Suhu udara" },
  { key: "air_humidity", label: "Kelembapan udara" },
  { key: "light_intensity", label: "Intensitas cahaya" },
];

const GROUP_BY_COLUMNS = {
  regency: { id: "regency_id", name: "regency" },
  district: { id: "district_id", name: "district" },
  village: { id: "village_id", name: "village" },
};

function paramFromMessage(message) {
  if (!message) return { key: "other", label: "Lainnya" };
  const match = PARAM_LABELS.find((p) => message.includes(p.label));
  return match ?? { key: "other", label: "Lainnya" };
}

function parseDays(raw) {
  const days = Number(raw);
  if ([1, 7, 30].includes(days)) return days;
  return 7;
}

function parseGroupBy(raw) {
  if (raw && GROUP_BY_COLUMNS[raw]) return raw;
  return "district";
}

async function fetchScreenhouses(filters) {
  const conditions = ["s.status = 'active'"];
  const params = [];

  for (const [col, val] of [
    ["s.province_id", filters.province_id],
    ["s.regency_id", filters.regency_id],
    ["s.district_id", filters.district_id],
    ["s.village_id", filters.village_id],
  ]) {
    const num = Number(val);
    if (Number.isInteger(num)) {
      params.push(num);
      conditions.push(`${col} = $${params.length}`);
    }
  }

  const result = await pool.query(
    `
    SELECT
      s.id,
      s.name,
      s.province_id,
      s.regency_id,
      s.district_id,
      s.village_id,
      s.created_at,
      p.name AS province,
      r.name AS regency,
      d.name AS district,
      v.name AS village
    FROM screenhouses s
    JOIN provinces p ON s.province_id = p.id
    JOIN regencies r ON s.regency_id = r.id
    JOIN districts d ON s.district_id = d.id
    JOIN villages v ON s.village_id = v.id
    WHERE ${conditions.join(" AND ")}
    ORDER BY s.id
    `,
    params
  );

  return result.rows;
}

async function fetchMapSummary() {
  const data = await monitoringGet("/sensor-data/map-summary", []);
  return Object.fromEntries(
    (Array.isArray(data) ? data : []).map((item) => [item.screenhouse_id, item])
  );
}

async function fetchMonitoringStats(screenhouseIds, days) {
  if (!screenhouseIds.length) {
    return {
      alertTrend: [],
      alertTrendPrev: [],
      topParams: [],
      sensorAvgs: {},
      uptimeIds: new Set(),
      actuator: {},
    };
  }

  if (!monitoringPool) {
    return {
      alertTrend: [],
      alertTrendPrev: [],
      topParams: [],
      sensorAvgs: {},
      uptimeIds: new Set(),
      actuator: {},
    };
  }

  const [
    alertTrendRes,
    alertTrendPrevRes,
    topParamsRes,
    sensorAvgRes,
    uptimeRes,
    actuatorRes,
  ] = await Promise.all([
    monitoringPool.query(
      `
      SELECT DATE(created_at AT TIME ZONE 'Asia/Jakarta') AS date, COUNT(*)::int AS count
      FROM alerts
      WHERE screenhouse_id = ANY($1::int[])
        AND created_at >= NOW() - ($2::int * INTERVAL '1 day')
      GROUP BY 1
      ORDER BY 1
      `,
      [screenhouseIds, days]
    ),
    monitoringPool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM alerts
      WHERE screenhouse_id = ANY($1::int[])
        AND created_at >= NOW() - ($2::int * 2 * INTERVAL '1 day')
        AND created_at < NOW() - ($2::int * INTERVAL '1 day')
      `,
      [screenhouseIds, days]
    ),
    monitoringPool.query(
      `
      SELECT message, COUNT(*)::int AS count
      FROM alerts
      WHERE screenhouse_id = ANY($1::int[])
        AND created_at >= NOW() - ($2::int * INTERVAL '1 day')
      GROUP BY message
      ORDER BY count DESC
      LIMIT 20
      `,
      [screenhouseIds, days]
    ),
    monitoringPool.query(
      `
      SELECT
        sn.screenhouse_id,
        AVG(sd.nitrogen)::numeric(10,2) AS nitrogen,
        AVG(sd.phosphorus)::numeric(10,2) AS phosphorus,
        AVG(sd.potassium)::numeric(10,2) AS potassium,
        AVG(sd.soil_moisture)::numeric(10,2) AS soil_moisture,
        AVG(sd.soil_temperature)::numeric(10,2) AS soil_temperature,
        AVG(sd.soil_ph)::numeric(4,2) AS soil_ph,
        AVG(sd.air_temperature)::numeric(10,2) AS air_temperature,
        AVG(sd.air_humidity)::numeric(10,2) AS air_humidity
      FROM sensor_data sd
      JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
      WHERE sn.screenhouse_id = ANY($1::int[])
        AND sd.created_at >= NOW() - ($2::int * INTERVAL '1 day')
      GROUP BY sn.screenhouse_id
      `,
      [screenhouseIds, days]
    ),
    monitoringPool.query(
      `
      SELECT DISTINCT sn.screenhouse_id
      FROM sensor_data sd
      JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
      WHERE sn.screenhouse_id = ANY($1::int[])
        AND sd.created_at >= NOW() - INTERVAL '24 hours'
      `,
      [screenhouseIds]
    ),
    monitoringPool.query(
      `
      SELECT
        sn.screenhouse_id,
        COUNT(*) FILTER (WHERE sd.irrigation_status = true)::int AS irrigation_on,
        COUNT(*) FILTER (WHERE sd.fan_status = true)::int AS fan_on,
        COUNT(*) FILTER (WHERE sd.lamp_status = true)::int AS lamp_on,
        COUNT(*)::int AS total_readings
      FROM sensor_data sd
      JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
      WHERE sn.screenhouse_id = ANY($1::int[])
        AND sd.created_at >= NOW() - ($2::int * INTERVAL '1 day')
      GROUP BY sn.screenhouse_id
      `,
      [screenhouseIds, days]
    ),
  ]);

  const sensorAvgs = Object.fromEntries(
    sensorAvgRes.rows.map((row) => [row.screenhouse_id, row])
  );

  const actuator = Object.fromEntries(
    actuatorRes.rows.map((row) => [row.screenhouse_id, row])
  );

  return {
    alertTrend: alertTrendRes.rows.map((r) => ({
      date: r.date,
      count: r.count,
    })),
    alertTrendPrev: alertTrendPrevRes.rows[0]?.count ?? 0,
    topParams: topParamsRes.rows,
    sensorAvgs,
    uptimeIds: new Set(uptimeRes.rows.map((r) => r.screenhouse_id)),
    actuator,
  };
}

async function fetchGrowthStats(days) {
  const [screenhousesRes, farmersRes] = await Promise.all([
    pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM screenhouses
      WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
      `,
      [days]
    ),
    pool.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
      FROM users
      WHERE role = 'petani'
        AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
      `,
      [days]
    ),
  ]);

  return {
    new_screenhouses: screenhousesRes.rows[0]?.count ?? 0,
    farmers_approved: farmersRes.rows[0]?.approved ?? 0,
    farmers_pending: farmersRes.rows[0]?.pending ?? 0,
    farmers_rejected: farmersRes.rows[0]?.rejected ?? 0,
  };
}

function avgNumeric(values) {
  const nums = values.filter((v) => v != null && !Number.isNaN(Number(v))).map(Number);
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, c) => a + c, 0) / nums.length) * 100) / 100;
}

function buildRegionRows(screenhouses, mapSummary, groupBy, monitoringStats) {
  const col = GROUP_BY_COLUMNS[groupBy];
  const groups = new Map();

  for (const sh of screenhouses) {
    const regionId = sh[col.id];
    const regionName = sh[col.name];
    if (!groups.has(regionId)) {
      groups.set(regionId, {
        region_id: regionId,
        region_name: regionName,
        province: sh.province,
        regency: sh.regency,
        screenhouse_ids: [],
        total: 0,
        healthy: 0,
        warning: 0,
        critical: 0,
        offline: 0,
        active_alerts: 0,
        online_count: 0,
      });
    }

    const group = groups.get(regionId);
    group.screenhouse_ids.push(sh.id);
    group.total += 1;

    const summary = mapSummary[sh.id];
    const status = summary?.status ?? "offline";
    group[status] = (group[status] ?? 0) + 1;
    group.active_alerts += summary?.active_alerts ?? 0;

    if (monitoringStats.uptimeIds.has(sh.id)) {
      group.online_count += 1;
    }
  }

  const sensorKeys = [
    "nitrogen", "phosphorus", "potassium",
    "soil_moisture", "soil_temperature", "soil_ph",
    "air_temperature", "air_humidity",
  ];

  return [...groups.values()]
    .map((group) => {
      const sensorRows = group.screenhouse_ids
        .map((id) => monitoringStats.sensorAvgs[id])
        .filter(Boolean);

      const sensor_avg = {};
      sensorKeys.forEach((key) => {
        sensor_avg[key] = avgNumeric(sensorRows.map((r) => r[key]));
      });

      let irrigation_on = 0;
      let fan_on = 0;
      let lamp_on = 0;
      let total_readings = 0;
      group.screenhouse_ids.forEach((id) => {
        const act = monitoringStats.actuator[id];
        if (!act) return;
        irrigation_on += act.irrigation_on ?? 0;
        fan_on += act.fan_on ?? 0;
        lamp_on += act.lamp_on ?? 0;
        total_readings += act.total_readings ?? 0;
      });

      const uptime_pct =
        group.total > 0
          ? Math.round((group.online_count / group.total) * 1000) / 10
          : 0;

      return {
        region_id: group.region_id,
        region_name: group.region_name,
        province: group.province,
        regency: group.regency,
        total: group.total,
        healthy: group.healthy,
        warning: group.warning,
        critical: group.critical,
        offline: group.offline,
        active_alerts: group.active_alerts,
        uptime_pct,
        sensor_avg,
        actuator: {
          irrigation_on,
          fan_on,
          lamp_on,
          total_readings,
        },
      };
    })
    .sort((a, b) => b.total - a.total || a.region_name.localeCompare(b.region_name, "id"));
}

async function getOperatorReports(req, res) {
  try {
    const days = parseDays(req.query.days);
    const groupBy = parseGroupBy(req.query.group_by);
    const filters = {
      province_id: req.query.province_id,
      regency_id: req.query.regency_id,
      district_id: req.query.district_id,
      village_id: req.query.village_id,
    };

    const [screenhouses, mapSummary, growth] = await Promise.all([
      fetchScreenhouses(filters),
      fetchMapSummary(),
      fetchGrowthStats(days),
    ]);

    const screenhouseIds = screenhouses.map((sh) => sh.id);
    const monitoringStats = await fetchMonitoringStats(screenhouseIds, days);
    const regions = buildRegionRows(screenhouses, mapSummary, groupBy, monitoringStats);

    const statusTotals = { healthy: 0, warning: 0, critical: 0, offline: 0 };
    let activeAlerts = 0;
    let onlineCount = 0;

    for (const sh of screenhouses) {
      const summary = mapSummary[sh.id];
      const status = summary?.status ?? "offline";
      statusTotals[status] = (statusTotals[status] ?? 0) + 1;
      activeAlerts += summary?.active_alerts ?? 0;
      if (monitoringStats.uptimeIds.has(sh.id)) onlineCount += 1;
    }

    const alertCountCurrent = monitoringStats.alertTrend.reduce(
      (sum, row) => sum + row.count,
      0
    );

    const topParamsMap = new Map();
    for (const row of monitoringStats.topParams) {
      const param = paramFromMessage(row.message);
      const prev = topParamsMap.get(param.key) ?? { key: param.key, label: param.label, count: 0 };
      prev.count += row.count;
      topParamsMap.set(param.key, prev);
    }

    const top_alert_params = [...topParamsMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    res.json({
      generated_at: new Date().toISOString(),
      period_days: days,
      group_by: groupBy,
      filters,
      kpis: {
        total_screenhouses: screenhouses.length,
        uptime_pct:
          screenhouses.length > 0
            ? Math.round((onlineCount / screenhouses.length) * 1000) / 10
            : 0,
        active_alerts: activeAlerts,
        offline_count: statusTotals.offline ?? 0,
        alert_count_period: alertCountCurrent,
      },
      status_totals: statusTotals,
      regions,
      alert_trend: monitoringStats.alertTrend,
      top_alert_params,
      growth,
      period_comparison: {
        alerts_current: alertCountCurrent,
        alerts_previous: monitoringStats.alertTrendPrev,
        alerts_delta: alertCountCurrent - monitoringStats.alertTrendPrev,
      },
    });
  } catch (err) {
    console.error("[operator-reports]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = { getOperatorReports };
