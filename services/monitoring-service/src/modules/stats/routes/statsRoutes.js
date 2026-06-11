const express = require("express");

const {
  getOperatorStats,
  getOwnerStats,
  getNodeCounts,
} = require("../controllers/statsController");

const router = express.Router();

// Internal endpoints consumed by app-service (auth handled upstream).
router.get("/operator", getOperatorStats);
router.get("/node-counts", getNodeCounts);
router.get("/owner/:ownerId", getOwnerStats);

module.exports = router;
