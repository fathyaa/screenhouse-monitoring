const { Pool } = require("pg");

const monitoringPool =
  process.env.DB_MON_NAME || process.env.MONITORING_DB_NAME
    ? new Pool({
        // DB_MON_HOST default ke DB_HOST agar mode host (dua DB di localhost,
        // beda port) tetap sama; di Docker kedua Postgres jadi host terpisah.
        host: process.env.DB_MON_HOST || process.env.DB_HOST || "localhost",
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
