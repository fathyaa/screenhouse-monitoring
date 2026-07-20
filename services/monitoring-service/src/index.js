require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");

require("./config/db");

const { connectRedis, subscriber } = require("./config/redis");
const { isRabbitMqEnabled, connectRabbitMq } = require("./config/rabbitmq");
const connectMQTT = require("./modules/ingest/mqttService");
const { connectHiveMq } = require("./modules/ingest/hivemqBridge");
const { startIngestConsumer } = require("./modules/ingest/ingestQueue");
const { startAlertWorker } = require("./modules/alerting/worker");
const { attachSocketServer } = require("./modules/realtime/socketServer");
const sensorRoutes = require("./modules/ingest/routes/sensorRoutes");
const alertRoutes = require("./modules/alerting/routes/alertRoutes");
const statsRoutes = require("./modules/stats/routes/statsRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    service: "monitoring-service",
    ingestMode: isRabbitMqEnabled() ? "rabbitmq" : "direct",
  });
});

app.use("/sensor-data", sensorRoutes);
app.use("/alerts", alertRoutes);
app.use("/stats", statsRoutes);

async function bootstrap() {
  await connectRedis();
  if (isRabbitMqEnabled()) {
    await connectRabbitMq();
    await startIngestConsumer();
  }
  connectMQTT();
  connectHiveMq();
  await startAlertWorker();

  const server = http.createServer(app);
  attachSocketServer(server, subscriber);

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    const ingest = isRabbitMqEnabled() ? "MQTT → RabbitMQ → DB" : "MQTT → DB";
    console.log(`Monitoring Service running on port ${PORT} (HTTP + Socket.IO, ingest: ${ingest})`);
  });
}

bootstrap().catch((err) => {
  console.error("Monitoring Service failed to start:", err);
  process.exit(1);
});
