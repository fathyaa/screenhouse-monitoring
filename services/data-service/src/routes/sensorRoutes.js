const express = require("express");

const {
  getSensorData,
  getLatestSensorData,
  getLatestAllSensorData,
} = require("../controllers/sensorController");

const router = express.Router();

router.get(
  "/latest/:screenhouseId",
  getLatestSensorData
);

router.get("/latest", getLatestAllSensorData);
router.get("/", getSensorData);

module.exports = router;