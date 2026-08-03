const express = require("express");
const authMiddleware = require("../../../shared/middlewares/authMiddleware");
const roleMiddleware = require("../../../shared/middlewares/roleMiddleware");
const {
  listAdminScreenhouses,
  updateScreenhouseStatus,
  deleteScreenhouse,
} = require("../controllers/adminScreenhouseController");
const {
  listScreenhouseTrays,
  createScreenhouseTray,
  deleteScreenhouseTray,
} = require("../controllers/adminTrayController");

const router = express.Router();
const adminRoles = ["super_admin"];

router.use(authMiddleware, roleMiddleware(adminRoles));

router.get("/screenhouses", listAdminScreenhouses);
router.patch("/screenhouses/:id/status", updateScreenhouseStatus);
router.get("/screenhouses/:id/trays", listScreenhouseTrays);
router.post("/screenhouses/:id/trays", createScreenhouseTray);
router.delete("/screenhouses/:id/trays/:nodeId", deleteScreenhouseTray);
router.delete("/screenhouses/:id", deleteScreenhouse);

module.exports = router;
