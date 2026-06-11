const express = require("express");
const authMiddleware = require("../../../shared/middlewares/authMiddleware");

const {
  getAlerts,
  resolveAlert
} = require("../controllers/alertController");

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  getAlerts
);

router.patch(
  "/:id/resolve",
  authMiddleware,
  resolveAlert
);

module.exports = router;