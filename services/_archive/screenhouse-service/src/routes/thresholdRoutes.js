const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const {
  listThresholds,
  getThreshold,
  upsertThreshold,
} = require("../controllers/thresholdController");

const router = express.Router();
const adminRoles = ["super_admin"];

router.get(
  "/",
  authMiddleware,
  roleMiddleware(adminRoles),
  listThresholds
);

router.get(
  "/:screenhouseId",
  authMiddleware,
  roleMiddleware(adminRoles),
  getThreshold
);

router.put(
  "/:screenhouseId",
  authMiddleware,
  roleMiddleware(adminRoles),
  upsertThreshold
);

module.exports = router;
