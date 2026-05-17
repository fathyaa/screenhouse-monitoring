const express = require("express");

const {
  getSensorData,
  getLatestSensorData,
} = require("../controllers/sensorController");

const router = express.Router();

router.get(
  "/latest/:screenhouseId",
  getLatestSensorData
);

router.get("/", getSensorData);

module.exports = router;