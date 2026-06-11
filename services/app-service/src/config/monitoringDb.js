const { Pool } = require("pg");

const monitoringPool =
  process.env.DB_MON_NAME || process.env.MONITORING_DB_NAME
    ? new Pool({
        host: process.env.DB_MON_HOST || "localhost",
        port: Number(process.env.DB_MON_PORT || 5433),
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "postgres",
        database: process.env.DB_MON_NAME || process.env.MONITORING_DB_NAME || "screenhouse_monitoring",
      })
    : null;

if (monitoringPool) {
  monitoringPool.connect().then((client) => {
    client.release();
    console.log("App Service connected to Monitoring PostgreSQL (read-only stats)");
  }).catch((err) => {
    console.warn("[monitoring-db] optional connection failed:", err.message);
  });
}

module.exports = monitoringPool;
