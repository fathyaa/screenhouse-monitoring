const express = require("express");
const authMiddleware = require("../../../shared/middlewares/authMiddleware");

const {
  getSensorData,
  getLatestSensorData,
  getLatestAllSensorData,
  getMapSummary,
  getSensorNodesByScreenhouse,
  getScreenhouseSensorHistory,
  getScreenhouseSensorTrend,
  getScreenhouseDashboardSummary,
  getScreenhouseStressScore,
  getSinkNodeByScreenhouse,
  patchSensorNodeName,
} = require("../controllers/sensorController");
const { postScreenhouseActuators } = require("../controllers/actuatorController");

const router = express.Router();

router.patch("/sensor-nodes/:nodeId", authMiddleware, patchSensorNodeName);
router.get(
  "/screenhouse/:screenhouseId/stress-score",
  authMiddleware,
  getScreenhouseStressScore
);
router.get(
  "/screenhouse/:screenhouseId/dashboard",
  authMiddleware,
  getScreenhouseDashboardSummary
);
router.get(
  "/screenhouse/:screenhouseId/sink-node",
  authMiddleware,
  getSinkNodeByScreenhouse
);
router.get(
  "/screenhouse/:screenhouseId/history",
  authMiddleware,
  getScreenhouseSensorHistory
);
router.get(
  "/screenhouse/:screenhouseId/trend",
  authMiddleware,
  getScreenhouseSensorTrend
);
router.get(
  "/screenhouse/:screenhouseId/sensor-nodes",
  authMiddleware,
  getSensorNodesByScreenhouse
);
router.get(
  "/screenhouse/:screenhouseId/sensors",
  authMiddleware,
  getSensorNodesByScreenhouse
);
router.post(
  "/screenhouse/:screenhouseId/actuators",
  authMiddleware,
  postScreenhouseActuators
);
router.get("/map-summary", authMiddleware, getMapSummary);
router.get("/latest/:screenhouseId", authMiddleware, getLatestSensorData);
router.get("/latest", authMiddleware, getLatestAllSensorData);
router.get("/", authMiddleware, getSensorData);

module.exports = router;
