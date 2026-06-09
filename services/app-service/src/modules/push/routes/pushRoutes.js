const express = require("express");
const authMiddleware = require("../../../shared/middlewares/authMiddleware");
const roleMiddleware = require("../../../shared/middlewares/roleMiddleware");
const { getVapidKey, subscribePush, unsubscribePush } = require("../pushController");

const router = express.Router();

router.get("/vapid-public-key", getVapidKey);

router.post(
  "/subscribe",
  authMiddleware,
  roleMiddleware(["petani"]),
  subscribePush
);

router.post(
  "/unsubscribe",
  authMiddleware,
  roleMiddleware(["petani"]),
  unsubscribePush
);

module.exports = router;
