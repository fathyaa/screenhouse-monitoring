require("dotenv").config();

const express =
  require("express");

const cors =
  require("cors");

const proxy =
  require(
    "express-http-proxy"
  );

const app = express();

app.use(cors());

app.use(express.json());

/* USER SERVICE */

app.use(
  "/auth",
  proxy(
    "http://localhost:3004",
    {
      proxyReqPathResolver:
        (req) =>
          `/auth${req.url}`,
    }
  )
);

app.use(
  "/admin/users",
  proxy(
    "http://localhost:3004",
    {
      proxyReqPathResolver:
        (req) =>
          `/admin/users${req.url}`,
    }
  )
);

app.use(
  "/admin",
  proxy(
    "http://localhost:3003",
    {
      proxyReqPathResolver:
        (req) =>
          `/admin${req.url}`,
    }
  )
);

/* SCREENHOUSE SERVICE */

app.use(
  "/screenhouses",
  proxy(
    "http://localhost:3003",
    {
      proxyReqPathResolver:
        (req) =>
          `/screenhouses${req.url}`,
    }
  )
);

app.use(
  "/wilayah",
  proxy(
    "http://localhost:3003",
    {
      proxyReqPathResolver:
        (req) =>
          `/wilayah${req.url}`,
    }
  )
);

app.use(
  "/thresholds",
  proxy(
    "http://localhost:3003",
    {
      proxyReqPathResolver:
        (req) =>
          `/thresholds${req.url}`,
    }
  )
);

/* DATA SERVICE */

app.use(
  "/sensor-data",
  proxy(
    "http://localhost:3001/sensor-data",
    {
      proxyReqPathResolver:
        (req) =>
          `/sensor-data${req.url}`,
    }
  )
);

/* ALERT SERVICE */

app.use(
  "/alerts",
  proxy(
    "http://localhost:3005",
    {
      proxyReqPathResolver:
        (req) =>
          `/alerts${req.url}`,
    }
  )
);

app.get("/", (req, res) => {
  console.log(req.method, req.url);
  res.send(
    "API Gateway Running"
  );
});

const PORT =
  process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(
    `API Gateway running on ${PORT}`
  );
});