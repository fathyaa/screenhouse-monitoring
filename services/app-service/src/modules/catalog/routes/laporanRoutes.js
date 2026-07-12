const express = require("express");
const authMiddleware = require("../../../shared/middlewares/authMiddleware");
const roleMiddleware = require("../../../shared/middlewares/roleMiddleware");
const { getOperatorReports } = require("../controllers/operatorReportController");

const router = express.Router();

router.get(
  "/wilayah",
  authMiddleware,
  roleMiddleware(["operator", "super_admin"]),
  getOperatorReports
);

module.exports = router;
