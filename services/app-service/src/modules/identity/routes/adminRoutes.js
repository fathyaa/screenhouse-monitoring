const express = require("express");
const authMiddleware = require("../../../shared/middlewares/authMiddleware");
const roleMiddleware = require("../../../shared/middlewares/roleMiddleware");
const {
  listUsers,
  updateUser,
  resetUserPassword,
  deleteUser,
} = require("../controllers/adminController");

const router = express.Router();
const adminRoles = ["super_admin"];

router.use(authMiddleware, roleMiddleware(adminRoles));

router.get("/users", listUsers);
router.patch("/users/:id", updateUser);
router.patch("/users/:id/password", resetUserPassword);
router.delete("/users/:id", deleteUser);

module.exports = router;
