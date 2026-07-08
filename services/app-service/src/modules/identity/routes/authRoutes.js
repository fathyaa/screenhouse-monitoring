const express = require("express");
const authMiddleware = require("../../../shared/middlewares/authMiddleware");
const roleMiddleware = require("../../../shared/middlewares/roleMiddleware");

const {
  register,
  login,
  approveUser,
  rejectUser,
  getApprovalStats,
  getPendingUsers,
  getFarmers,
  getFarmerScreenhouses,
  getApprovedUsers,
  getMe,
  updateMe,
  updateMyNotificationPref,
  changeMyPassword,
} = require("../controllers/authController");

const router = express.Router();

const approvalRoles = ["admin", "operator", "super_admin"];
const approveRoles = ["operator", "super_admin"];

router.get("/me", authMiddleware, getMe);
router.patch("/me", authMiddleware, updateMe);
router.patch("/me/notifications", authMiddleware, updateMyNotificationPref);
router.patch("/me/password", authMiddleware, changeMyPassword);

router.patch(
  "/:id/approve",
  authMiddleware,
  roleMiddleware(approveRoles),
  approveUser
);

router.patch(
  "/:id/reject",
  authMiddleware,
  roleMiddleware(approveRoles),
  rejectUser
);

router.get(
  "/stats",
  authMiddleware,
  roleMiddleware(approvalRoles),
  getApprovalStats
);

router.get(
  "/pending",
  authMiddleware,
  roleMiddleware(approvalRoles),
  getPendingUsers
);

router.get(
  "/farmers",
  authMiddleware,
  roleMiddleware(approvalRoles),
  getFarmers
);

router.get(
  "/farmers/:id/screenhouses",
  authMiddleware,
  roleMiddleware(approvalRoles),
  getFarmerScreenhouses
);

router.get(
  "/approved",
  authMiddleware,
  roleMiddleware(approvalRoles),
  getApprovedUsers
);

router.post("/register", register);
router.post("/login", login);

module.exports = router;
