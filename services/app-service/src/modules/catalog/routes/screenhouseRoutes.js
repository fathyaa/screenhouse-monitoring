const express = require("express");
const authMiddleware = require("../../../shared/middlewares/authMiddleware");
const roleMiddleware = require("../../../shared/middlewares/roleMiddleware");

const {
  createScreenhouse,
  getScreenhouses,
  getMyScreenhouses,
  getOperatorStats,
  getMyDashboardStats,
  getScreenhouseById,
  getScreenhouseEstimasiTanam,
  getScreenhouseStressScore,
  patchScreenhouseProfile,
  submitMyScreenhouse,
  getPendingScreenhouses,
  getPendingScreenhouseStats,
  approveScreenhouse,
  rejectScreenhouse,
} = require("../controllers/screenhouseController");
const {
  startSemaiCycle,
  endSemaiCycle,
  editSemaiCycle,
  deleteSemaiCycle,
  listScreenhouseCycles,
  getSemaiCycleById,
  getMySemaiCycles,
  getActiveSemaiCycle,
} = require("../controllers/semaiCycleController");
const { getOperatorReports } = require("../controllers/operatorReportController");

const router = express.Router();

router.get(
  "/my-screenhouses",
  authMiddleware,
  getMyScreenhouses
);

router.get(
  "/my-stats",
  authMiddleware,
  roleMiddleware(["petani"]),
  getMyDashboardStats
);

router.post(
  "/mine",
  authMiddleware,
  roleMiddleware(["petani"]),
  submitMyScreenhouse
);

router.get(
  "/pending/stats",
  authMiddleware,
  roleMiddleware(["operator", "super_admin"]),
  getPendingScreenhouseStats
);

router.get(
  "/pending",
  authMiddleware,
  roleMiddleware(["operator", "super_admin"]),
  getPendingScreenhouses
);

router.patch(
  "/:id/approve",
  authMiddleware,
  roleMiddleware(["operator", "super_admin"]),
  approveScreenhouse
);

router.patch(
  "/:id/reject",
  authMiddleware,
  roleMiddleware(["operator", "super_admin"]),
  rejectScreenhouse
);

router.get(
  "/operator-stats",
  authMiddleware,
  roleMiddleware(["operator", "super_admin"]),
  getOperatorStats
);

router.get(
  "/operator-reports",
  authMiddleware,
  roleMiddleware(["operator", "super_admin"]),
  getOperatorReports
);

router.get(
  "/my-cycles",
  authMiddleware,
  roleMiddleware(["petani"]),
  getMySemaiCycles
);

router.post(
  "/",
  authMiddleware,
  roleMiddleware([
    "operator",
    "super_admin",
  ]),
  createScreenhouse
);

router.patch(
  "/:id/profile",
  authMiddleware,
  roleMiddleware(["petani", "operator", "super_admin"]),
  patchScreenhouseProfile
);

router.get(
  "/:id/cycles/active",
  authMiddleware,
  roleMiddleware(["operator", "super_admin", "petani"]),
  getActiveSemaiCycle
);

router.post(
  "/:id/cycles/start",
  authMiddleware,
  roleMiddleware(["petani"]),
  startSemaiCycle
);

router.post(
  "/:id/cycles/end",
  authMiddleware,
  roleMiddleware(["petani"]),
  endSemaiCycle
);

router.patch(
  "/:id/cycles/:cycleId",
  authMiddleware,
  roleMiddleware(["petani"]),
  editSemaiCycle
);

router.delete(
  "/:id/cycles/:cycleId",
  authMiddleware,
  roleMiddleware(["petani"]),
  deleteSemaiCycle
);

router.get(
  "/:id/cycles/:cycleId",
  authMiddleware,
  roleMiddleware(["operator", "super_admin", "petani"]),
  getSemaiCycleById
);

router.get(
  "/:id/cycles",
  authMiddleware,
  roleMiddleware(["operator", "super_admin", "petani"]),
  listScreenhouseCycles
);

router.get(
  "/:id/estimasi-tanam",
  authMiddleware,
  roleMiddleware(["operator", "super_admin", "petani"]),
  getScreenhouseEstimasiTanam
);

router.get(
  "/:id/stress-score",
  authMiddleware,
  roleMiddleware(["operator", "super_admin", "petani"]),
  getScreenhouseStressScore
);

router.get(
  "/:id",
  authMiddleware,
  roleMiddleware(["operator", "super_admin", "petani"]),
  getScreenhouseById
);

router.get(
  "/",
  authMiddleware,
  roleMiddleware([
    "operator",
    "super_admin",
  ]),
  getScreenhouses
);

// console.log(router.stack);
module.exports = router;