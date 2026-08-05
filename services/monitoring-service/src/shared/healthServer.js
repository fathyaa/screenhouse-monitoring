const http = require("http");
const { getIngestMetricsSnapshot } = require("../modules/ingest/ingestMetrics");

/**
 * Server HTTP minimal untuk role yang tidak melayani API.
 *
 * Gunanya dua: probe kesehatan container, dan membaca counter proses ini saat
 * pengujian beban. Counter-nya LOKAL — tiap replica menghitung pekerjaannya
 * sendiri. Untuk angka agregat lintas replica, baca RabbitMQ (queue depth di
 * /stats/ingest role api, atau management API di :15672).
 */
function startHealthServer(role, port) {
  if (!port) return null;

  const server = http.createServer((req, res) => {
    if (req.url === "/metrics") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ role, ...getIngestMetricsSnapshot() }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ role, status: "ok", pid: process.pid }));
  });

  server.listen(port, () => console.log(`[${role}] health/metrics di :${port}`));
  return server;
}

module.exports = { startHealthServer };
