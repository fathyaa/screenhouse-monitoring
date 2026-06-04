require("dotenv").config();

const express = require("express");
const cors = require("cors");

require("./db");

const { connectRedis } = require("./redis");
const connectMQTT = require("./services/mqttService");

const sensorRoutes = require("./routes/sensorRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Data Service Running");
});

app.use("/sensor-data", sensorRoutes);

connectRedis();
connectMQTT();

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Data Service running on port ${PORT}`);
});