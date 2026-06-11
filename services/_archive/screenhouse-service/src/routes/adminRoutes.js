const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const {
  listAdminScreenhouses,
  updateScreenhouseStatus,
} = require("../controllers/adminScreenhouseController");

const router = express.Router();
const adminRoles = ["super_admin"];

router.use(authMiddleware, roleMiddleware(adminRoles));

router.get("/screenhouses", listAdminScreenhouses);
router.patch("/screenhouses/:id/status", updateScreenhouseStatus);

module.exports = router;
