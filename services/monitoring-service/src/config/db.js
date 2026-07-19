const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "screenhouse_monitoring",
  // Default pg pool max = 10; terlalu kecil untuk ingest berkonkurensi tinggi
  // (tiap pesan sensor memicu beberapa query di pipeline + worker alert).
  max: Number(process.env.PG_POOL_MAX || 40),
  idleTimeoutMillis: Number(process.env.PG_POOL_IDLE_MS || 30000),
});

pool.connect()
  .then((client) => {
    console.log("Connected to PostgreSQL");
    client.release();
  })
  .catch((err) => {
    console.log("PostgreSQL connection error:", err);
  });

module.exports = pool;