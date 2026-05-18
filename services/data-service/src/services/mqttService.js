const mqtt = require("mqtt");
const pool = require("../db");
const { redisClient } = require("../redis");

function connectMQTT() {
  const client = mqtt.connect(process.env.MQTT_BROKER_URL);

  client.on("connect", () => {
    console.log("Connected to MQTT Broker");

    client.subscribe("screenhouse/+/sensor", (err) => {
      if (err) {
        console.log("Subscribe error:", err);
      } else {
        console.log("Subscribed to screenhouse sensor topics");
      }
    });
  });

  client.on("message", async (topic, message) => {
    console.log("TOPIC:", topic);

    try {
      const data = JSON.parse(message.toString());

      console.log("Sensor Data:", data);

      // ambil screenhouse id dari topic
      const parts = topic.split("/");
      const screenhouseId = parts[1];

      const savedSensor =
        await pool.query(
          `
          INSERT INTO sensor_data (
            screenhouse_id,
            nitrogen,
            phosphorus,
            potassium,
            moisture
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
          `,
          [
            screenhouseId,
            data.nitrogen,
            data.phosphorus,
            data.potassium,
            data.moisture,
          ]
        );

      const sensorDataId = savedSensor.rows[0].id;
      console.log("Sensor data saved to PostgreSQL");

      await redisClient.publish(
        "sensor-data-created",
        JSON.stringify({
          sensorDataId,
          screenhouseId,
          data,
        })
      );

console.log("Event published to Redis");
    } catch (err) {
      console.log("Error processing MQTT message:", err);
    }
  });
}

module.exports = connectMQTT;