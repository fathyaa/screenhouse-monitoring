require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");

require("./config/db");

const { connectRedis, subscriber } = require("./config/redis");
const connectMQTT = require("./modules/ingest/mqttService");
const { startAlertWorker } = require("./modules/alerting/worker");
const { attachSocketServer } = require("./modules/realtime/socketServer");
const sensorRoutes = require("./modules/ingest/routes/sensorRoutes");
const alertRoutes = require("./modules/alerting/routes/alertRoutes");
const statsRoutes = require("./modules/stats/routes/statsRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Monitoring Service Running");
});

app.use("/sensor-data", sensorRoutes);
app.use("/alerts", alertRoutes);
app.use("/stats", statsRoutes);

async function bootstrap() {
  await connectRedis();
  connectMQTT();
  await startAlertWorker();

  const server = http.createServer(app);
  attachSocketServer(server, subscriber);

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`Monitoring Service running on port ${PORT} (HTTP + Socket.IO)`);
  });
}

bootstrap().catch((err) => {
  console.error("Monitoring Service failed to start:", err);
  process.exit(1);
});
