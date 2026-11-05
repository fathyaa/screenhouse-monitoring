const express = require("express");
const authMiddleware = require("../../../shared/middlewares/authMiddleware");
const {
  createMission, listMissions, getMission, latestInspections, listActuations, cancelMission,
} = require("../controllers/missionController");

const router = express.Router();

router.post("/screenhouse/:screenhouseId", authMiddleware, createMission);
router.get("/screenhouse/:screenhouseId", authMiddleware, listMissions);
router.get("/screenhouse/:screenhouseId/inspections/latest", authMiddleware, latestInspections);
router.get("/screenhouse/:screenhouseId/actuations", authMiddleware, listActuations);
router.post("/:missionCode/cancel", authMiddleware, cancelMission);
router.get("/:missionCode", authMiddleware, getMission);

module.exports = router;
