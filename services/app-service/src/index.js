require("dotenv").config();

const express = require("express");
const cors = require("cors");
const proxy = require("express-http-proxy");

require("./config/db");

const authRoutes = require("./modules/identity/routes/authRoutes");
const adminUserRoutes = require("./modules/identity/routes/adminRoutes");
const screenhouseRoutes = require("./modules/catalog/routes/screenhouseRoutes");
const wilayahRoutes = require("./modules/catalog/routes/wilayahRoutes");
const thresholdRoutes = require("./modules/catalog/routes/thresholdRoutes");
const adminScreenhouseRoutes = require("./modules/catalog/routes/adminRoutes");
const authMiddleware = require("./shared/middlewares/authMiddleware");
const roleMiddleware = require("./shared/middlewares/roleMiddleware");
const { setScreenhouseActuators } = require("./modules/catalog/controllers/actuatorController");
const { patchSensorNodeName } = require("./modules/catalog/controllers/sensorNodeController");
const pushRoutes = require("./modules/push/routes/pushRoutes");
const { connectRabbitMq, connectRabbitMqInBackground } = require("./config/rabbitmq");
const { startPushWorker } = require("./modules/push/pushWorker");

const MONITORING_SERVICE =
  process.env.MONITORING_SERVICE_URL || "http://localhost:3001";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const level = res.statusCode >= 400 ? "error" : "info";
    const line = {
      service: "app-service",
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: Date.now() - start,
    };
    if (level === "error") console.error("[http]", JSON.stringify(line));
    else console.log("[http]", JSON.stringify(line));
  });
  next();
});

app.get("/", (req, res) => {
  res.send("App Service Running (API Gateway)");
});

/* App domain routes */
app.use("/auth", authRoutes);
app.use("/admin", adminUserRoutes);
app.use("/admin", adminScreenhouseRoutes);
app.use("/screenhouses", screenhouseRoutes);
app.use("/varietas-bibit", require("./modules/catalog/routes/varietasRoutes"));
app.use("/wilayah", wilayahRoutes);
app.use("/laporan", require("./modules/catalog/routes/laporanRoutes"));
app.use("/thresholds", thresholdRoutes);
app.use("/push", pushRoutes);

app.post(
  "/sensor-data/screenhouse/:screenhouseId/actuators",
  authMiddleware,
  roleMiddleware(["petani"]),
  setScreenhouseActuators
);

app.patch(
  "/sensor-data/sensor-nodes/:nodeId",
  authMiddleware,
  roleMiddleware(["petani", "operator", "super_admin"]),
  patchSensorNodeName
);

/* Proxy monitoring domain */
app.use(
  "/sensor-data",
  proxy(MONITORING_SERVICE, {
    proxyReqPathResolver: (req) => `/sensor-data${req.url}`,
  })
);

app.use(
  "/alerts",
  proxy(MONITORING_SERVICE, {
    proxyReqPathResolver: (req) => `/alerts${req.url}`,
  })
);

const PORT = process.env.PORT || 8000;

/**
 * Dua peran dari satu artefak:
 *
 *   api        — REST + proxy ke monitoring-service. Stateless, boleh N replica
 *                di belakang load balancer.
 *   notifikasi — listener Web Push. Tidak membuka port HTTP sama sekali; ia
 *                hanya menunggu peristiwa alert.created di antrean.
 *
 * Sebelumnya keduanya jalan dalam satu proses, sehingga tiap deploy API ikut
 * memutus pengiriman notifikasi.
 */
const ROLE = process.env.ROLE || "api";

async function bootstrap() {
  if (ROLE === "notifikasi") {
    // Listener tidak punya alasan untuk hidup tanpa antrean.
    await connectRabbitMq();
    startPushWorker();
    console.log("App Service | ROLE=notifikasi — menunggu alert.created");
    return;
  }

  if (ROLE !== "api") {
    console.error(`ROLE "${ROLE}" tidak dikenal. Pilihan: api, notifikasi`);
    process.exit(1);
  }

  // API sengaja TIDAK menunggu broker. Sebagian besar endpoint hanya membaca
  // database; menolak login hanya karena RabbitMQ belum siap akan menukar satu
  // kegagalan kecil dengan pemadaman total.
  connectRabbitMqInBackground();

  app.listen(PORT, () => {
    console.log(`App Service running on port ${PORT} (REST + gateway proxy)`);
  });
}

bootstrap().catch((err) => {
  console.error(`[app-service:${ROLE}] gagal start:`, err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error(`[app-service:${ROLE}] unhandled rejection:`, err);
});
