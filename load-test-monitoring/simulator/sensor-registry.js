/**
 * Database-backed sensor registry for load testing.
 *
 * Sensors are never generated here. The simulator only uses active
 * sensor_nodes that already exist in PostgreSQL and belong to non-ignored
 * application users.
 */

import pg from "pg";

const IGNORED_PHONE_NUMBERS = ["081111111111", "081300000047"];

function monitoringDbConfig(env) {
  return {
    host: env.DB_HOST || "localhost",
    port: Number(env.DB_PORT || 5433),
    user: env.DB_USER || "postgres",
    password: env.DB_PASSWORD || "postgres",
    database: env.DB_NAME || "screenhouse_monitoring",
    max: 4,
  };
}

function appDbConfig(env) {
  return {
    host: env.DB_APP_HOST || env.APP_DB_HOST || "localhost",
    port: Number(env.DB_APP_PORT || env.APP_DB_PORT || 5434),
    user: env.DB_APP_USER || env.APP_DB_USER || env.DB_USER || "postgres",
    password: env.DB_APP_PASSWORD || env.APP_DB_PASSWORD || env.DB_PASSWORD || "postgres",
    database: env.DB_APP_NAME || env.APP_DB_NAME || "screenhouse_app",
    max: 4,
  };
}

async function loadEligibleScreenhouseIds(appPool) {
  const res = await appPool.query(
    `
    SELECT sh.id
    FROM screenhouses sh
    INNER JOIN users u ON u.id = sh.owner_user_id
    WHERE sh.status = 'active'
      AND u.phone_number <> ALL($1::text[])
    ORDER BY sh.id
    `,
    [IGNORED_PHONE_NUMBERS]
  );
  return res.rows.map((row) => Number(row.id));
}

async function loadMonitoringNodes(monitoringPool, screenhouseIds, limit) {
  if (!screenhouseIds.length) return [];

  const res = await monitoringPool.query(
    `
    SELECT
      sn.id AS sensor_node_id,
      sn.screenhouse_id,
      sn.node_code,
      sn.node_name,
      sk.id AS sink_node_id,
      sk.node_code AS sink_code
    FROM sensor_nodes sn
    INNER JOIN sink_nodes sk
      ON sk.screenhouse_id = sn.screenhouse_id
     AND sk.is_active = true
    WHERE sn.is_active = true
      AND sn.screenhouse_id = ANY($1::int[])
    ORDER BY sn.screenhouse_id, sn.id
    LIMIT $2
    `,
    [screenhouseIds, limit]
  );

  return res.rows.map((row, index) => ({
    index: index + 1,
    sensorNodeId: Number(row.sensor_node_id),
    screenhouseId: Number(row.screenhouse_id),
    nodeCode: row.node_code,
    nodeName: row.node_name || row.node_code,
    sinkNodeId: Number(row.sink_node_id),
    sinkCode: row.sink_code,
    nextSendAt: 0,
    messagesSent: 0,
  }));
}

function assertUniqueNodeCodes(nodes) {
  const seen = new Set();
  const duplicates = new Set();

  for (const node of nodes) {
    if (seen.has(node.nodeCode)) duplicates.add(node.nodeCode);
    seen.add(node.nodeCode);
  }

  if (duplicates.size) {
    throw new Error(`Duplicate node_code in selected sensors: ${[...duplicates].join(", ")}`);
  }
}

export async function loadActiveSensorNodes({ env = process.env, limit }) {
  const appPool = new pg.Pool(appDbConfig(env));
  const monitoringPool = new pg.Pool(monitoringDbConfig(env));

  try {
    const screenhouseIds = await loadEligibleScreenhouseIds(appPool);
    const nodes = await loadMonitoringNodes(monitoringPool, screenhouseIds, limit);
    assertUniqueNodeCodes(nodes);

    if (nodes.length < limit) {
      throw new Error(
        `Only ${nodes.length} eligible active sensor_nodes found, but scenario requires ${limit}. ` +
          "Seed or activate real sensor_nodes first; load test will not create fake nodes."
      );
    }

    return nodes;
  } finally {
    await Promise.allSettled([appPool.end(), monitoringPool.end()]);
  }
}

export function staggerInitialDelay(sensors, intervalSec, now = Date.now()) {
  const spreadMs = intervalSec * 1000;
  sensors.forEach((sensor, i) => {
    sensor.nextSendAt = now + (i / sensors.length) * spreadMs;
  });
  return sensors;
}
