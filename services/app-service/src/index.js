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
app.use("/wilayah", wilayahRoutes);
app.use("/thresholds", thresholdRoutes);

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

app.listen(PORT, () => {
  console.log(`App Service running on port ${PORT} (REST + gateway proxy)`);
});
