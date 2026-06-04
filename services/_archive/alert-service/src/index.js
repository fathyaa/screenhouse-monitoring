require("dotenv").config();
const express = require("express");
const pool = require("./db");
const alertRoutes = require("./routes/alertRoutes");
const { subscriber, publisher, connectRedis } = require("./redis");
const { THRESHOLD_METRICS } = require("./constants/thresholdMetrics");

const app = express();
app.get("/", (req, res) => res.send("Alert Service Running"));
app.use("/alerts", alertRoutes);

async function createAlert({
  sensorDataId,
  screenhouseId,
  sensorNodeId,
  message,
}) {
  const result = await pool.query(
    `INSERT INTO alerts (sensor_data_id, screenhouse_id, sensor_node_id, message, status)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [sensorDataId, screenhouseId, sensorNodeId, message, "active"]
  );
  console.log("ALERT CREATED:", message);

  const enriched = await pool.query(
    `SELECT a.id, a.screenhouse_id, a.sensor_node_id, a.message, a.status, a.created_at, a.sensor_data_id,
            sd.nitrogen AS actual_nitrogen,
            sd.phosphorus AS actual_phosphorus,
            sd.potassium AS actual_potassium,
            sd.soil_moisture AS actual_soil_moisture,
            sd.soil_temperature AS actual_soil_temperature,
            sd.soil_ph AS actual_soil_ph,
            sd.conductivity AS actual_conductivity,
            sd.air_temperature AS actual_air_temperature,
            sd.air_humidity AS actual_air_humidity,
            sd.light_intensity AS actual_light_intensity,
            sn.node_name AS sensor_node_name,
            sn.node_code,
            t.*,
            sh.name AS screenhouse_name,
            sh.owner_user_id AS user_id
     FROM alerts a
     LEFT JOIN sensor_data sd ON sd.id = a.sensor_data_id
     LEFT JOIN sensor_nodes sn ON sn.id = a.sensor_node_id
     LEFT JOIN thresholds t ON t.screenhouse_id = a.screenhouse_id
     LEFT JOIN screenhouses sh ON sh.id = a.screenhouse_id
     WHERE a.id = $1`,
    [result.rows[0].id]
  );
  await publisher.publish("alert-created", JSON.stringify(enriched.rows[0]));
}

async function startServer() {
  await connectRedis();

  await subscriber.subscribe("sensor-data-created", async (message) => {
    try {
      const { sensorDataId, screenhouseId, sensorNodeId, data: sensorData } =
        JSON.parse(message);
      console.log("Checking threshold...");

      const thresholdResult = await pool.query(
        `SELECT * FROM thresholds WHERE screenhouse_id = $1`,
        [screenhouseId]
      );
      const threshold = thresholdResult.rows[0];
      if (!threshold) return console.log("Threshold tidak ditemukan");

      for (const m of THRESHOLD_METRICS) {
        const value = sensorData[m.key];
        if (value == null) continue;

        const min = threshold[m.minCol];
        const max = threshold[m.maxCol];

        if (min != null && Number(value) < Number(min)) {
          await createAlert({
            sensorDataId,
            screenhouseId,
            sensorNodeId,
            message: `${m.label} di bawah batas minimum`,
          });
        }
        if (max != null && Number(value) > Number(max)) {
          await createAlert({
            sensorDataId,
            screenhouseId,
            sensorNodeId,
            message: `${m.label} melebihi batas maksimum`,
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  });

  app.listen(3005, () => console.log("Alert Service running on port 3005"));
}

startServer();
