require("dotenv").config();

const express = require("express");

const pool = require("./db");

const {
  subscriber,
  publisher,
  connectRedis,
} = require("./redis");

const app = express();

app.get("/", (req, res) => {
  res.send("Alert Service Running");
});

async function startServer() {
  await connectRedis();

  await subscriber.subscribe(
    "sensor-data-created",
    async (message) => {
      try {
        const payload =
          JSON.parse(message);

        const sensorDataId = payload.sensorDataId;

        const screenhouseId = payload.screenhouseId;

        const sensorData = payload.data;

        console.log(
          "Checking threshold..."
        );

        const thresholdResult =
          await pool.query(
            `
            SELECT *
            FROM thresholds
            WHERE screenhouse_id = $1
            `,
            [screenhouseId]
          );

        const threshold =
          thresholdResult.rows[0];

        if (!threshold) {
          console.log(
            "Threshold tidak ditemukan"
          );

          return;
        }

        // cek nitrogen
        if (
          sensorData.npk.nitrogen <
          threshold.min_nitrogen
        ) {
          const message =
            "Nitrogen di bawah batas minimum";

          await pool.query(
            `
            INSERT INTO alerts (
              sensor_data_id,
              screenhouse_id,
              message
            )
            VALUES ($1, $2, $3)
            `,
            [
              sensorDataId,
              screenhouseId,
              message,
            ]
          );

          console.log(
            "ALERT CREATED:",
            message
          );

          await publisher.publish(
            "alert-created",
            JSON.stringify({
                sensorDataId,
                screenhouseId,
                message,
                status: "active",
            })
        );
        }

        // cek moisture
        if (
          sensorData.moisture <
          threshold.min_moisture
        ) {
          const message =
            "Kelembaban di bawah batas minimum";

          await pool.query(
            `
            INSERT INTO alerts (
              sensor_data_id,
              screenhouse_id,
              message
            )
            VALUES ($1, $2, $3)
            `,
            [
              sensorDataId,
              screenhouseId,
              message,
            ]
          );

          console.log(
            "ALERT CREATED:",
            message
          );

          await publisher.publish(
            "alert-created",
            JSON.stringify({
                sensorDataId,
                screenhouseId,
                message,
                status: "active",
            })
          );
        }
      } catch (err) {
        console.log(err);
      }
    }
  );

  app.listen(3005, () => {
    console.log(
      "Alert Service running on port 3005"
    );
  });
}

startServer();