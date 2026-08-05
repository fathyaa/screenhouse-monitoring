const http = require("http");
const express = require("express");
const cors = require("cors");
const { connectRabbitMqInBackground } = require("../config/rabbitmq");
const sensorRoutes = require("../modules/ingest/routes/sensorRoutes");
const alertRoutes = require("../modules/alerting/routes/alertRoutes");
const statsRoutes = require("../modules/stats/routes/statsRoutes");

/**
 * API — permukaan HTTP monitoring-service.
 *
 * Stateless, jadi boleh berapa pun replica-nya di belakang load balancer. Ia
 * membaca database untuk query, dan menerbitkan ke bus untuk aksi (mis. kendali
 * aktuator manual, yang perintahnya dititipkan ke q.device.command).
 */
async function start() {
  // Sengaja tidak ditunggu: endpoint query hanya butuh database. Menolak
  // melayani daftar alert hanya karena broker belum siap akan menukar satu
  // kegagalan kecil dengan pemadaman total.
  connectRabbitMqInBackground();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/", (req, res) => {
    res.json({ service: "monitoring-service", role: "api", ingestMode: "rabbitmq" });
  });

  app.use("/sensor-data", sensorRoutes);
  app.use("/alerts", alertRoutes);
  app.use("/stats", statsRoutes);

  const server = http.createServer(app);
  const port = Number(process.env.PORT || 3001);
  server.listen(port, () => console.log(`[api] HTTP di :${port}`));
}

module.exports = { start };
