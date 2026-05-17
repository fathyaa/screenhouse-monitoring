const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const {
  register,
  login,
  approveUser,
  getPendingUsers,
  getApprovedUsers
} = require("../controllers/authController");

const router = express.Router();

router.patch(
  "/users/:id/approve",
  authMiddleware,
  roleMiddleware([
    "operator",
    "super_admin",
  ]),
  approveUser
);

router.get(
  "/users/pending",
  authMiddleware,
  roleMiddleware([
    "admin",
    "operator",
  ]),
  getPendingUsers
);

router.get(
  "/users/approved",
  authMiddleware,
  roleMiddleware([
    "admin",
    "operator",
  ]),
  getApprovedUsers
);

router.post("/register", register);
router.post("/login", login);

module.exports = router;