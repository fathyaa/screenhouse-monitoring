require("dotenv").config();

const express = require("express");
const cors = require("cors");
const proxy = require("express-http-proxy");

const app = express();

app.use(cors());
app.use(express.json());

const APP_SERVICE = process.env.APP_SERVICE_URL || "http://localhost:3004";
const MONITORING_SERVICE = process.env.MONITORING_SERVICE_URL || "http://localhost:3001";

/* APP SERVICE */
app.use(
  "/auth",
  proxy(APP_SERVICE, {
    proxyReqPathResolver: (req) => `/auth${req.url}`,
  })
);

app.use(
  "/admin/users",
  proxy(APP_SERVICE, {
    proxyReqPathResolver: (req) => `/admin/users${req.url}`,
  })
);

app.use(
  "/admin",
  proxy(APP_SERVICE, {
    proxyReqPathResolver: (req) => `/admin${req.url}`,
  })
);

app.use(
  "/screenhouses",
  proxy(APP_SERVICE, {
    proxyReqPathResolver: (req) => `/screenhouses${req.url}`,
  })
);

app.use(
  "/wilayah",
  proxy(APP_SERVICE, {
    proxyReqPathResolver: (req) => `/wilayah${req.url}`,
  })
);

app.use(
  "/thresholds",
  proxy(APP_SERVICE, {
    proxyReqPathResolver: (req) => `/thresholds${req.url}`,
  })
);

/* MONITORING SERVICE */
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

app.get("/", (req, res) => {
  res.send("API Gateway Running");
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`API Gateway running on ${PORT}`);
});
