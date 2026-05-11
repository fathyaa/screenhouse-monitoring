const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const {
  createScreenhouse,
  getScreenhouses,
  getMyScreenhouses,
} = require("../controllers/screenhouseController");

const router = express.Router();

router.get(
  "/my-screenhouses",
  authMiddleware,
  getMyScreenhouses
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