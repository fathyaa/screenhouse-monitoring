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
  submitMyScreenhouse,
  getPendingScreenhouses,
  getPendingScreenhouseStats,
  approveScreenhouse,
  rejectScreenhouse,
} = require("../controllers/screenhouseController");
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

router.post(
  "/",
  authMiddleware,
  roleMiddleware([
    "operator",
    "super_admin",
  ]),
  createScreenhouse
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