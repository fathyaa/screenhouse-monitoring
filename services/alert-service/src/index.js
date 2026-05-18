require("dotenv").config();
const express = require("express");
const pool = require("./db");
const alertRoutes = require("./routes/alertRoutes");
const { subscriber, publisher, connectRedis } = require("./redis");

const app = express();
app.get("/", (req, res) => res.send("Alert Service Running"));
app.use("/alerts", alertRoutes);

async function createAlert({ sensorDataId, screenhouseId, message }) {
  const result = await pool.query(
    `INSERT INTO alerts (sensor_data_id, screenhouse_id, message, status) VALUES ($1, $2, $3, $4) RETURNING *`,
    [sensorDataId, screenhouseId, message, "active"]
  );
  console.log("ALERT CREATED:", message);

  const enriched = await pool.query(
    `SELECT a.id, a.screenhouse_id, a.message, a.status, a.created_at, a.sensor_data_id,
            sd.nitrogen AS actual_nitrogen, sd.phosphorus AS actual_phosphorus, sd.potassium AS actual_potassium, sd.moisture AS actual_moisture,
            t.min_nitrogen, t.max_nitrogen, t.min_phosphorus, t.max_phosphorus, t.min_potassium, t.max_potassium, t.min_moisture, t.max_moisture,
            sh.name AS screenhouse_name, sh.owner_user_id AS user_id
     FROM alerts a
     LEFT JOIN sensor_data sd ON sd.id = a.sensor_data_id
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
      const { sensorDataId, screenhouseId, data: sensorData } = JSON.parse(message);
      console.log("Checking threshold...");

      const thresholdResult = await pool.query(`SELECT * FROM thresholds WHERE screenhouse_id = $1`, [screenhouseId]);
      const threshold = thresholdResult.rows[0];
      if (!threshold) return console.log("Threshold tidak ditemukan");

      // Struktur data untuk validasi otomatis (DRY)
      const metrics = [
        { name: "nitrogen", label: "Nitrogen" },
        { name: "phosphorus", label: "Phosphorus" },
        { name: "potassium", label: "Potassium" },
        { name: "moisture", label: "Kelembapan" }
      ];

      for (const m of metrics) {
        if (sensorData[m.name] < threshold[`min_${m.name}`]) {
          await createAlert({ sensorDataId, screenhouseId, message: `${m.label} di bawah batas minimum` });
        }
        if (sensorData[m.name] > threshold[`max_${m.name}`]) {
          await createAlert({ sensorDataId, screenhouseId, message: `${m.label} melebihi batas maksimum` });
        }
      }
    } catch (err) {
      console.error(err);
    }
  });

  app.listen(3005, () => console.log("Alert Service running on port 3005"));
}

startServer();