const express = require("express");

const {
  getSensorData,
  getLatestSensorData,
  getLatestAllSensorData,
  getSensorNodesByScreenhouse,
  getScreenhouseSensorHistory,
  getScreenhouseDashboardSummary,
} = require("../controllers/sensorController");

const router = express.Router();

router.get(
  "/screenhouse/:screenhouseId/dashboard",
  getScreenhouseDashboardSummary
);
router.get(
  "/screenhouse/:screenhouseId/history",
  getScreenhouseSensorHistory
);
router.get(
  "/screenhouse/:screenhouseId/sensor-nodes",
  getSensorNodesByScreenhouse
);
router.get(
  "/screenhouse/:screenhouseId/sensors",
  getSensorNodesByScreenhouse
);
router.get("/latest/:screenhouseId", getLatestSensorData);
router.get("/latest", getLatestAllSensorData);
router.get("/", getSensorData);

module.exports = router;
