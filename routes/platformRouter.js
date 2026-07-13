const router = require("express").Router();
const auth = require("../middleware/auth");
const { requirePermission } = require("../utils/permissions");
const platformCtrl = require("../controllers/platformCtrl");

// User-facing
router.post("/reports", auth, platformCtrl.createReport);
router.post("/appeals", auth, platformCtrl.createAppeal);

// Admin / moderation
router.get(
  "/admin/reports",
  auth,
  requirePermission("moderation.read"),
  platformCtrl.getReports
);
router.patch(
  "/admin/reports/:id",
  auth,
  requirePermission("moderation.update"),
  platformCtrl.updateReport
);
router.post(
  "/admin/strikes",
  auth,
  requirePermission("moderation.update"),
  platformCtrl.issueStrike
);
router.get(
  "/admin/users/search",
  auth,
  requirePermission("users.read"),
  platformCtrl.adminSearchUsers
);
router.get(
  "/admin/users/:id/360",
  auth,
  requirePermission("users.read"),
  platformCtrl.getUser360
);
router.post(
  "/admin/users/bulk",
  auth,
  requirePermission("users.update"),
  platformCtrl.bulkUserAction
);
router.post(
  "/admin/users/:id/notes",
  auth,
  requirePermission("users.update"),
  platformCtrl.addModeratorNote
);
router.patch(
  "/admin/users/:id/shadow-ban",
  auth,
  requirePermission("users.ban"),
  platformCtrl.toggleShadowBan
);
router.patch(
  "/admin/users/:id/suspend",
  auth,
  requirePermission("users.suspend"),
  platformCtrl.suspendUser
);
router.get(
  "/admin/appeals",
  auth,
  requirePermission("moderation.read"),
  platformCtrl.getAppeals
);
router.patch(
  "/admin/appeals/:id",
  auth,
  requirePermission("moderation.update"),
  platformCtrl.resolveAppeal
);

module.exports = router;
