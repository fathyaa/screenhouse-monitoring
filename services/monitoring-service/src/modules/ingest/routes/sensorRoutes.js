const express = require("express");
const authMiddleware = require("../../../shared/middlewares/authMiddleware");

const {
  getSensorData,
  getLatestSensorData,
  getLatestAllSensorData,
  getMapSummary,
  getSensorNodesByScreenhouse,
  getScreenhouseSensorHistory,
  getScreenhouseDashboardSummary,
  getScreenhouseStressScore,
  getSinkNodeByScreenhouse,
} = require("../controllers/sensorController");
const { postScreenhouseActuators } = require("../controllers/actuatorController");

const router = express.Router();

router.get(
  "/screenhouse/:screenhouseId/stress-score",
  getScreenhouseStressScore
);
router.get(
  "/screenhouse/:screenhouseId/dashboard",
  getScreenhouseDashboardSummary
);
router.get(
  "/screenhouse/:screenhouseId/sink-node",
  getSinkNodeByScreenhouse
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
router.post(
  "/screenhouse/:screenhouseId/actuators",
  postScreenhouseActuators
);
router.get("/map-summary", getMapSummary);
router.get("/latest/:screenhouseId", getLatestSensorData);
router.get("/latest", authMiddleware, getLatestAllSensorData);
router.get("/", getSensorData);

module.exports = router;
