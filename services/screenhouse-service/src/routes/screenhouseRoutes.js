const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const {
  createScreenhouse,
  getScreenhouses,
  getMyScreenhouses,
  getOperatorStats,
  getMyDashboardStats,
  getScreenhouseById,
} = require("../controllers/screenhouseController");

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

router.get(
  "/operator-stats",
  authMiddleware,
  roleMiddleware(["operator", "super_admin"]),
  getOperatorStats
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