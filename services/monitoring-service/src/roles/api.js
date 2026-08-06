const http = require("http");
const express = require("express");
const cors = require("cors");
const { connectRabbitMqInBackground } = require("../config/rabbitmq");
const sensorRoutes = require("../modules/ingest/routes/sensorRoutes");
const alertRoutes = require("../modules/alerting/routes/alertRoutes");
const statsRoutes = require("../modules/stats/routes/statsRoutes");
const { startMetricsAggregator } = require("../shared/metricsAggregator");

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

  // Kumpulkan counter dari seluruh role. Tanpa ini /stats/ingest hanya
  // melaporkan proses ini sendiri — yang tidak menyentuh satu pun pesan sensor.
  startMetricsAggregator();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/", (req, res) => {
    // Dibaca harness uji beban untuk menentukan mode pengukuran. "listener"
    // membedakannya dari "direct" dan "rabbitmq" milik arsitektur lama, supaya
    // ketiganya bisa dipisahkan di laporan pembanding.
    res.json({ service: "monitoring-service", role: "api", ingestMode: "listener" });
  });

  app.use("/sensor-data", sensorRoutes);
  app.use("/alerts", alertRoutes);
  app.use("/stats", statsRoutes);

  const server = http.createServer(app);
  const port = Number(process.env.PORT || 3001);
  server.listen(port, () => console.log(`[api] HTTP di :${port}`));
}

module.exports = { start };
