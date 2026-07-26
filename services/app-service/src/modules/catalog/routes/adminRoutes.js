const express = require("express");
const authMiddleware = require("../../../shared/middlewares/authMiddleware");
const roleMiddleware = require("../../../shared/middlewares/roleMiddleware");
const {
  listAdminScreenhouses,
  updateScreenhouseStatus,
  deleteScreenhouse,
} = require("../controllers/adminScreenhouseController");

const router = express.Router();
const adminRoles = ["super_admin"];

router.use(authMiddleware, roleMiddleware(adminRoles));

router.get("/screenhouses", listAdminScreenhouses);
router.patch("/screenhouses/:id/status", updateScreenhouseStatus);
router.delete("/screenhouses/:id", deleteScreenhouse);

module.exports = router;
